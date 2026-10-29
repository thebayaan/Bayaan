// @ai-generated
import {queueFromIndex} from '../queueFromIndex';

describe('queueFromIndex', () => {
  it('keeps the list order and starts at the tapped row', () => {
    expect(queueFromIndex(['a', 'b', 'c', 'd'], 2)).toEqual({
      tracks: ['a', 'b', 'c', 'd'],
      startIndex: 2,
    });
  });

  it('does not wrap the earlier rows after the last one', () => {
    const {tracks, startIndex} = queueFromIndex(['a', 'b', 'c'], 2);
    expect(tracks.slice(startIndex)).toEqual(['c']);
  });

  it('accounts for unplayable rows before the tapped one', () => {
    expect(queueFromIndex(['a', null, 'c', 'd'], 2)).toEqual({
      tracks: ['a', 'c', 'd'],
      startIndex: 1,
    });
  });

  it('starts at the next playable row when the tapped one is unplayable', () => {
    expect(queueFromIndex(['a', 'b', null, 'd'], 2)).toEqual({
      tracks: ['a', 'b', 'd'],
      startIndex: 2,
    });
  });

  it('falls back to the first track when nothing at or after the row plays', () => {
    expect(queueFromIndex(['a', 'b', null], 2)).toEqual({
      tracks: ['a', 'b'],
      startIndex: 0,
    });
  });

  it('handles an empty list', () => {
    expect(queueFromIndex([], 0)).toEqual({tracks: [], startIndex: 0});
  });
});
