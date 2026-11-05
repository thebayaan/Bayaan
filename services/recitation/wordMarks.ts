// Live mistake marks from the engine's per-word verdicts.
//
// The engine judges each word about 1.2 s after it is said (pending, then
// ok, unsure, wrong or skipped). A wrong or skipped word is first a suspect;
// it becomes a shown mistake only if it is still bad MARK_CONFIRM_MS later,
// which drops the one-chunk (480 ms) flickers measured on real recitations. A mistake
// whose word is later recited correctly becomes corrected. On an ayah's first
// or last word only a skip counts: "wrong" there is mostly the reciter
// joining two ayat.

export type VerdictState = 'ok' | 'unsure' | 'wrong' | 'skipped' | 'pending';

/** The engine's scores behind a bad verdict (Tilawa's WordVerdict). */
export interface VerdictDetail {
  /**
   * Per-token log-likelihood ratio of the best path forced to the expected
   * word against the free best path over the word's audio: about 0 when the
   * expected word fits the audio, strongly negative when it does not.
   * Correction mode, interior words with both neighbours heard.
   */
  gop?: number | null;
  /** Share of the word's expected sounds that were heard. */
  heardRatio?: number | null;
  /** Normalised distance between the heard and expected sounds. */
  distance?: number | null;
}

/** One word's new verdict, in Tilawa's word index (0-based). */
export interface VerdictChange {
  surah: number;
  ayah: number;
  word: number;
  /** Words in the ayah, in Tilawa's segmentation. */
  totalWords: number;
  state: VerdictState;
  /** Present on wrong and skipped verdicts. */
  detail?: VerdictDetail;
}

/** 'missed': the word was not heard. 'wrong': something else was heard. */
/** A word of the Quran, as the engine numbers it (word 0-based). */
export interface EngineWord {
  surah: number;
  ayah: number;
  word: number;
}

export type MarkKind = 'missed' | 'wrong';
/**
 * 'noted': a bad verdict that is not a slip on its own (an ayah-edge
 * 'wrong', a word that fits the audio, a suspect that flipped back or was
 * dropped). Never shown; it counts towards the confusion rule.
 */
export type MarkStatus = 'suspect' | 'mistake' | 'corrected' | 'noted';

export interface WordMark {
  surah: number;
  ayah: number;
  word: number;
  totalWords: number;
  kind: MarkKind;
  status: MarkStatus;
  /** When the word was first suspected (ms). */
  since: number;
  /** A suspect: when one of the next words was heard correctly (ms). */
  followedAt?: number;
  /** When the word last went wrong or skipped (ms). */
  lastBadAt?: number;
}

export type MarkBook = ReadonlyMap<string, WordMark>;

export interface MarkUpdate {
  book: MarkBook;
  /** Marks that just became mistakes. */
  confirmed: WordMark[];
  /** Mistakes that were just recited correctly. */
  corrected: WordMark[];
}

/** A bad verdict must hold this long before it is shown. */
export const MARK_CONFIRM_MS = 500;
/**
 * And one of the next NEXT_OK_WORDS words must be heard correctly within
 * this long of it, or it is dropped. With other voices in the room most
 * false marks came with more confusion right after them, while a real slip
 * is followed by the reader carrying on: on the bench this kept two thirds
 * of those false marks off the page, with clean recitation unchanged and
 * marks no later.
 */
export const NEXT_OK_WINDOW_MS = 3000;
const NEXT_OK_WORDS = 2;

// The engine's scores, measured on 135 bench recitations (9 reciters, 5
// surahs, 852 planted mistakes) and checked with each reciter held out:
// together with the confusion rule and dropping suspects when the engine
// loses the reader, these removed 59% of false marks for 5% of real catches.
/** A skip whose expected word still fits the audio this well is the
 *  alignment slipping, not the reader. */
export const SKIP_FITS_GOP = -5;
/** Same for a wrong word, which needs a closer fit to be let off. */
export const WRONG_FITS_GOP = -1;
/** An ayah's first word (no fit score there) judged skipped though more
 *  than this share of it was heard. */
export const FIRST_SKIP_HEARD = 0.1;
/** A suspect with this many other words around it gone bad at the same
 *  time is confusion (noise, the tracker slipping), not a slip. */
