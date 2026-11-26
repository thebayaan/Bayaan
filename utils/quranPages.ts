import {SURAHS, Surah} from '@/data/surahData';

// First page of each juz in the 604-page Madani layout used by Digital Khatt.
const JUZ_START_PAGES: readonly number[] = [
  1, 22, 42, 62, 82, 102, 121, 142, 162, 182, 201, 222, 242, 262, 282, 302, 322,
  342, 362, 382, 402, 422, 442, 462, 482, 502, 522, 542, 562, 582,
];

export function getJuzForPage(page: number): number {
  let juz = 1;
  for (let i = 0; i < JUZ_START_PAGES.length; i++) {
    if (page >= JUZ_START_PAGES[i]) juz = i + 1;
  }
  return juz;
}

export function getSurahOfTheDay(date: Date): Surah {
  // Compare calendar days in UTC so DST transitions don't shift the index.
  const startOfYear = Date.UTC(date.getFullYear(), 0, 0);
  const today = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const dayOfYear = Math.floor((today - startOfYear) / (1000 * 60 * 60 * 24));
  return SURAHS[dayOfYear % 114];
}

export function getSurahForPage(page: number): Surah | undefined {
  return SURAHS.find(s => {
    const [start, end] = s.pages.split('-').map(Number);
    return page >= start && page <= end;
  });
}

// @ai-start
/**
 * The surah "Continue reading" names for the last-read page.
 *
 * `savedSurahId` is the surah the reader's header showed there (saved with
 * the page). Installs from before it was saved have a page alone: for those
 * `pageToSurah`, the reader's own page → surah map, gives the surah its
 * header shows for the page (the last one to start on or before it). While
 * that map is still loading (the mushaf data loads in the background at
 * launch) the bundled surah list gives the same answer.
 *
 * It used to be the first surah on the page: the surah before, for the 58
 * surahs that start mid-page (Ya-Sin's first page was called Fatir).
 */
export function getLastReadSurah(
  page: number,
  savedSurahId: number | null,
  pageToSurah: Readonly<Record<number, number>>,
): Surah | undefined {
  const byId = (id: number | null | undefined): Surah | undefined =>
    id ? SURAHS[id - 1] : undefined;
  const named = byId(savedSurahId) ?? byId(pageToSurah[page]);
  if (named) return named;
  let lastStarted: Surah | undefined;
  for (const surah of SURAHS) {
    if (Number(surah.pages.split('-')[0]) <= page) lastStarted = surah;
  }
  return lastStarted;
}
// @ai-end
