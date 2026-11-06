import {DAY_MS} from './strength';

// A quiet consistency streak and today's progress toward the daily goal.
// Any take that recited at least one ayah counts for its day; one missed
// day in any week is forgiven. Days follow the reader's clock.

/** One missed day is forgiven within this many days. */
const GRACE_WINDOW_DAYS = 7;

interface TakeLike {
  startedAt: number;
  ayat: readonly unknown[];
}

/** The local day number of `at`, for a clock `tzOffsetMinutes` from UTC
 *  (Date#getTimezoneOffset: positive west of UTC). */
function localDay(at: number, tzOffsetMinutes: number): number {
  return Math.floor((at - tzOffsetMinutes * 60_000) / DAY_MS);
}

export function recitationStreak(
  takes: readonly TakeLike[],
  now: number,
  tzOffsetMinutes: number,
): {days: number; recitedToday: boolean} {
  const active = new Set(
    takes
      .filter(take => take.ayat.length > 0)
      .map(take => localDay(take.startedAt, tzOffsetMinutes)),
  );
  const today = localDay(now, tzOffsetMinutes);
  const recitedToday = active.has(today);
  let days = 0;
  let lastGrace: number | null = null;
  // Before reciting today, the streak runs up to yesterday.
  for (let day = recitedToday ? today : today - 1; ; day--) {
    if (active.has(day)) {
      days++;
      continue;
    }
    if (days === 0) break;
    if (lastGrace !== null && lastGrace - day < GRACE_WINDOW_DAYS) break;
    lastGrace = day;
    // A forgiven day still needs a recited day before it.
    if (!active.has(day - 1)) break;
  }
  return {days, recitedToday};
}

/** Ayat recited in takes that started today. */
export function todaysAyat(
  takes: readonly TakeLike[],
  now: number,
  tzOffsetMinutes: number,
): number {
  const today = localDay(now, tzOffsetMinutes);
  return takes
    .filter(take => localDay(take.startedAt, tzOffsetMinutes) === today)
    .reduce((sum, take) => sum + take.ayat.length, 0);
}
