import {playCountsFromDailyListening} from '../personalized';

const MINUTE = 60_000;

describe('playCountsFromDailyListening', () => {
  it('counts the days each surah got at least a minute of listening', () => {
    const counts = playCountsFromDailyListening([
      {date: '2026-10-01', surahs: {'18': 20 * MINUTE, '36': 30_000}},
      {date: '2026-10-03', surahs: {'18': MINUTE, '36': 5 * MINUTE}},
      {date: '2026-10-02', surahs: {'18': 3 * MINUTE}},
    ]);
    expect(counts).toEqual([
      {
        surahId: 18,
        count: 3,
        lastPlayed: new Date(2026, 9, 3).getTime(),
      },
      {
        surahId: 36,
        count: 1,
        lastPlayed: new Date(2026, 9, 3).getTime(),
      },
    ]);
  });

  it('skips malformed dates and surah ids', () => {
    expect(
      playCountsFromDailyListening([
        {date: 'not-a-date', surahs: {'18': 10 * MINUTE}},
        {date: '2026-10-01', surahs: {abc: 10 * MINUTE}},
      ]),
    ).toEqual([]);
  });
});
