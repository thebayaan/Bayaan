// modules/bayaan-widgets/src/contextRules.ts
// Reference implementation of the Phase 3 time and Bayaan Now rules. Mirrored
// by ContentLogic.swift and ContentLogic.kt; shared vectors in
// __fixtures__/context.vectors.json. Hours are local Gregorian.
export type AdhkarPeriod = 'morning' | 'evening';

export type BayaanNowMode =
  | 'listening'
  | 'morningAdhkar'
  | 'eveningAdhkar'
  | 'bedtime';

export const CONTEXT_BOUNDARY_HOURS: readonly number[] = [
  0, 4, 11, 12, 15, 18, 20, 21,
];

export function adhkarPeriod(hour: number): AdhkarPeriod {
  return hour >= 4 && hour < 12 ? 'morning' : 'evening';
}

/**
 * Cards a fork can turn off with feature flags (RFC-021): `adhkar` for the
 * adhkar cards, `sleepTimer` for the bedtime card. Their hours fall back to
 * listening.
 */
export interface BayaanNowCards {
  adhkar: boolean;
  bedtime: boolean;
}

export const ALL_BAYAAN_NOW_CARDS: Readonly<BayaanNowCards> = {
  adhkar: true,
  bedtime: true,
};

export function bayaanNowMode(
  hour: number,
  isPlaying: boolean,
  cards: Readonly<BayaanNowCards> = ALL_BAYAAN_NOW_CARDS,
): BayaanNowMode {
  if (isPlaying) return 'listening';
  if (cards.adhkar && hour >= 4 && hour < 11) return 'morningAdhkar';
  if (cards.adhkar && hour >= 15 && hour < 20) return 'eveningAdhkar';
  if (cards.bedtime && (hour >= 21 || hour < 4)) return 'bedtime';
  return 'listening';
}

export function bayaanNowRelevance(
  mode: BayaanNowMode,
  isPlaying: boolean,
): number {
  switch (mode) {
    case 'listening':
      return isPlaying ? 1 : 0.2;
    case 'morningAdhkar':
    case 'eveningAdhkar':
      return 0.7;
    case 'bedtime':
      return 0.6;
  }
}

export function adhkarRelevance(hour: number): number {
  return (hour >= 4 && hour < 11) || (hour >= 15 && hour < 20) ? 0.7 : 0.2;
}

export function bedtimeRelevance(hour: number): number {
  return hour >= 21 || hour < 4 ? 0.6 : 0.1;
}

/** Minutes since local midnight of the next boundary; 1440 is the next midnight. */
export function nextBoundaryMinutes(minutesSinceMidnight: number): number {
  for (const h of CONTEXT_BOUNDARY_HOURS) {
    if (h * 60 > minutesSinceMidnight) return h * 60;
  }
  return 1440;
}

export function sleepTimerActive(endsAt: number | null, now: number): boolean {
  return endsAt !== null && endsAt > now;
}
