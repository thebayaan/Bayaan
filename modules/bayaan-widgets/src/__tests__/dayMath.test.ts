import {ayahOfTheDayIndex, localDayNumber} from '../dayMath';

// Same vectors as WidgetLogic.swift (check-widget-fixtures.sh) and DayMath.kt.
describe('localDayNumber', () => {
  it('counts days to the local calendar date', () => {
    expect(localDayNumber(new Date(1970, 0, 1, 12))).toBe(0);
    expect(localDayNumber(new Date(2026, 9, 10, 0, 1))).toBe(20736);
    expect(localDayNumber(new Date(2026, 9, 10, 23, 59))).toBe(20736);
    expect(localDayNumber(new Date(2026, 9, 11, 0, 1))).toBe(20737);
    expect(localDayNumber(new Date(2024, 1, 29, 12))).toBe(19782);
    expect(localDayNumber(new Date(1969, 11, 31, 12))).toBe(-1);
  });
});

describe('ayahOfTheDayIndex', () => {
  it('cycles through the list by day', () => {
    expect(ayahOfTheDayIndex(new Date(2026, 9, 10, 8), 390)).toBe(66);
    expect(ayahOfTheDayIndex(new Date(2026, 9, 11, 8), 390)).toBe(67);
    expect(ayahOfTheDayIndex(new Date(2024, 1, 29, 8), 390)).toBe(282);
    expect(ayahOfTheDayIndex(new Date(1969, 11, 31, 8), 390)).toBe(389);
  });

  it('returns -1 for an empty list', () => {
    expect(ayahOfTheDayIndex(new Date(2026, 9, 10), 0)).toBe(-1);
  });
});
