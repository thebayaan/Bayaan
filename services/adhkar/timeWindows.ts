// Morning and evening adhkar windows by the clock (the app has no prayer
// times yet). Morning 04:00 to 14:59, evening 15:00 to 03:59. One module so a
// move to real prayer times changes one file.
const MORNING_START_HOUR = 4;
const EVENING_START_HOUR = 15;

export type AdhkarWindow = 'morning' | 'evening';

export function adhkarWindowAt(ms: number): AdhkarWindow {
  const hour = new Date(ms).getHours();
  return hour >= MORNING_START_HOUR && hour < EVENING_START_HOUR
    ? 'morning'
    : 'evening';
}

/** The first window start (04:00 or 15:00 local) strictly after `ms`. */
export function nextWindowBoundaryAfter(ms: number): number {
  const d = new Date(ms);
  const candidates = [
    new Date(d.getFullYear(), d.getMonth(), d.getDate(), MORNING_START_HOUR),
    new Date(d.getFullYear(), d.getMonth(), d.getDate(), EVENING_START_HOUR),
    new Date(
      d.getFullYear(),
      d.getMonth(),
      d.getDate() + 1,
      MORNING_START_HOUR,
    ),
  ];
  const next = candidates.find(c => c.getTime() > ms);
  // The third candidate is always after ms; find cannot miss.
  return (next ?? candidates[2]).getTime();
}
