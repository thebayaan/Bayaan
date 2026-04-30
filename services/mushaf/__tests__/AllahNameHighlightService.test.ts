jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import {
  getTextAllahNameCharMap,
  wordContainsAllahName,
} from '../AllahNameHighlightService';

function getHighlightedText(text: string): string[] {
  const map = getTextAllahNameCharMap(text);
  if (!map) return [];

  const groups: string[] = [];
  let current = '';
  let previousIndex = -2;

  for (const index of [...map.keys()].sort((a, b) => a - b)) {
    if (index !== previousIndex + 1 && current) {
      groups.push(current);
      current = '';
    }
    current += text.charAt(index);
    previousIndex = index;
  }

  if (current) groups.push(current);
  return groups;
}

describe('AllahNameHighlightService', () => {
  it('matches common Allah-name forms', () => {
    expect(wordContainsAllahName('اللّٰهِ')).toBe(true);
    expect(wordContainsAllahName('بِاللّٰهِ')).toBe(true);
    expect(wordContainsAllahName('تَاللّٰهِ')).toBe(true);
    expect(wordContainsAllahName('اللَّهُمَّ')).toBe(true);
  });

  it('highlights only the Allah-name span inside prefixed words', () => {
    expect(getHighlightedText('بِاللّٰهِ')).toEqual(['اللّٰهِ']);
    expect(getHighlightedText('تَاللّٰهِ')).toEqual(['اللّٰهِ']);
    expect(getHighlightedText('لِلّٰهِ')).toEqual(['لّٰهِ']);
  });

  it('includes the meem in اللهم', () => {
    expect(getHighlightedText('اللَّهُمَّ')).toEqual(['اللَّهُمَّ']);
  });
});
