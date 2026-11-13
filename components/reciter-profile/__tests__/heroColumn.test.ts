// @ai-generated
import {
  HERO_COLUMN_MIN_WINDOW,
  heroColumnTop,
  usesHeroColumn,
} from '../utils/heroColumn';

describe('usesHeroColumn', () => {
  it('pins the hero from the large class, 1280pt', () => {
    expect(HERO_COLUMN_MIN_WINDOW).toBe(1280);
    expect(usesHeroColumn(true, 1280)).toBe(true);
    // iPad Pro 13" and iPad Air 13" in landscape
    expect(usesHeroColumn(true, 1376)).toBe(true);
    expect(usesHeroColumn(true, 1366)).toBe(true);
  });

  it('keeps the hero above the list below 1280pt', () => {
    expect(usesHeroColumn(true, 1279)).toBe(false);
    // iPad Pro 11" landscape, 13" portrait, iPad mini portrait
    expect(usesHeroColumn(true, 1210)).toBe(false);
    expect(usesHeroColumn(true, 1032)).toBe(false);
    expect(usesHeroColumn(true, 744)).toBe(false);
  });

  it('never pins the hero on a phone', () => {
    expect(usesHeroColumn(false, 1280)).toBe(false);
    expect(usesHeroColumn(false, 956)).toBe(false);
  });
});

describe('heroColumnTop', () => {
  it('clears the native header on iOS 26, like the inset it replaces', () => {
    expect(
      heroColumnTop({
        isGlass: true,
        headerHeight: 74,
        safeAreaTop: 24,
        stickyPinOffset: 74,
      }),
    ).toBe(82);
  });

  it('clears the custom navigation buttons without the native header', () => {
    expect(
      heroColumnTop({
        isGlass: false,
        headerHeight: 0,
        safeAreaTop: 24,
        stickyPinOffset: 56,
      }),
    ).toBe(80);
  });

  it('never puts the sticky tab bar above the top of the scroll view', () => {
    // A tall sticky title (a large text size) must not give the sticky
    // section a negative layout y.
    const stickyPinOffset = 120;
    const top = heroColumnTop({
      isGlass: false,
      headerHeight: 0,
      safeAreaTop: 24,
      stickyPinOffset,
    });
    expect(top - stickyPinOffset).toBeGreaterThanOrEqual(0);
  });
});
