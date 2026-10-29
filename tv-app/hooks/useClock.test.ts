import {formatClockTime, formatWeekday, msUntilNextMinute} from './useClock';

describe('clock formatting', () => {
  it('formats 12-hour time', () => {
    expect(formatClockTime(new Date(2026, 9, 16, 21, 12))).toBe('9:12 PM');
    expect(formatClockTime(new Date(2026, 9, 17, 6, 41))).toBe('6:41 AM');
    expect(formatClockTime(new Date(2026, 9, 17, 0, 5))).toBe('12:05 AM');
    expect(formatClockTime(new Date(2026, 9, 17, 12, 0))).toBe('12:00 PM');
  });

  it('names the weekday', () => {
    expect(formatWeekday(new Date(2026, 9, 16))).toBe('Friday');
    expect(formatWeekday(new Date(2026, 9, 17))).toBe('Saturday');
  });

  it('waits until the next minute', () => {
    expect(msUntilNextMinute(new Date(2026, 9, 16, 9, 0, 0, 0))).toBe(60000);
    expect(msUntilNextMinute(new Date(2026, 9, 16, 9, 0, 59, 500))).toBe(500);
  });
});