export const CONFUSED_NEIGHBOURS = 3;
const NEIGHBOUR_SPAN = 3;
const NEIGHBOUR_WINDOW_MS = 2000;

/** `change` is one of the next NEXT_OK_WORDS words after `mark`. */
function follows(mark: WordMark, change: VerdictChange): boolean {
  if (change.surah !== mark.surah) return false;
  for (let i = 1; i <= NEXT_OK_WORDS; i++) {
    const word = mark.word + i;
    if (word < mark.totalWords) {
      if (change.ayah === mark.ayah && change.word === word) return true;
    } else if (
      change.ayah === mark.ayah + 1 &&
      change.word === word - mark.totalWords
    ) {
      return true;
    }
  }
  return false;
}

export function markKey(surah: number, ayah: number, word: number): string {
  return `${surah}:${ayah}:${word}`;
}

export function emptyMarkBook(): MarkBook {
  return new Map();
}

function isBoundary(change: VerdictChange): boolean {
  return change.word <= 0 || change.word >= change.totalWords - 1;
}

function isBad(change: VerdictChange): boolean {
  return change.state === 'wrong' || change.state === 'skipped';
}

/**
 * Drops the bad verdicts judged from the audio the engine replayed when it
 * found the reader (`lock`, the word it locked onto): that word may have been
 * heard only from its middle, and the words before it were not heard in this
 * lock at all. Other verdicts pass through.
 */
export function dropLockArtifacts(
  changes: readonly VerdictChange[],
  lock: EngineWord | null,
): VerdictChange[] {
  if (!lock) return [...changes];
  return changes.filter(c => {
    if (!isBad(c)) return true;
    const atOrBefore =
      c.surah < lock.surah ||
      (c.surah === lock.surah &&
        (c.ayah < lock.ayah || (c.ayah === lock.ayah && c.word <= lock.word)));
    return !atOrBefore;
  });
}

/** The kind a bad verdict is suspected as, or null when it is not a slip. */
function suspectKind(change: VerdictChange): MarkKind | null {
  const gop = change.detail?.gop;
  if (change.state === 'skipped') {
    if (typeof gop === 'number' && gop > SKIP_FITS_GOP) return null;
    if (
      change.word === 0 &&
      typeof gop !== 'number' &&
      (change.detail?.heardRatio ?? 0) > FIRST_SKIP_HEARD
    ) {
      return null;
    }
    return 'missed';
  }
  if (change.state === 'wrong') {
    if (isBoundary(change)) return null;
    if (typeof gop === 'number' && gop > WRONG_FITS_GOP) return null;
    return 'wrong';
  }
  return null;
}

function noted(mark: WordMark, now?: number): WordMark {
  return {...mark, status: 'noted', lastBadAt: now ?? mark.lastBadAt};
}

export function applyVerdicts(
  book: MarkBook,
  changes: readonly VerdictChange[],
  now: number,
): MarkUpdate {
  let next: Map<string, WordMark> | null = null;
  const corrected: WordMark[] = [];
  const write = (key: string, mark: WordMark | null) => {
    next ??= new Map(book);
    if (mark) next.set(key, mark);
    else next.delete(key);
  };
  for (const change of changes) {
    const key = markKey(change.surah, change.ayah, change.word);
    const mark = (next ?? book).get(key);
    if (isBad(change)) {
      const kind = suspectKind(change);
      const fresh = {
        surah: change.surah,
        ayah: change.ayah,
        word: change.word,
        totalWords: change.totalWords,
        since: now,
        lastBadAt: now,
      };
      if (
        kind &&
        (!mark || mark.status === 'corrected' || mark.status === 'noted')
      ) {
        write(key, {...fresh, kind, status: 'suspect'});
      } else if (kind && mark?.status === 'suspect') {
        write(key, {...mark, kind, lastBadAt: now});
      } else if (mark) {
        write(key, {...mark, lastBadAt: now});
      } else {
        const asKind: MarkKind =
          change.state === 'skipped' ? 'missed' : 'wrong';
        write(key, {...fresh, kind: asKind, status: 'noted'});
      }
      continue;
    }
    if (change.state === 'ok') {
      // The reader carried on correctly after a suspect.
      for (const [k, m] of next ?? book) {
        if (
          m.status === 'suspect' &&
          m.followedAt === undefined &&
          now >= m.since &&
          now - m.since <= NEXT_OK_WINDOW_MS &&
          follows(m, change)
        ) {
          write(k, {...m, followedAt: now});
        }
      }
    }
    if (!mark) continue;
    if (mark.status === 'suspect') {
      // Flipped back inside the confirm window: never shown.
      write(key, noted(mark));
    } else if (mark.status === 'mistake' && change.state === 'ok') {
      const fixed: WordMark = {...mark, status: 'corrected'};
      write(key, fixed);
      corrected.push(fixed);
    }
  }
  return {book: next ?? book, confirmed: [], corrected};
}

