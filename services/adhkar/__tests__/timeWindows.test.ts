import {
  adhkarWindowAt,
  nextWindowBoundaryAfter,
} from '@/services/adhkar/timeWindows';

function at(h: number, m = 0, day = 13): number {
  return new Date(2026, 9, day, h, m).getTime();
}

describe('adhkarWindowAt', () => {
  it.each([
    [3, 59, 'evening'],
    [4, 0, 'morning'],
    [14, 59, 'morning'],
    [15, 0, 'evening'],
  ] as const)('%i:%i is %s', (h, m, expected) => {
    expect(adhkarWindowAt(at(h, m))).toBe(expected);
  });
});

describe('nextWindowBoundaryAfter', () => {
  it('10:00 -> 15:00 same day', () => {
    expect(nextWindowBoundaryAfter(at(10))).toBe(at(15));
  });
  it('20:00 -> 04:00 next day', () => {
    expect(nextWindowBoundaryAfter(at(20))).toBe(at(4, 0, 14));
  });
  it('02:00 -> 04:00 same day', () => {
    expect(nextWindowBoundaryAfter(at(2))).toBe(at(4));
  });
  it('exactly 15:00 -> 04:00 next day (strictly after)', () => {
    expect(nextWindowBoundaryAfter(at(15))).toBe(at(4, 0, 14));
  });
});
