// modules/bayaan-widgets/src/contextRules.ts
// Reference implementation of the Phase 3 time, occasion and Bayaan Now
// rules. Mirrored by ContentLogic.swift and ContentLogic.kt; shared vectors in
// __fixtures__/context.vectors.json and next-occasions.vectors.json. Hours and
// weekdays are local Gregorian; Hijri dates are Umm al-Qura and come from the
// platform calendar (or hijri.table.json in tests).
import {isRecord} from './guards';

export interface HijriDate {
  year: number;
  month: number;
  day: number;
}

export type OccasionId =
  | 'eidFitr'
  | 'arafah'
  | 'eidAdha'
  | 'lastTen'
  | 'ramadan'
  | 'dhulHijjah'
  | 'ashura'
  | 'jumuah';

export type AdhkarPeriod = 'morning' | 'evening';

export type BayaanNowMode =
  | 'listening'
  | 'occasion'
  | 'morningAdhkar'
  | 'eveningAdhkar'
  | 'bedtime';

export interface UpcomingOccasion {
  id: OccasionId;
  days: number;
}

/** Gregorian weekday numbering shared with Foundation and java.util.Calendar: Sunday = 1. */
export const FRIDAY = 6;
export const JUMUAH_END_HOUR = 18;
export const CONTEXT_BOUNDARY_HOURS: readonly number[] = [
  0, 4, 11, 12, 15, 18, 20, 21,
];
export const NEXT_OCCASION_HORIZON_DAYS = 400;

interface OccasionWindow {
  id: OccasionId;
  month: number;
  from: number;
  to: number;
}

// Priority order. The Hijri windows do not overlap; Jumu'ah applies only
// when none matches.
export const OCCASION_WINDOWS: readonly OccasionWindow[] = [
  {id: 'eidFitr', month: 10, from: 1, to: 3},
  {id: 'arafah', month: 12, from: 9, to: 9},
  {id: 'eidAdha', month: 12, from: 10, to: 13},
  {id: 'lastTen', month: 9, from: 21, to: 30},
  {id: 'ramadan', month: 9, from: 1, to: 20},
  {id: 'dhulHijjah', month: 12, from: 1, to: 8},
  {id: 'ashura', month: 1, from: 9, to: 10},
];

export const UPCOMING_ANCHORS: readonly {
  id: OccasionId;
  month: number;
  day: number;
}[] = [
  {id: 'ramadan', month: 9, day: 1},
  {id: 'eidFitr', month: 10, day: 1},
  {id: 'dhulHijjah', month: 12, day: 1},
  {id: 'arafah', month: 12, day: 9},
  {id: 'eidAdha', month: 12, day: 10},
  {id: 'ashura', month: 1, day: 10},
];

export function adhkarPeriod(hour: number): AdhkarPeriod {
  return hour >= 4 && hour < 12 ? 'morning' : 'evening';
}

export function occasionFor(
  hijri: HijriDate | null,
  weekday: number,
  hour: number,
): OccasionId | null {
  const hit = hijri
    ? OCCASION_WINDOWS.find(
        w =>
          w.month === hijri.month && hijri.day >= w.from && hijri.day <= w.to,
      )
    : undefined;
  if (hit) return hit.id;
  return weekday === FRIDAY && hour < JUMUAH_END_HOUR ? 'jumuah' : null;
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
  occasion: OccasionId | null,
  cards: Readonly<BayaanNowCards> = ALL_BAYAAN_NOW_CARDS,
): BayaanNowMode {
  if (isPlaying) return 'listening';
  if (occasion !== null) return 'occasion';
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
    case 'occasion':
      return 0.8;
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

export function occasionRelevance(occasion: OccasionId | null): number {
  return occasion !== null ? 0.8 : 0.1;
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

/**
 * Scans forward day by day; stops once `count` anchors are found or the
 * converter returns null.
 */
export function nextOccasions(
  today: number,
  hijriOf: (dayNumber: number) => HijriDate | null,
  count: number,
  horizon: number = NEXT_OCCASION_HORIZON_DAYS,
): UpcomingOccasion[] {
  const found: UpcomingOccasion[] = [];
  for (let d = 1; d <= horizon && found.length < count; d++) {
    const h = hijriOf(today + d);
    if (!h) break;
    for (const a of UPCOMING_ANCHORS) {
      if (
        found.length < count &&
        a.month === h.month &&
        a.day === h.day &&
        !found.some(f => f.id === a.id)
      ) {
        found.push({id: a.id, days: d});
      }
    }
  }
  return found;
}

export function sleepTimerActive(endsAt: number | null, now: number): boolean {
  return endsAt !== null && endsAt > now;
}

// ---- Hijri table (tests and vector generation) ----------------------------

export interface HijriTable {
  from: number;
  rows: [number, number, number][];
}

function isTriple(value: unknown): value is [number, number, number] {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every(n => typeof n === 'number')
  );
}

export function parseHijriTable(value: unknown): HijriTable | null {
  if (!isRecord(value) || typeof value.from !== 'number') return null;
  if (!Array.isArray(value.rows) || !value.rows.every(isTriple)) return null;
  return {from: value.from, rows: value.rows};
}

export function hijriLookup(
  table: HijriTable,
): (dayNumber: number) => HijriDate | null {
  return dayNumber => {
    const row = table.rows[dayNumber - table.from];
    return row ? {year: row[0], month: row[1], day: row[2]} : null;
  };
}

export interface NextOccasionVector {
  today: number;
  expect: UpcomingOccasion[];
}

// 2026-01-01, 2026-02-17 (eve of Ramadan), 2026-02-18 (1 Ramadan), 2026-10-11, 2027-01-01.
export const NEXT_OCCASION_VECTOR_DAYS: readonly number[] = [
  20454, 20501, 20502, 20737, 20819,
];

export function buildNextOccasionVectors(
  table: HijriTable,
  count = 3,
): NextOccasionVector[] {
  const lookup = hijriLookup(table);
  return NEXT_OCCASION_VECTOR_DAYS.map(today => ({
    today,
    expect: nextOccasions(today, lookup, count),
  }));
}
