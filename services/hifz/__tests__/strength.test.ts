import {DAY_MS, pageStrength} from '../strength';

const DAY0 = Date.UTC(2026, 10, 1, 9);
const day = (n: number, hour = 0) => DAY0 + n * DAY_MS + hour * 3_600_000;

describe('pageStrength', () => {
  it('no visits is unseen and due now', () => {
    expect(pageStrength([], day(0))).toEqual({
      level: 'unseen',
      intervalDays: 0,
      lastAt: null,
      dueAt: day(0),
    });
  });

  it('a clean take on a new day doubles the interval', () => {
    const state = pageStrength(
      [
        {at: day(0), clean: true},
        {at: day(1), clean: true},
        {at: day(3), clean: true},
      ],
      day(3),
    );
    expect(state.intervalDays).toBe(4);
    expect(state.dueAt).toBe(day(3) + 4 * DAY_MS);
  });

  it('a take with flags or peeks resets the interval', () => {
    const state = pageStrength(
      [
        {at: day(0), clean: true},
        {at: day(1), clean: true},
        {at: day(3), clean: false},
      ],
      day(3),
    );
    expect(state).toMatchObject({intervalDays: 1, level: 'weak'});
  });

  it('clean repeats on the same day do not grow the interval', () => {
    const state = pageStrength(
      [
        {at: day(0, 1), clean: true},
        {at: day(0, 5), clean: true},
      ],
      day(0, 6),
    );
    expect(state.intervalDays).toBe(1);
  });

  it('the interval stops at 30 days, and long intervals are strong', () => {
    const visits = Array.from({length: 8}, (_, i) => ({
      at: day(i * 31),
      clean: true,
    }));
    expect(pageStrength(visits, day(300))).toMatchObject({
      intervalDays: 30,
      level: 'strong',
    });
  });
});
