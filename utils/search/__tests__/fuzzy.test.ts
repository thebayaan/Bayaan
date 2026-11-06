// @ai-generated
import {damerauLevenshtein, maxEditsFor} from '../fuzzy';

describe('damerauLevenshtein', () => {
  it.each([
    ['mishary', 'mishary', 0],
    ['mishray', 'mishary', 1], // transposition
    ['fatiha', 'fatihah', 1], // insertion
    ['kahf', 'kahd', 1], // substitution
    ['baqara', 'bqara', 1], // deletion
  ])('%s vs %s = %i', (a, b, expected) => {
    expect(damerauLevenshtein(a, b, 3)).toBe(expected);
  });

  it('stops early and returns max + 1 when over budget', () => {
    expect(damerauLevenshtein('abcdef', 'uvwxyz', 2)).toBe(3);
    expect(damerauLevenshtein('a', 'abcdef', 2)).toBe(3);
  });
});

describe('maxEditsFor', () => {
  it.each([
    [1, 0],
    [3, 0],
    [4, 1],
    [6, 1],
    [7, 2],
    [20, 2],
  ])('length %i allows %i edits', (length, edits) => {
    expect(maxEditsFor(length)).toBe(edits);
  });
});
