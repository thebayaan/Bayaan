import {SURAHS} from '@/data/surahData';
import {
  getJuzForPage,
  getSurahOfTheDay,
  getSurahForPage,
  getLastReadSurah, // @ai
} from '../quranPages';

describe('getJuzForPage', () => {
  it.each([
    [1, 1],
    [21, 1],
    [22, 2],
    [281, 14],
    [282, 15],
    [581, 29],
    [582, 30],
    [604, 30],
  ])('page %i is in juz %i', (page, juz) => {
    expect(getJuzForPage(page)).toBe(juz);
  });

  it('clamps out of range pages', () => {
    expect(getJuzForPage(0)).toBe(1);
    expect(getJuzForPage(999)).toBe(30);
  });
});

describe('getSurahOfTheDay', () => {
  it('is deterministic for a date', () => {
    const d = new Date(2026, 9, 8);
    expect(getSurahOfTheDay(d).id).toBe(
      getSurahOfTheDay(new Date(2026, 9, 8, 23, 59)).id,
    );
  });

  it('changes day to day', () => {
    expect(getSurahOfTheDay(new Date(2026, 9, 8)).id).not.toBe(
      getSurahOfTheDay(new Date(2026, 9, 9)).id,
    );
  });

  // Local-time constructors keep these independent of the runner's zone.
  // The dates cover the US (Mar 8, Nov 1) and EU (Mar 29, Oct 25) 2026
  // DST transitions, whichever zone the runner is in.
  it('is stable across the day and steps by one across DST changes', () => {
    const transitions: [number, number][] = [
      [2, 8],
      [2, 29],
      [9, 25],
      [10, 1],
    ];
    for (const [month, day] of transitions) {
      const earlyId = getSurahOfTheDay(new Date(2026, month, day, 0, 30)).id;
      expect(getSurahOfTheDay(new Date(2026, month, day, 12, 0)).id).toBe(
        earlyId,
      );
      const before = getSurahOfTheDay(new Date(2026, month, day - 1, 12)).id;
      const after = getSurahOfTheDay(new Date(2026, month, day + 1, 12)).id;
      expect(earlyId).toBe((before % 114) + 1);
      expect(after).toBe((earlyId % 114) + 1);
    }
  });

  it('maps Jan 1 to SURAHS[1]', () => {
    expect(getSurahOfTheDay(new Date(2026, 0, 1, 0, 30)).id).toBe(SURAHS[1].id);
    expect(getSurahOfTheDay(new Date(2026, 0, 1, 23, 30)).id).toBe(
      SURAHS[1].id,
    );
  });
});

describe('getSurahForPage', () => {
  it('maps page 1 to Al-Fatiha and 604 to An-Nas', () => {
    expect(getSurahForPage(1)?.id).toBe(1);
    expect(getSurahForPage(604)?.id).toBeGreaterThanOrEqual(112);
  });
});

// @ai-start
describe('getLastReadSurah', () => {
  // Ya-Sin starts on page 440, which also ends Fatir.
  const YA_SIN = 36;
  const FATIR = 35;

  it('names the surah the reader showed, saved with the page', () => {
    // 604 starts Al-Ikhlas, Al-Falaq and An-Nas; the map can name only one.
    expect(getLastReadSurah(604, 112, {604: 114})?.id).toBe(112);
  });

  it('falls back to the reader page map when no surah was saved', () => {
    expect(getSurahForPage(440)?.id).toBe(FATIR);
    expect(getLastReadSurah(440, null, {440: YA_SIN})?.id).toBe(YA_SIN);
  });

  it('names the same surah while the page map is not loaded', () => {
    expect(getLastReadSurah(440, null, {})?.id).toBe(YA_SIN);
    // A page inside a surah, the first page and the last page.
    expect(getLastReadSurah(30, null, {})?.id).toBe(2);
    expect(getLastReadSurah(1, null, {})?.id).toBe(1);
    expect(getLastReadSurah(604, null, {})?.id).toBe(114);
  });

  it('names every surah on its own first page', () => {
    const startPage = (id: number) =>
      Number(SURAHS[id - 1].pages.split('-')[0]);
    for (const surah of SURAHS) {
      const page = startPage(surah.id);
      expect(getLastReadSurah(page, surah.id, {})?.id).toBe(surah.id);
      // Without a saved surah the page names the last surah to start on
      // it, as the reader's header does.
      const next = SURAHS[surah.id];
      if (!next || startPage(next.id) !== page) {
        expect(getLastReadSurah(page, null, {})?.id).toBe(surah.id);
      }
    }
  });

  it('ignores a saved surah that does not exist', () => {
    expect(getLastReadSurah(604, 0, {604: 113})?.id).toBe(113);
    expect(getLastReadSurah(604, 999, {604: 113})?.id).toBe(113);
  });
});
// @ai-end
