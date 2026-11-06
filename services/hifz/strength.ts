// How well a page is held, from the takes that recited it from memory. A
// clean take (nothing to check, no peeks) on a new day doubles the revision
// interval, 1, 2, 4 ... up to 30 days; anything to check resets it to a day.

export const DAY_MS = 86_400_000;
export const MAX_INTERVAL_DAYS = 30;
/** Intervals this long count as strong. */
const STRONG_DAYS = 8;

export type PageLevel = 'unseen' | 'weak' | 'fair' | 'strong';

export interface PageVisit {
  /** When the take started. */
  at: number;
  /** Nothing to check and no peeks on this page. */
  clean: boolean;
}

export interface PageState {
  level: PageLevel;
  intervalDays: number;
  lastAt: number | null;
  /** When the page is next due for revision. */
  dueAt: number;
}

function dayOf(at: number): number {
  return Math.floor(at / DAY_MS);
}

export function pageStrength(
  visits: readonly PageVisit[],
  now: number,
): PageState {
  if (visits.length === 0) {
    return {level: 'unseen', intervalDays: 0, lastAt: null, dueAt: now};
  }
  const ordered = [...visits].sort((a, b) => a.at - b.at);
  let interval = 0;
  let lastCleanDay: number | null = null;
  for (const visit of ordered) {
    if (!visit.clean) {
      interval = 1;
      lastCleanDay = null;
      continue;
    }
    const day = dayOf(visit.at);
    if (day === lastCleanDay) continue;
    interval = interval === 0 ? 1 : Math.min(interval * 2, MAX_INTERVAL_DAYS);
    lastCleanDay = day;
  }
  const last = ordered[ordered.length - 1];
  const level: PageLevel = !last.clean
    ? 'weak'
    : interval >= STRONG_DAYS
      ? 'strong'
      : 'fair';
  return {
    level,
    intervalDays: interval,
    lastAt: last.at,
    dueAt: last.at + interval * DAY_MS,
  };
}
