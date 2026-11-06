import {SURAHS} from '@/data/surahData';
import {digitalKhattDataService} from '@/services/mushaf/DigitalKhattDataService';
import {recitationLogDatabase} from '@/services/recitation/RecitationLogDatabase';
import {pageStates, pageVisits} from './pageProgress';
import type {PlanData} from './plan';
import {DAY_MS, type PageState} from './strength';

// Reads the recitation log into page states for the hifz screens.

/** Takes older than this no longer shape revision. */
const HISTORY_DAYS = 180;

function pagesOfSurah(surah: number): number[] {
  const range = SURAHS[surah - 1]?.pages;
  if (!range) return [];
  const [first, last] = range.split('-').map(Number);
  const pages: number[] = [];
  for (let page = first; page <= (last || first); page++) pages.push(page);
  return pages;
}

export const PLAN_DATA: PlanData = {
  pagesOfSurah,
  pageOf: key => digitalKhattDataService.getPageForVerse(key),
  ayahCount: surah => SURAHS[surah - 1]?.verses_count ?? 0,
};

export async function loadPageStates(
  now: number = Date.now(),
): Promise<Map<number, PageState>> {
  const [takes, dismissed] = await Promise.all([
    recitationLogDatabase.takesSince(now - HISTORY_DAYS * DAY_MS),
    recitationLogDatabase.dismissedKeys(),
  ]);
  return pageStates(pageVisits(takes, dismissed, PLAN_DATA.pageOf), now);
}
