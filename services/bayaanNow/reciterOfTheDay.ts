// @ai-generated
// The surah Home's Reciter of the day offers: a random one each day from
// what that reciter recorded, never a short one.
import {localDayNumber} from '@/modules/bayaan-widgets/src/dayMath';

/** Surahs with fewer verses than this are too short to feature. */
export const MIN_FEATURED_VERSES = 40;

/* eslint-disable no-bitwise -- mulberry32 is bit arithmetic. */
/** mulberry32: a day number becomes a well-spread number in [0, 1). */
function dayRandom(seed: number): number {
  let t = (seed + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
/* eslint-enable no-bitwise */

/**
 * Today's surah among `surahIds`, keeping those with at least
 * MIN_FEATURED_VERSES verses. The same all day, different from one day to
 * the next. Null when the reciter has no surah long enough.
 */
export function reciterOfTheDaySurah(
  surahIds: readonly number[],
  versesOf: (surahId: number) => number | undefined,
  date: Date,
): number | null {
  const long = surahIds.filter(
    id => (versesOf(id) ?? 0) >= MIN_FEATURED_VERSES,
  );
  if (long.length === 0) return null;
  const index = Math.floor(dayRandom(localDayNumber(date)) * long.length);
  return long[Math.min(index, long.length - 1)];
}
