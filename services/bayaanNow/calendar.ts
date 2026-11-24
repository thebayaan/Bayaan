// @ai-generated
// The Hijri date for Bayaan Now's special days, by the tabular (Kuwaiti)
// calendar. It can be a day off the moon sighting where you live, so the
// backend's occasions lead on the days that matter most; this keeps the
// right days showing when the app is offline or the backend is quiet.

export interface HijriDate {
  year: number;
  /** 1 Muharram to 12 Dhul Hijjah. */
  month: number;
  day: number;
}

export const HIJRI_MONTH = {
  muharram: 1,
  ramadan: 9,
  shawwal: 10,
  dhulHijjah: 12,
} as const;

/** The Islamic day starts at sunset; 6 PM stands in for it. */
const DAY_STARTS_AT = 18;
const EPOCH = 1948439.5;

/** The Julian day at the midnight that starts this Gregorian date. */
function gregorianToJD(year: number, month: number, day: number): number {
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  const noon =
    day +
    Math.floor((153 * m + 2) / 5) +
    365 * y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) -
    32045;
  return noon - 0.5;
}

function islamicToJD(year: number, month: number, day: number): number {
  return (
    day +
    Math.ceil(29.5 * (month - 1)) +
    (year - 1) * 354 +
    Math.floor((3 + 11 * year) / 30) +
    EPOCH -
    1
  );
}

/**
 * The Hijri date of a moment. Its nights start the evening before, so by
 * default after 6 PM it is already the next day; pass `byDay` for the days
 * that are kept in daylight, such as Arafah and Eid.
 */
export function toHijri(now: Date, byDay = false): HijriDate {
  const date = new Date(now);
  if (!byDay && date.getHours() >= DAY_STARTS_AT) {
    date.setDate(date.getDate() + 1);
  }
  const jd = gregorianToJD(
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate(),
  );
  const year = Math.floor((30 * (jd - EPOCH) + 10646) / 10631);
  const month = Math.min(
    12,
    Math.ceil((jd - (29 + islamicToJD(year, 1, 1))) / 29.5) + 1,
  );
  const day = jd - islamicToJD(year, month, 1) + 1;
  return {year, month, day};
}

/** Noon on the Gregorian day that a Hijri date falls on, for previews and tests. */
export function fromHijri(year: number, month: number, day: number): Date {
  // Julian day to Gregorian (Fliegel and Van Flandern).
  const jd = islamicToJD(year, month, day) + 0.5;
  const l = jd + 68569;
  const n = Math.floor((4 * l) / 146097);
  const l2 = l - Math.floor((146097 * n + 3) / 4);
  const i = Math.floor((4000 * (l2 + 1)) / 1461001);
  const l3 = l2 - Math.floor((1461 * i) / 4) + 31;
  const j = Math.floor((80 * l3) / 2447);
  const d = l3 - Math.floor((2447 * j) / 80);
  const l4 = Math.floor(j / 11);
  const m = j + 2 - 12 * l4;
  const y = 100 * (n - 49) + i + l4;
  return new Date(y, m - 1, d, 12);
}
