import {SURAHS} from '@/data/surahData';
import {getJuzForPage, getSurahOfTheDay, getSurahForPage} from '../quranPages';

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
