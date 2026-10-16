import {
  audioFocusHeldByOther,
  claimAudioFocus,
  releaseAudioFocus,
  resetAudioFocusForTests,
} from './audioFocus';

describe('audioFocus', () => {
  beforeEach(resetAudioFocusForTests);

  it('nobody holds focus at first', () => {
    const a = {onFocusLost: jest.fn()};
    expect(audioFocusHeldByOther(a)).toBe(false);
  });

  it('tells the previous owner when another claims focus', () => {
    const a = {onFocusLost: jest.fn()};
    const b = {onFocusLost: jest.fn()};
    claimAudioFocus(a);
    claimAudioFocus(a);
    expect(a.onFocusLost).not.toHaveBeenCalled();
    claimAudioFocus(b);
    expect(a.onFocusLost).toHaveBeenCalledTimes(1);
    expect(audioFocusHeldByOther(a)).toBe(true);
    expect(audioFocusHeldByOther(b)).toBe(false);
  });

  it('release frees focus only for its holder', () => {
    const a = {onFocusLost: jest.fn()};
    const b = {onFocusLost: jest.fn()};
    claimAudioFocus(a);
    releaseAudioFocus(b);
    expect(audioFocusHeldByOther(b)).toBe(true);
    releaseAudioFocus(a);
    expect(audioFocusHeldByOther(b)).toBe(false);
  });
});
