import type {ExpectedPassage} from '@tilawa/core';
import {DAY_MS, type PageState} from './strength';

// Today's revision, the way a hifz teacher sets it: sabaq (new
// memorisation), sabqi (what was recited in the last week) and manzil (the
// rest of what is memorised, the most overdue pages first).

export interface HifzProfile {
  /** Surahs the reader has memorised. */
  memorizedSurahs: number[];
  /** Where new memorisation continues, or null when not memorising. */
  sabaq: {surah: number; ayah: number} | null;
  newAyatPerDay: number;
  manzilPagesPerDay: number;
  dailyGoalAyat: number;
}

export interface PlanData {
  pagesOfSurah: (surah: number) => readonly number[];
  pageOf: (verseKey: string) => number | undefined;
  ayahCount: (surah: number) => number;
}

export interface TodayPlan {
  sabaq: ExpectedPassage | null;
  /** Pages, newest first. */
  sabqi: number[];
  /** Pages, in the order to revise them. */
  manzil: number[];
}

/** Recent pages revised daily as sabqi. */
const SABQI_DAYS = 7;
const SABQI_MAX_PAGES = 5;

function memorizedPages(profile: HifzProfile, data: PlanData): number[] {
  const pages = new Set<number>();
  for (const surah of profile.memorizedSurahs) {
    for (const page of data.pagesOfSurah(surah)) pages.add(page);
  }
  return [...pages].sort((a, b) => a - b);
}

export function todayPlan(
  profile: HifzProfile,
  pages: ReadonlyMap<number, PageState>,
  now: number,
  data: PlanData,
): TodayPlan {
  let sabaq: ExpectedPassage | null = null;
  let sabaqPage: number | undefined;
  if (profile.sabaq) {
    const {surah, ayah} = profile.sabaq;
    const last = Math.min(
      ayah + Math.max(profile.newAyatPerDay, 1) - 1,
      data.ayahCount(surah),
    );
    sabaq = {surah, ayah, ayahEnd: Math.max(last, ayah)};
    sabaqPage = data.pageOf(`${surah}:${ayah}`);
  }

  const memorized = memorizedPages(profile, data).filter(p => p !== sabaqPage);

  const sabqi = memorized
    .filter(page => {
      const lastAt = pages.get(page)?.lastAt;
      return lastAt != null && now - lastAt <= SABQI_DAYS * DAY_MS;
    })
    .sort((a, b) => (pages.get(b)?.lastAt ?? 0) - (pages.get(a)?.lastAt ?? 0))
    .slice(0, SABQI_MAX_PAGES);

  const taken = new Set(sabqi);
  const unseen = memorized.filter(page => !pages.has(page));
  const overdue = memorized
    .filter(page => {
      const state = pages.get(page);
      return state != null && !taken.has(page) && state.dueAt <= now;
    })
    .sort((a, b) => (pages.get(a)?.dueAt ?? 0) - (pages.get(b)?.dueAt ?? 0));
  const manzil = [...unseen, ...overdue].slice(0, profile.manzilPagesPerDay);

  return {sabaq, sabqi, manzil};
}
