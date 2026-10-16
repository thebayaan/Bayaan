import {
  adhkarGradient,
  countLabel,
  estimateMinutes,
  towardInk,
} from './adhkarArt';
import {ADHKAR_LISTS} from '../../data/adhkarLists';
import {adhkarForList} from '../adhkarData';

describe('adhkarArt', () => {
  it('mixes toward ink', () => {
    expect(towardInk('#ffffff', 1)).toBe('#ffffff');
    expect(towardInk('#ffffff', 0)).toBe('#06151c');
  });

  it('gives every list a two-stop gradient of hex colours', () => {
    for (const list of ADHKAR_LISTS) {
      const [a, b] = adhkarGradient(list);
      expect(a).toMatch(/^#[0-9a-f]{6}$/);
      expect(b).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('estimates minutes from words and repeats', () => {
    expect(estimateMinutes([])).toBe(1);
    expect(estimateMinutes([{arabic: 'a b c d', repeatCount: 60}])).toBe(2);
    const morning = estimateMinutes(adhkarForList('morning-adhkar'));
    expect(morning).toBeGreaterThan(3);
    expect(morning).toBeLessThan(60);
  });

  it('counts', () => {
    expect(countLabel(1)).toBe('1 dhikr');
    expect(countLabel(24)).toBe('24 adhkar');
  });
});
