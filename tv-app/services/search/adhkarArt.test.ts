import {
  adhkarGradient,
  countLabel,
  estimateMinutes,
  towardInk,
} from './adhkarArt';
import {ADHKAR_LISTS} from '../../data/adhkarLists';
import {estimateMinutes as listMinutes} from '../adhkarBrowse';
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

  it('estimates minutes the way the Adhkar screen does', () => {
    expect(estimateMinutes([])).toBe(1);
    for (const list of ADHKAR_LISTS) {
      expect(estimateMinutes(adhkarForList(list.id))).toBe(
        listMinutes(list.id),
      );
    }
  });

  it('counts', () => {
    expect(countLabel(1)).toBe('1 dhikr');
    expect(countLabel(24)).toBe('24 adhkar');
  });
});
