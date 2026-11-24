// @ai-generated
import {MIN_FEATURED_VERSES, reciterOfTheDaySurah} from '../reciterOfTheDay';

// Verse counts for a few surahs: Al-Baqarah 286, Al-Kahf 110, Ya-Sin 83,
// Al-Mulk 30, Al-Ikhlas 4.
const VERSES: Record<number, number> = {
  2: 286,
  18: 110,
  36: 83,
  67: 30,
  112: 4,
};
const verses = (id: number) => VERSES[id];

describe('reciterOfTheDaySurah', () => {
  it('never picks a short surah', () => {
    for (let day = 0; day < 60; day++) {
      const pick = reciterOfTheDaySurah(
        [2, 18, 36, 67, 112],
        verses,
        new Date(2026, 10, 1 + day, 12),
      );
      expect(VERSES[pick as number]).toBeGreaterThanOrEqual(
        MIN_FEATURED_VERSES,
      );
    }
  });

  it('keeps the same surah all day and changes across days', () => {
    const ids = [2, 18, 36];
    const morning = reciterOfTheDaySurah(
      ids,
      verses,
      new Date(2026, 10, 24, 6),
    );
    const night = reciterOfTheDaySurah(ids, verses, new Date(2026, 10, 24, 23));
    expect(morning).toBe(night);
    const week = new Set(
      Array.from({length: 7}, (_, d) =>
        reciterOfTheDaySurah(ids, verses, new Date(2026, 10, 24 + d, 12)),
      ),
    );
    expect(week.size).toBeGreaterThan(1);
  });

  it('has nothing to offer a reciter with only short surahs', () => {
    expect(reciterOfTheDaySurah([67, 112], verses, new Date())).toBeNull();
  });
});
