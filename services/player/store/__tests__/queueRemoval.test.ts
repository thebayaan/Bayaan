/**
 * @ai Unit tests for computeQueueRemoval(), the pure part of
 * removeFromQueue(). The queue is a list of ids; the helper does not care
 * what a track is.
 */
import {computeQueueRemoval} from '../queueRemoval';

const queue = ['a', 'b', 'c', 'd', 'e'];

/** Remove `indices` from `tracks` (default: a to e) that plays `current`. */
function remove(
  current: number,
  indices: number[],
  tracks: readonly string[] = queue,
) {
  return computeQueueRemoval({tracks, currentIndex: current}, indices);
}

describe('computeQueueRemoval', () => {
  describe('the current track stays', () => {
    it('removes a track after the current one: the index does not move', () => {
      expect(remove(1, [3])).toEqual({
        tracks: ['a', 'b', 'c', 'e'],
        index: 1,
        outcome: 'currentUnchanged',
      });
    });

    it('removes tracks before the current one: the index moves back by each', () => {
      expect(remove(3, [0, 2])).toEqual({
        tracks: ['b', 'd', 'e'],
        index: 1,
        outcome: 'currentUnchanged',
      });
    });

    it('removes tracks on both sides of the current one', () => {
      expect(remove(2, [4, 0, 3])).toEqual({
        tracks: ['b', 'c'],
        index: 1,
        outcome: 'currentUnchanged',
      });
    });

    it('removes nothing when the indices are empty', () => {
      expect(remove(2, [])).toEqual({
        tracks: queue,
        index: 2,
        outcome: 'currentUnchanged',
      });
    });
  });

  describe('the current track goes', () => {
    it('the next track takes its place', () => {
      expect(remove(1, [1])).toEqual({
        tracks: ['a', 'c', 'd', 'e'],
        index: 1,
        outcome: 'newCurrent',
      });
    });

    it('the next track that stays takes its place, past the other removals', () => {
      expect(remove(1, [0, 1, 2])).toEqual({
        tracks: ['d', 'e'],
        index: 0,
        outcome: 'newCurrent',
      });
    });

    it('at the end of the queue, the track before it takes its place', () => {
      expect(remove(4, [4])).toEqual({
        tracks: ['a', 'b', 'c', 'd'],
        index: 3,
        outcome: 'newCurrent',
      });
    });

    it('at the end of the queue, the last track that stays before it takes its place', () => {
      expect(remove(4, [2, 3, 4])).toEqual({
        tracks: ['a', 'b'],
        index: 1,
        outcome: 'newCurrent',
      });
    });

    it('the order of the indices does not matter', () => {
      expect(remove(2, [2, 0])).toEqual(remove(2, [0, 2]));
    });
  });

  describe('no track is left', () => {
    it('removes the only track', () => {
      expect(remove(0, [0], ['a'])).toEqual({
        tracks: [],
        index: 0,
        outcome: 'emptied',
      });
    });

    it('removes every track, the current one too', () => {
      expect(remove(3, [0, 1, 2, 3, 4])).toEqual({
        tracks: [],
        index: 0,
        outcome: 'emptied',
      });
    });
  });

  describe('indices that remove nothing', () => {
    it('an index out of range does nothing', () => {
      expect(remove(1, [-1, 5, 99])).toEqual({
        tracks: queue,
        index: 1,
        outcome: 'currentUnchanged',
      });
    });

    it('a repeated index removes one track', () => {
      expect(remove(0, [2, 2])).toEqual({
        tracks: ['a', 'b', 'd', 'e'],
        index: 0,
        outcome: 'currentUnchanged',
      });
    });

    it('an empty queue stays empty and is not "emptied"', () => {
      expect(remove(0, [0], [])).toEqual({
        tracks: [],
        index: 0,
        outcome: 'currentUnchanged',
      });
    });
  });

  it('does not change the queue that it reads', () => {
    const tracks = [...queue];
    remove(1, [1, 3], tracks);
    expect(tracks).toEqual(queue);
  });
});
