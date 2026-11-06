import {DAY_MS, type PageState} from '../strength';
import {todayPlan, type HifzProfile, type PlanData} from '../plan';

const NOW = Date.UTC(2026, 10, 10, 9);

// A small mushaf: surah 1 on page 1, surah 2 on pages 2-4, surah 3 on 5-6.
const DATA: PlanData = {
  pagesOfSurah: surah => ({1: [1], 2: [2, 3, 4], 3: [5, 6]})[surah] ?? [],
  pageOf: key => {
    const [surah, ayah] = key.split(':').map(Number);
    if (surah === 1) return 1;
    if (surah === 2) return ayah <= 10 ? 2 : ayah <= 20 ? 3 : 4;
    return ayah <= 10 ? 5 : 6;
  },
  ayahCount: surah => ({1: 7, 2: 30, 3: 20})[surah] ?? 0,
};

function profile(overrides: Partial<HifzProfile>): HifzProfile {
  return {
    memorizedSurahs: [],
    sabaq: null,
    newAyatPerDay: 5,
    manzilPagesPerDay: 2,
    dailyGoalAyat: 20,
    ...overrides,
  };
}

function state(overrides: Partial<PageState>): PageState {
  return {
    level: 'fair',
    intervalDays: 2,
    lastAt: NOW,
    dueAt: NOW,
    ...overrides,
  };
}

describe('todayPlan', () => {
  it('with nothing memorised and no log, plans only the first sabaq', () => {
    const plan = todayPlan(
      profile({sabaq: {surah: 2, ayah: 1}}),
      new Map(),
      NOW,
      DATA,
    );
    expect(plan).toEqual({
      sabaq: {surah: 2, ayah: 1, ayahEnd: 5},
      sabqi: [],
      manzil: [],
    });
  });

  it('the sabaq never runs past the end of its surah', () => {
    const plan = todayPlan(
      profile({sabaq: {surah: 1, ayah: 5}}),
      new Map(),
      NOW,
      DATA,
    );
    expect(plan.sabaq).toEqual({surah: 1, ayah: 5, ayahEnd: 7});
  });

  it('manzil starts with memorised pages never recited, in mushaf order', () => {
    const plan = todayPlan(
      profile({memorizedSurahs: [1, 2]}),
      new Map(),
      NOW,
      DATA,
    );
    expect(plan.manzil).toEqual([1, 2]);
  });

  it('manzil then picks the most overdue memorised pages, skipping ones not due', () => {
    // Last recited weeks ago, so none of them is sabqi.
    const old = NOW - 20 * DAY_MS;
    const pages = new Map<number, PageState>([
      [1, state({lastAt: old, dueAt: NOW + DAY_MS})],
      [2, state({lastAt: old, dueAt: NOW - 5 * DAY_MS})],
      [3, state({lastAt: old, dueAt: NOW - 1 * DAY_MS})],
      [4, state({lastAt: old, dueAt: NOW - 3 * DAY_MS})],
    ]);
    const plan = todayPlan(
      profile({memorizedSurahs: [1, 2]}),
      pages,
      NOW,
      DATA,
    );
    expect(plan.manzil).toEqual([2, 4]);
  });

  it('sabqi takes memorised pages recited in the last 7 days, newest first, not the sabaq page', () => {
    const pages = new Map<number, PageState>([
      [2, state({lastAt: NOW - 1 * DAY_MS, dueAt: NOW + DAY_MS})],
      [3, state({lastAt: NOW - 2 * DAY_MS, dueAt: NOW + DAY_MS})],
      [4, state({lastAt: NOW - 9 * DAY_MS, dueAt: NOW + DAY_MS})],
      [5, state({lastAt: NOW - 1 * DAY_MS, dueAt: NOW + DAY_MS})],
    ]);
    const plan = todayPlan(
      profile({memorizedSurahs: [2, 3], sabaq: {surah: 3, ayah: 1}}),
      pages,
      NOW,
      DATA,
    );
    expect(plan.sabqi).toEqual([2, 3]);
    expect(plan.manzil).not.toContain(2);
  });
});
