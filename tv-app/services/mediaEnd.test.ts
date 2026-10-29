import {isEndOfMediaPause} from './mediaEnd';

describe('isEndOfMediaPause', () => {
  it('treats the pause fired at the end of a track as the end', () => {
    expect(isEndOfMediaPause(59.8, 60)).toBe(true);
    expect(isEndOfMediaPause(60, 60)).toBe(true);
    expect(isEndOfMediaPause(12, 60, true)).toBe(true);
  });

  it('keeps a real pause mid-track, and one before the duration is known', () => {
    expect(isEndOfMediaPause(30, 60)).toBe(false);
    expect(isEndOfMediaPause(0, 0)).toBe(false);
  });
});
