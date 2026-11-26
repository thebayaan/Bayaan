// @ai-generated
import {heroColumnTop, usesHeroColumn} from '../utils/heroColumn';

describe('usesHeroColumn', () => {
  // The profile's own width: the window less the sidebar or the rail, or
  // the capped column. The list beside a 448pt column needs 720pt for the
  // Revelation and Verses table.
  it.each([
    ['the Collection column, any window', 720, false],
    ['an 11" iPad in landscape with the labelled sidebar', 970, false],
    ['a 1000pt pane', 1000, false],
    ['a 13" iPad in landscape with the labelled sidebar', 1096, false],
    ['an 11" iPad in landscape with the sidebar collapsed', 1122, false],
    ['one point under the table width beside the column', 1167, false],
    ['exactly the table width beside the column', 1168, true],
    ['a 13" iPad in landscape with the sidebar collapsed', 1288, true],
    ['a large external display with the labelled sidebar', 1640, true],
  ])('%s (%ipt): %s', (_name, width, pinned) => {
    expect(usesHeroColumn(true, width)).toBe(pinned);
  });

  it('never pins the hero on a phone', () => {
    expect(usesHeroColumn(false, 1288)).toBe(false);
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
