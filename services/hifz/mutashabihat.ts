import type {PairResult} from '@/store/hifzStore';

// The look-alike (mutashabihat) trainer picks an ayah that has a close
// look-alike elsewhere, asks the reader to recite it, and brings back the
// pairs where the reader drifted into the look-alike. Pairs come from the
// app's similar-ayat data (scores 50 to 100).

/** Look-alikes at or above this score are drilled. */
export const MIN_LOOK_ALIKE_SCORE = 70;
/** Random ayat tried before giving up on finding a new drill. */
const SEARCH_TRIES = 25;

export interface LookAlike {
  /** The ayah to recite. */
  ayah: string;
  /** Its look-alike, the one to stay out of. */
  other: string;
  score: number;
}

export interface Drill {
  ayah: string;
  other: string;
}

/** A pair's result key: recite `ayah`, avoid `other`. */
export function drillKey(ayah: string, other: string): string {
  return `${ayah}>${other}`;
}

function surahOf(verseKey: string): number {
  return Number(verseKey.split(':')[0]);
}

export function lookAlikesFor(
  verseKey: string,
  similar: readonly {matchedVerseKey: string; score: number}[],
  memorized: ReadonlySet<number>,
): LookAlike[] {
  return similar
    .filter(
      s =>
        s.score >= MIN_LOOK_ALIKE_SCORE &&
        s.matchedVerseKey !== verseKey &&
        memorized.has(surahOf(s.matchedVerseKey)),
    )
    .sort((a, b) => b.score - a.score)
    .map(s => ({ayah: verseKey, other: s.matchedVerseKey, score: s.score}));
}

/** Pairs the reader last drifted on, the longest waiting first. */
export function missedDrills(
  results: Readonly<Record<string, PairResult>>,
  memorized: ReadonlySet<number>,
): Drill[] {
  return Object.entries(results)
    .filter(([, r]) => r.lastMissed)
    .sort(([, a], [, b]) => a.lastAt - b.lastAt)
    .map(([key]) => {
      const [ayah, other] = key.split('>');
      return {ayah, other};
    })
    .filter(
      d => memorized.has(surahOf(d.ayah)) && memorized.has(surahOf(d.other)),
    );
}

/**
 * The next drill: a missed pair first, else a random memorised ayah with a
 * strong look-alike. Null when none turns up.
 */
export async function findDrill(
  memorizedSurahs: readonly number[],
  results: Readonly<Record<string, PairResult>>,
  rand: () => number,
  similarOf: (
    verseKey: string,
  ) => Promise<readonly {matchedVerseKey: string; score: number}[]>,
  keysOfSurah: (surah: number) => readonly string[],
): Promise<Drill | null> {
  const memorized = new Set(memorizedSurahs);
  const missed = missedDrills(results, memorized);
  if (missed.length > 0) return missed[0];
  const keys = memorizedSurahs.flatMap(surah => [...keysOfSurah(surah)]);
  if (keys.length === 0) return null;
  for (let i = 0; i < SEARCH_TRIES; i++) {
    const key = keys[Math.floor(rand() * keys.length)];
    const [best] = lookAlikesFor(key, await similarOf(key), memorized);
    if (best) return {ayah: best.ayah, other: best.other};
  }
  return null;
}
