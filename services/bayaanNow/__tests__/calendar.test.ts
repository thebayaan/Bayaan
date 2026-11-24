// @ai-generated
import {fromHijri, toHijri} from '../calendar';

describe('toHijri', () => {
  it('matches the 1447 dates', () => {
    expect(toHijri(new Date(2026, 1, 18, 12))).toEqual({
      year: 1447,
      month: 9,
      day: 1,
    });
    expect(toHijri(new Date(2026, 4, 26, 12))).toEqual({
      year: 1447,
      month: 12,
      day: 9,
    });
    expect(toHijri(new Date(2026, 5, 17, 12))).toEqual({
      year: 1448,
      month: 1,
      day: 1,
    });
  });

  it('starts the next day at 6 PM unless kept by day', () => {
    const evening = new Date(2026, 4, 26, 19);
    expect(toHijri(evening).day).toBe(10);
    expect(toHijri(evening, true).day).toBe(9);
  });

  it('turns back into the same date', () => {
    for (const [y, m, d] of [
      [1448, 9, 27],
      [1449, 1, 10],
      [1450, 12, 9],
    ]) {
      expect(toHijri(fromHijri(y, m, d), true)).toEqual({
        year: y,
        month: m,
        day: d,
      });
    }
  });
});
