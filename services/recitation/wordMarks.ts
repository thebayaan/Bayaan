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

/** One word's new verdict, in Tilawa's word index (0-based). */
export interface VerdictChange {
  surah: number;
  ayah: number;
  word: number;
  /** Words in the ayah, in Tilawa's segmentation. */
  totalWords: number;
  state: VerdictState;
}

/** 'missed': the word was not heard. 'wrong': something else was heard. */
export type MarkKind = 'missed' | 'wrong';
export type MarkStatus = 'suspect' | 'mistake' | 'corrected';

export interface WordMark {
  surah: number;
  ayah: number;
  word: number;
  totalWords: number;
  kind: MarkKind;
  status: MarkStatus;
  /** When the word was first suspected (ms). */
  since: number;
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

export function markKey(surah: number, ayah: number, word: number): string {
  return `${surah}:${ayah}:${word}`;
}

export function emptyMarkBook(): MarkBook {
  return new Map();
}

function isBoundary(change: VerdictChange): boolean {
  return change.word <= 0 || change.word >= change.totalWords - 1;
}

/** The kind a verdict marks, or null when it is not a mistake. */
function badKind(change: VerdictChange): MarkKind | null {
  if (change.state === 'skipped') return 'missed';
  if (change.state === 'wrong' && !isBoundary(change)) return 'wrong';
  return null;
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
    const kind = badKind(change);
    if (kind) {
      if (!mark || mark.status === 'corrected') {
        write(key, {
          surah: change.surah,
          ayah: change.ayah,
          word: change.word,
          totalWords: change.totalWords,
          kind,
          status: 'suspect',
          since: now,
        });
      } else if (mark.status === 'suspect' && mark.kind !== kind) {
        write(key, {...mark, kind});
      }
      continue;
    }
    if (!mark) continue;
    if (mark.status === 'suspect') {
      // Flipped back inside the confirm window: never shown.
      write(key, null);
    } else if (mark.status === 'mistake' && change.state === 'ok') {
      const fixed: WordMark = {...mark, status: 'corrected'};
      write(key, fixed);
      corrected.push(fixed);
    }
  }
  return {book: next ?? book, confirmed: [], corrected};
}

/** Turns suspects that held for MARK_CONFIRM_MS into mistakes. */
export function confirmDue(book: MarkBook, now: number): MarkUpdate {
  let next: Map<string, WordMark> | null = null;
  const confirmed: WordMark[] = [];
  for (const [key, mark] of book) {
    if (mark.status !== 'suspect' || now - mark.since < MARK_CONFIRM_MS) {
      continue;
    }
    next ??= new Map(book);
    const shown: WordMark = {...mark, status: 'mistake'};
    next.set(key, shown);
    confirmed.push(shown);
  }
  return {book: next ?? book, confirmed, corrected: []};
}

/** The earliest time a suspect becomes due, or null with none waiting. */
export function nextConfirmAt(book: MarkBook): number | null {
  let at: number | null = null;
  for (const mark of book.values()) {
    if (mark.status !== 'suspect') continue;
    const due = mark.since + MARK_CONFIRM_MS;
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
    .filter(m => m.status !== 'suspect' && !leftToAyahFlag(m, skippedAyat))
    .sort((a, b) => a.surah - b.surah || a.ayah - b.ayah || a.word - b.word);
}
