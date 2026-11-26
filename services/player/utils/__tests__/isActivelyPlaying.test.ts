// @ai-generated
import {isActivelyPlaying} from '../isActivelyPlaying';
import type {PlayerState} from '../../types/state';

describe('isActivelyPlaying', () => {
  it('counts a stalled stream as playing', () => {
    expect(isActivelyPlaying('playing')).toBe(true);
    expect(isActivelyPlaying('buffering')).toBe(true);
  });

  it('counts nothing else as playing', () => {
    const others: PlayerState[] = [
      'none',
      'loading',
      'ready',
      'paused',
      'stopped',
      'ended',
      'error',
    ];
    for (const state of others) {
      expect(isActivelyPlaying(state)).toBe(false);
    }
  });
});
