const DAY_MS = 86_400_000;

// Days from 1970-01-01 to the local (Gregorian) calendar date of `date`.
// Mirrored by WidgetLogic.dayNumber (Swift) and DayMath.dayNumber (Kotlin).
export function localDayNumber(date: Date): number {
  return Math.floor(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS,
  );
}

// Index into ayat.json for the local date; -1 for an empty list.
export function ayahOfTheDayIndex(date: Date, count: number): number {
  if (count <= 0) return -1;
  const n = localDayNumber(date) % count;
  return n < 0 ? n + count : n;
}
