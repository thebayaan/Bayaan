// @ai-start
import {
  clampToClip,
  clipProgress,
  formatClipTime,
  followsSeek,
  ratioToClipMs,
  xToClipMs,
  xToRatio,
} from '../scrub';

const clip = {startMs: 10_000, endMs: 40_000};

describe('formatClipTime', () => {
  it('formats minutes and zero-padded seconds', () => {
    expect(formatClipTime(0)).toBe('0:00');
    expect(formatClipTime(7_000)).toBe('0:07');
    expect(formatClipTime(65_000)).toBe('1:05');
    expect(formatClipTime(600_000)).toBe('10:00');
  });

  it('rounds down to the second', () => {
    expect(formatClipTime(999)).toBe('0:00');
    expect(formatClipTime(59_999)).toBe('0:59');
  });

  it('adds hours for long durations', () => {
    expect(formatClipTime(3_725_000)).toBe('1:02:05');
  });

  it('treats negative and invalid values as zero', () => {
    expect(formatClipTime(-5_000)).toBe('0:00');
    expect(formatClipTime(NaN)).toBe('0:00');
  });
});

describe('clampToClip', () => {
  it('keeps positions inside the clip', () => {
    expect(clampToClip(5_000, clip)).toBe(10_000);
    expect(clampToClip(25_000, clip)).toBe(25_000);
    expect(clampToClip(50_000, clip)).toBe(40_000);
    expect(clampToClip(NaN, clip)).toBe(10_000);
  });
});

describe('clipProgress', () => {
  it('maps the clip to 0..1 and clamps', () => {
    expect(clipProgress(10_000, clip)).toBe(0);
    expect(clipProgress(25_000, clip)).toBe(0.5);
    expect(clipProgress(40_000, clip)).toBe(1);
    expect(clipProgress(0, clip)).toBe(0);
    expect(clipProgress(99_000, clip)).toBe(1);
  });

  it('is 0 for an empty clip', () => {
    expect(clipProgress(5, {startMs: 5, endMs: 5})).toBe(0);
  });
});

describe('xToRatio', () => {
  it('maps x along the bar and clamps', () => {
    expect(xToRatio(0, 200)).toBe(0);
    expect(xToRatio(50, 200)).toBe(0.25);
    expect(xToRatio(200, 200)).toBe(1);
    expect(xToRatio(-20, 200)).toBe(0);
    expect(xToRatio(260, 200)).toBe(1);
  });

  it('is 0 before the bar has been measured', () => {
    expect(xToRatio(50, 0)).toBe(0);
    expect(xToRatio(NaN, 200)).toBe(0);
  });
});

describe('xToClipMs', () => {
  it('maps x to a position in the clip', () => {
    expect(xToClipMs(0, 300, clip)).toBe(10_000);
    expect(xToClipMs(150, 300, clip)).toBe(25_000);
    expect(xToClipMs(300, 300, clip)).toBe(40_000);
  });

  it('clamps touches past either end to the clip range', () => {
    expect(xToClipMs(-40, 300, clip)).toBe(10_000);
    expect(xToClipMs(420, 300, clip)).toBe(40_000);
  });

  it('agrees with ratioToClipMs', () => {
    expect(ratioToClipMs(0.1, clip)).toBe(xToClipMs(30, 300, clip));
    expect(ratioToClipMs(2, clip)).toBe(40_000);
  });
});

describe('followsSeek', () => {
  it('accepts the target and positions playback could have reached', () => {
    expect(followsSeek(30_000, 30_000, 0)).toBe(true);
    expect(followsSeek(29_500, 30_000, 0)).toBe(true);
    expect(followsSeek(31_000, 30_000, 500)).toBe(true);
  });

  it('rejects stale updates from before a forward seek', () => {
    expect(followsSeek(12_000, 30_000, 100)).toBe(false);
    expect(followsSeek(29_000, 30_000, 100, 500)).toBe(false);
  });

  it('rejects stale updates from before a backward seek', () => {
    expect(followsSeek(35_000, 15_000, 200)).toBe(false);
    expect(followsSeek(16_000, 15_000, 200)).toBe(true);
  });
});
// @ai-end
