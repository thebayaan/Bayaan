import {computeScaleFactor, scale, scaleFactor, scaleStyle} from './scale';

describe('computeScaleFactor', () => {
  it('is 1 for a tvOS 1080p window (1920x1080 points)', () => {
    expect(computeScaleFactor(1920, 1080)).toBe(1);
  });

  it('is 0.5 for an Android TV 1080p window (960x540 dp)', () => {
    expect(computeScaleFactor(960, 540)).toBe(0.5);
  });

  it('uses the tighter axis so non-16:9 windows never overflow', () => {
    expect(computeScaleFactor(1920, 540)).toBe(0.5);
  });

  it('falls back to 1 for an unmeasured window', () => {
    expect(computeScaleFactor(0, 0)).toBe(1);
  });
});

describe('scaleStyle', () => {
  it('scales length keys and leaves unitless keys alone', () => {
    const out = scaleStyle({
      width: 200,
      fontSize: 20,
      opacity: 0.5,
      flex: 1,
      zIndex: 3,
      fontWeight: '700',
      width2: 10,
    });
    expect(out).toEqual({
      width: scale(200),
      fontSize: scale(20),
      opacity: 0.5,
      flex: 1,
      zIndex: 3,
      fontWeight: '700',
      width2: 10,
    });
  });

  it('leaves percentage strings untouched', () => {
    expect(scaleStyle({width: '100%'})).toEqual({width: '100%'});
  });

  it('scales shadowOffset members and translate transforms but not scale', () => {
    const out = scaleStyle({
      shadowOffset: {width: 0, height: 8},
      transform: [{translateY: 10}, {scale: 1.05}],
    });
    expect(out).toEqual({
      shadowOffset: {width: 0, height: 8 * scaleFactor},
      transform: [{translateY: 10 * scaleFactor}, {scale: 1.05}],
    });
  });
});
