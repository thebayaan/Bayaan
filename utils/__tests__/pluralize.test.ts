import {formatCount} from '../pluralize';

describe('formatCount', () => {
  it.each([
    [0, 'bookmark', '0 bookmarks'],
    [1, 'bookmark', '1 bookmark'],
    [2, 'note', '2 notes'],
    [1, 'highlight', '1 highlight'],
  ])('formats %d %s as %s', (count, singular, expected) => {
    expect(formatCount(count, singular)).toBe(expected);
  });

  it('uses an explicit irregular plural', () => {
    expect(formatCount(3, 'entry', 'entries')).toBe('3 entries');
    expect(formatCount(1, 'entry', 'entries')).toBe('1 entry');
  });
});
