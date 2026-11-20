import type {WordMark} from '../wordMarks';
import type {V1CheckAnswer} from './checkMark';
import v1Constants from './constants.json';
import type {V1Mark, V1MarkClass} from './types';

// Tilawa 1.0's possible mistakes, from first suspicion to what the page shows. Pure,
// so the bench replays exactly what the app does.
//
// suspected: noted, nothing shows.
// confirmed: the app's check runs (checking). If it keeps the mark, or cannot
//   answer, the mark shows; if it cancels it, it never does.
// resolved: the reader corrected themselves. A shown mark becomes corrected; one
//   not shown yet is dropped.
// uncertain: Tilawa could not tell. Dropped unless already shown.
//
// The restart rule: a shown wrong or left-out word becomes corrected when the
// reader goes back before it in its ayah and reads on past it with no new mark
// there. Re-reading is how a reader corrects themselves, and on the bench 37% of
// Tilawa's false marks sat on ayat the reciter restarted.

export type V1Status =
  | 'suspected'
  | 'checking'
  | 'shown'
  | 'corrected'
  | 'cancelled'
  | 'dropped';

export interface Place {
  surah: number;
  ayah: number;
  word: number;
}

export interface V1Entry {
  id: string;
  errorClass: V1MarkClass;
  place: Place;
  totalWords: number;
  status: V1Status;
  /** Audio seconds of the first state seen. */
  since: number;
  /** Audio seconds it was confirmed. */
  confirmedAt?: number;
  /** An added word: the word after the gap the check found it in. */
  gapRight?: Place;
  /** A skipped passage: where the reader went on. */
  resumedAt?: Place;
  /** The restart rule: the reader went back before it since it showed. */
  wentBack?: boolean;
}

export type V1Book = ReadonlyMap<string, V1Entry>;

export function emptyV1Book(): V1Book {
  return new Map();
}

const order = (a: Place, b: Place) =>
  a.surah - b.surah || a.ayah - b.ayah || a.word - b.word;

const placeKey = (p: Place) => `${p.surah}:${p.ayah}:${p.word}`;

function withEntry(book: V1Book, entry: V1Entry): V1Book {
  const next = new Map(book);
  next.set(entry.id, entry);
  return next;
}

/**
 * One of Tilawa's checker states.
 * @returns The book, and the entry to check when this state confirmed it
 */
export function noteV1Mark(
  book: V1Book,
  mark: V1Mark,
): {book: V1Book; toCheck: V1Entry | null} {
  const known = book.get(mark.id);
  const place = {surah: mark.surah, ayah: mark.ayah, word: mark.word};
  switch (mark.state) {
    case 'suspected':
      if (known) return {book, toCheck: null};
      return {
        book: withEntry(book, {
          id: mark.id,
          errorClass: mark.errorClass,
          place,
          totalWords: mark.totalWords,
          status: 'suspected',
          since: mark.audioTime,
        }),
        toCheck: null,
      };
    case 'confirmed': {
      if (known && known.status !== 'suspected') return {book, toCheck: null};
      const entry: V1Entry = {
        id: mark.id,
        errorClass: mark.errorClass,
        place,
        totalWords: mark.totalWords,
        status: 'checking',
        since: known?.since ?? mark.audioTime,
        confirmedAt: mark.audioTime,
      };
      return {book: withEntry(book, entry), toCheck: entry};
    }
    case 'resolved':
      if (!known) return {book, toCheck: null};
      if (known.status === 'shown') {
        return {
          book: withEntry(book, {...known, status: 'corrected'}),
          toCheck: null,
        };
      }
      if (known.status === 'suspected' || known.status === 'checking') {
        return {
          book: withEntry(book, {...known, status: 'dropped'}),
          toCheck: null,
        };
      }
      return {book, toCheck: null};
    case 'uncertain':
      if (known?.status === 'suspected' || known?.status === 'checking') {
        return {
          book: withEntry(book, {...known, status: 'dropped'}),
          toCheck: null,
        };
      }
      return {book, toCheck: null};
  }
}

/** The check's answer for an entry still waiting for it. */
export function answerV1Check(
  book: V1Book,
  id: string,
  answer: V1CheckAnswer,
): V1Book {
  const entry = book.get(id);
  if (entry?.status !== 'checking') return book;
  if (answer.outcome === 'cancelled') {
    return withEntry(book, {...entry, status: 'cancelled'});
  }
  return withEntry(book, {
    ...entry,
    status: 'shown',
    ...(answer.outcome === 'kept' && answer.gapRight
      ? {gapRight: answer.gapRight}
      : {}),
    ...(answer.outcome === 'kept' && answer.resumedAt
      ? {resumedAt: answer.resumedAt}
      : {}),
  });
}

/** Marks the restart rule applies to: a word read wrongly or left out. */
const restartable = (e: V1Entry) =>
  e.status === 'shown' &&
  (e.errorClass === 'wrong_word' || e.errorClass === 'omitted_word');

