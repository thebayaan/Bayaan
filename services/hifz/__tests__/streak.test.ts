import {DAY_MS} from '../strength';
import {recitationStreak, todaysAyat} from '../streak';

// Noon UTC on 10 Nov 2026; the reader's clock is UTC+3 (offset -180).
const NOW = Date.UTC(2026, 10, 10, 12);
const TZ = -180;
const daysAgo = (n: number) => ({
  startedAt: NOW - n * DAY_MS,
  ayat: [{surah: 1, ayah: 1}],
});

describe('recitationStreak', () => {
  it('counts consecutive days', () => {
    expect(
      recitationStreak([daysAgo(0), daysAgo(1), daysAgo(2)], NOW, TZ),
    ).toEqual({days: 3, recitedToday: true});
  });

  it('forgives one missed day in a week', () => {
    expect(
      recitationStreak(
        [daysAgo(0), daysAgo(1), daysAgo(3), daysAgo(4)],
        NOW,
        TZ,
      ).days,
    ).toBe(4);
  });

  it('two missed days in a week end the streak', () => {
    expect(
      recitationStreak(
        [daysAgo(0), daysAgo(1), daysAgo(3), daysAgo(5)],
        NOW,
        TZ,
      ).days,
    ).toBe(3);
    expect(recitationStreak([daysAgo(0), daysAgo(3)], NOW, TZ).days).toBe(1);
  });

  it('before reciting today, the run up to yesterday still counts', () => {
    expect(recitationStreak([daysAgo(1), daysAgo(2)], NOW, TZ)).toEqual({
      days: 2,
      recitedToday: false,
    });
  });

  it('takes that recited no ayah do not count', () => {
    expect(recitationStreak([{startedAt: NOW, ayat: []}], NOW, TZ)).toEqual({
      days: 0,
      recitedToday: false,
    });
  });

  it("uses the reader's local day", () => {
    // 22:30 UTC is already the next day at UTC+3.
    const late = Date.UTC(2026, 10, 9, 22, 30);
    expect(
      recitationStreak(
        [{startedAt: late, ayat: [{surah: 1, ayah: 1}]}],
        NOW,
        TZ,
      ).recitedToday,
    ).toBe(true);
  });
});

describe('todaysAyat', () => {
  it("sums only today's takes", () => {
    const takes = [
      {
        startedAt: NOW,
        ayat: [
          {surah: 1, ayah: 1},
          {surah: 1, ayah: 2},
        ],
      },
      {startedAt: NOW - 1000, ayat: [{surah: 2, ayah: 1}]},
      {startedAt: NOW - DAY_MS, ayat: [{surah: 3, ayah: 1}]},
    ];
    expect(todaysAyat(takes, NOW, TZ)).toBe(3);
  });
});
