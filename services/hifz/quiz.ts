import type {PracticeTarget} from '@/services/recitation/practice/types';

// Hifz quiz questions, answered by reciting. Questions come only from the
// surahs the reader has memorised; `rand` makes them reproducible in tests.

export type QuizKind = 'next' | 'continue' | 'whichSurah' | 'bridge';

export interface QuizData {
  ayahCount: (surah: number) => number;
  pagesOfSurah: (surah: number) => readonly number[];
  /** Verse keys on a page, in order. */
  keysOfPage: (page: number) => readonly string[];
}

export interface QuizQuestion {
  kind: QuizKind;
  /** The ayah shown; `words` shows only its first words. */
  prompt: {verseKey: string; words?: number};
  target: PracticeTarget;
  /** The ayah the reader should have recited, shown afterwards. */
  answer: string;
}

/** Words shown for a "continue" question. */
const CONTINUE_WORDS = 3;
/** Ayat recited for a "continue" question, prompt included. */
const CONTINUE_AYAT = 3;

function passage(surah: number, ayah: number, ayahEnd = ayah) {
  return {surah, ayah, ayahEnd};
}

/** A random ayah of the memorised surahs, ayah N weighted evenly. */
function randomAyah(
  memorized: readonly number[],
  rand: () => number,
  data: QuizData,
  minAyah = 1,
  trimEnd = 0,
): {surah: number; ayah: number} | null {
  const spans = memorized
    .map(surah => ({
      surah,
      count: data.ayahCount(surah) - trimEnd - minAyah + 1,
    }))
    .filter(span => span.count > 0);
  const total = spans.reduce((sum, span) => sum + span.count, 0);
  if (total === 0) return null;
  let index = Math.floor(rand() * total);
  for (const span of spans) {
    if (index < span.count) return {surah: span.surah, ayah: minAyah + index};
    index -= span.count;
  }
  return null;
}

function bridgeQuestion(
  memorized: readonly number[],
  rand: () => number,
  data: QuizData,
): QuizQuestion | null {
  const pages = new Set<number>();
  for (const surah of memorized) {
    for (const page of data.pagesOfSurah(surah)) pages.add(page);
  }
  // A page whose next page is memorised too: its last ayah leads into it.
  const seams = [...pages]
    .sort((a, b) => a - b)
    .filter(page => pages.has(page + 1))
    .map(page => ({
      last: data.keysOfPage(page).at(-1),
      first: data.keysOfPage(page + 1)[0],
    }))
    .filter(
      (seam): seam is {last: string; first: string} =>
        seam.last !== undefined && seam.first !== undefined,
    );
  if (seams.length === 0) return null;
  const seam = seams[Math.floor(rand() * seams.length)];
  const [surah, ayah] = seam.first.split(':').map(Number);
  return {
    kind: 'bridge',
    prompt: {verseKey: seam.last},
    target: {expected: passage(surah, ayah), mode: 'correction'},
    answer: seam.first,
  };
}

export function makeQuestion(
  kind: QuizKind,
  memorized: readonly number[],
  rand: () => number,
  data: QuizData,
): QuizQuestion | null {
  switch (kind) {
    case 'next': {
      const at = randomAyah(memorized, rand, data, 1, 1);
      if (!at) return null;
      return {
        kind,
        prompt: {verseKey: `${at.surah}:${at.ayah}`},
        target: {expected: passage(at.surah, at.ayah + 1), mode: 'correction'},
        answer: `${at.surah}:${at.ayah + 1}`,
      };
    }
    case 'continue': {
      const at = randomAyah(memorized, rand, data);
      if (!at) return null;
      const end = Math.min(
        at.ayah + CONTINUE_AYAT - 1,
        data.ayahCount(at.surah),
      );
      return {
        kind,
        prompt: {verseKey: `${at.surah}:${at.ayah}`, words: CONTINUE_WORDS},
        target: {expected: passage(at.surah, at.ayah, end), mode: 'correction'},
        answer: `${at.surah}:${at.ayah}`,
      };
    }
    case 'whichSurah': {
      const at = randomAyah(memorized, rand, data, 2);
      if (!at) return null;
      return {
        kind,
        prompt: {verseKey: `${at.surah}:${at.ayah}`},
        target: {
          expected: null,
          mode: 'tracking',
          accept: [`${at.surah}:1`, `${at.surah}:2`],
        },
        answer: `${at.surah}:1`,
      };
    }
    case 'bridge':
      return (
        bridgeQuestion(memorized, rand, data) ??
        makeQuestion('next', memorized, rand, data)
      );
  }
}