/**
 * The cursor moved to `at`: the restart rule. A shown wrong or left-out word whose
 * ayah the reader went back in (before the word), and then read past, becomes
 * corrected, unless a newer mark stands on the same word.
 */
export function noteV1Place(book: V1Book, at: Place): V1Book {
  let next: Map<string, V1Entry> | null = null;
  const set = (e: V1Entry) => {
    next ??= new Map(book);
    next.set(e.id, e);
  };
  for (const e of book.values()) {
    if (!restartable(e)) continue;
    const sameAyah = e.place.surah === at.surah && e.place.ayah === at.ayah;
    if (!sameAyah) continue;
    if (at.word < e.place.word) {
      if (!e.wentBack) set({...e, wentBack: true});
    } else if (at.word > e.place.word && e.wentBack) {
      const newer = [...book.values()].some(
        o =>
          o.id !== e.id &&
          placeKey(o.place) === placeKey(e.place) &&
          (o.status === 'checking' || o.status === 'shown') &&
          (o.confirmedAt ?? o.since) > (e.confirmedAt ?? e.since),
      );
      if (!newer) set({...e, status: 'corrected', wentBack: false});
    }
  }
  return next ?? book;
}

const KIND: Record<V1MarkClass, WordMark['kind']> = {
  wrong_word: 'wrong',
  omitted_word: 'missed',
  added_word: 'added',
  skipped_passage: 'missed',
};

/** Whole ayat between a skip's first left-out word and where the reader went on. */
function wholeAyatSkipped(from: Place, to: Place): number {
  if (from.surah !== to.surah) return Infinity;
  const firstWhole = from.word === 0 ? from.ayah : from.ayah + 1;
  return Math.max(0, to.ayah - firstWhole);
}

/** At most this many words of one skipped passage are marked one by one. */
const MAX_SKIPPED_WORDS = 20;

export interface V1Shown {
  marks: WordMark[];
  /** Whole ayat a shown skip left out ("surah:ayah"). */
  skippedAyat: string[];
}

/**
 * What the page shows: one mark a word (a mistake over a corrected one), and the
 * whole ayat skipped passages left out.
 * @param wordCount - Words in an ayah, for a skip that runs past its own ayah
 */
export function shownV1(
  book: V1Book,
  wordCount: (surah: number, ayah: number) => number,
): V1Shown {
  const byKey = new Map<string, WordMark>();
  const ayat = new Set<string>();
  const put = (place: Place, totalWords: number, e: V1Entry) => {
    const kind = KIND[e.errorClass];
    const key = `${placeKey(place)}${kind === 'added' ? '+' : ''}`;
    const status = e.status === 'shown' ? 'mistake' : 'corrected';
    const old = byKey.get(key);
    if (old?.status === 'mistake') return;
    byKey.set(key, {...place, totalWords, kind, status, since: e.since * 1000});
  };
  for (const e of book.values()) {
    if (e.status !== 'shown' && e.status !== 'corrected') continue;
    if (e.errorClass === 'added_word') {
      const at = e.gapRight ?? e.place;
      put(
        at,
        at.ayah === e.place.ayah ? e.totalWords : wordCount(at.surah, at.ayah),
        e,
      );
      continue;
    }
    if (e.errorClass !== 'skipped_passage' || !e.resumedAt) {
      put(e.place, e.totalWords, e);
      continue;
    }
    // A skip: each word left out, or whole ayat as ayat. One over more whole ayat
    // than a reader skips by mistake is the reader moving elsewhere: nothing shows.
    if (wholeAyatSkipped(e.place, e.resumedAt) > v1Constants.skipped.maxAyat) {
      continue;
    }
    let at: Place = {...e.place};
    let marked = 0;
    while (order(at, e.resumedAt) < 0 && marked < MAX_SKIPPED_WORDS) {
      const total = wordCount(at.surah, at.ayah);
      if (total <= 0) break;
      const wholeAyah =
        at.word === 0 &&
        (at.ayah !== e.resumedAt.ayah || at.surah !== e.resumedAt.surah);
      if (wholeAyah) {
        ayat.add(`${at.surah}:${at.ayah}`);
        at = {surah: at.surah, ayah: at.ayah + 1, word: 0};
        continue;
      }
      put(at, total, e);
      marked += 1;
      at =
        at.word + 1 < total
          ? {...at, word: at.word + 1}
          : {surah: at.surah, ayah: at.ayah + 1, word: 0};
    }
  }
  const marks = [...byKey.values()].sort(
    (a, b) =>
      order(a, b) ||
      (a.kind === 'added' ? 1 : 0) - (b.kind === 'added' ? 1 : 0),
  );
  return {marks, skippedAyat: [...ayat]};
}

/** Every entry still waiting for its check, for a take that is ending. */
export function checkingV1(book: V1Book): V1Entry[] {
  return [...book.values()].filter(e => e.status === 'checking');
}