/** When a suspect is shown or dropped. */
function dueAt(mark: WordMark): number {
  return mark.followedAt === undefined
    ? mark.since + NEXT_OK_WINDOW_MS
    : Math.max(mark.since + MARK_CONFIRM_MS, mark.followedAt);
}

/** Other words around `mark` that went bad from just before it until now. */
function confused(book: MarkBook, mark: WordMark, now: number): boolean {
  let around = 0;
  for (const m of book.values()) {
    if (
      m.surah !== mark.surah ||
      m.ayah !== mark.ayah ||
      m.word === mark.word ||
      Math.abs(m.word - mark.word) > NEIGHBOUR_SPAN
    ) {
      continue;
    }
    const t = m.lastBadAt ?? m.since;
    if (t >= mark.since - NEIGHBOUR_WINDOW_MS && t <= now) around += 1;
  }
  return around >= CONFUSED_NEIGHBOURS;
}

/**
 * Turns suspects that held for MARK_CONFIRM_MS and were followed by a
 * correct word into mistakes, and drops the ones never followed in time or
 * caught up in confusion.
 */
export function confirmDue(book: MarkBook, now: number): MarkUpdate {
  let next: Map<string, WordMark> | null = null;
  const confirmed: WordMark[] = [];
  for (const [key, mark] of book) {
    if (mark.status !== 'suspect' || now < dueAt(mark)) continue;
    next ??= new Map(book);
    if (mark.followedAt === undefined || confused(book, mark, now)) {
      next.set(key, noted(mark));
      continue;
    }
    const shown: WordMark = {...mark, status: 'mistake'};
    next.set(key, shown);
    confirmed.push(shown);
  }
  return {book: next ?? book, confirmed, corrected: []};
}

/**
 * The engine lost the reader (or went idle): its pending suspicions are no
 * longer trustworthy. Shown mistakes stay.
 */
export function dropSuspects(book: MarkBook): MarkBook {
  let next: Map<string, WordMark> | null = null;
  for (const [key, mark] of book) {
    if (mark.status !== 'suspect') continue;
    next ??= new Map(book);
    next.set(key, noted(mark));
  }
  return next ?? book;
}

/** The earliest time a suspect is shown or dropped, or null with none. */
export function nextConfirmAt(book: MarkBook): number | null {
  let at: number | null = null;
  for (const mark of book.values()) {
    if (mark.status !== 'suspect') continue;
    const due = dueAt(mark);
    if (at === null || due < at) at = due;
  }
  return at;
}

/** Words at the start of the ayah after a skipped one that are not shown. */
const AFTER_SKIP_WORDS = 3;

function leftToAyahFlag(
  mark: WordMark,
  skippedAyat: ReadonlySet<string>,
): boolean {
  if (skippedAyat.has(`${mark.surah}:${mark.ayah}`)) return true;
  // The tracker lands in the next ayah a few words late after the jump.
  return (
    mark.word < AFTER_SKIP_WORDS &&
    skippedAyat.has(`${mark.surah}:${mark.ayah - 1}`)
  );
}

/**
 * Mistakes and corrected words to draw, in recitation order. Words inside an
 * ayah flagged as skipped, and the first words of the ayah after it, are left
 * to that flag.
 * @param skippedAyat - "surah:ayah" keys of ayat flagged as skipped
 */
export function shownMarks(
  book: MarkBook,
  skippedAyat: ReadonlySet<string>,
): WordMark[] {
  return [...book.values()]
    .filter(
      m =>
        (m.status === 'mistake' || m.status === 'corrected') &&
        !leftToAyahFlag(m, skippedAyat),
    )
    .sort((a, b) => a.surah - b.surah || a.ayah - b.ayah || a.word - b.word);
}
