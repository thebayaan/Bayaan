import pendingFixture from '../__fixtures__/tasbeeh.pending.json';
import {
  localDayKey,
  mergeTasbeehIncrements,
  parsePendingTasbeeh,
  planTasbeehOps,
} from '../tasbeeh';

describe('localDayKey', () => {
  it('formats local date with zero padding', () => {
    expect(localDayKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });
});

describe('mergeTasbeehIncrements', () => {
  it('sums increments per dhikr for today only', () => {
    expect(
      mergeTasbeehIncrements(
        [
          {dhikrId: 'a', count: 3, day: '2026-10-08'},
          {dhikrId: 'a', count: 2, day: '2026-10-08'},
          {dhikrId: 'b', count: 9, day: '2026-10-07'},
          {dhikrId: 'c', count: -4, day: '2026-10-08'},
        ],
        '2026-10-08',
      ),
    ).toEqual({a: 5});
  });
});

describe('parsePendingTasbeeh', () => {
  it('ignores malformed json and entries', () => {
    expect(parsePendingTasbeeh('x')).toEqual([]);
    expect(
      parsePendingTasbeeh(JSON.stringify([{dhikrId: 'a', count: 1}])),
    ).toEqual([]);
  });
});

describe('planTasbeehOps', () => {
  it('applies a reset, then the later taps, for today only', () => {
    const pending = parsePendingTasbeeh(JSON.stringify(pendingFixture));
    expect(pending).toHaveLength(4);
    expect(planTasbeehOps(pending, '2026-10-10')).toEqual({
      '91': {reset: true, increments: 2},
    });
  });

  it('sums taps without a reset', () => {
    expect(
      planTasbeehOps(
        [
          {dhikrId: 'a', count: 1, day: 'd'},
          {dhikrId: 'a', count: 4, day: 'd'},
          {dhikrId: 'b', count: 0, day: 'd'},
        ],
        'd',
      ),
    ).toEqual({a: {reset: false, increments: 5}});
  });
});

describe('parsePendingTasbeeh reset flag', () => {
  it('rejects a non boolean reset', () => {
    expect(
      parsePendingTasbeeh(
        JSON.stringify([{dhikrId: 'a', count: 0, day: 'd', reset: 'yes'}]),
      ),
    ).toEqual([]);
  });
});
