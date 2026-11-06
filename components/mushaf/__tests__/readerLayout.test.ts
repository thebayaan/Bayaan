// @ai-generated
import {
  getMushafLayout,
  readerListKey,
  readingColumnPadding,
  singlePageLayout,
} from '../constants';

const insets = {top: 24, bottom: 20, left: 0, right: 0};

describe('singlePageLayout', () => {
  it('centres one page where the pager shows a spread', () => {
    const spread = getMushafLayout({
      width: 1376,
      height: 1032,
      isTablet: true,
      insets,
    });
    expect(spread.facingPages).toBe(true);
    const single = singlePageLayout(spread);
    expect(single.facingPages).toBe(false);
    expect(single.facingGap).toBe(0);
    expect(single.pageOffsetX).toBe((1376 - spread.pageWidth) / 2);
    // Same page size as each half of the spread, so the text matches.
    expect(single.pageWidth).toBe(spread.pageWidth);
    expect(single.contentWidth).toBe(spread.contentWidth);
  });

  it('leaves single-page layouts as they are', () => {
    const portrait = getMushafLayout({
      width: 1032,
      height: 1376,
      isTablet: true,
      insets,
    });
    expect(singlePageLayout(portrait)).toBe(portrait);
    const phone = getMushafLayout({width: 393, height: 852, isTablet: false});
    expect(singlePageLayout(phone)).toBe(phone);
  });
});

describe('readerListKey', () => {
  it('changes with the item width and with what the list shows', () => {
    expect(readerListKey('pages', 1032)).not.toBe(readerListKey('pages', 900));
    expect(readerListKey('pages', 1376)).not.toBe(
      readerListKey('spreads', 1376),
    );
  });

  it('ignores sub-point differences', () => {
    expect(readerListKey('pages', 1032.2)).toBe(readerListKey('pages', 1032));
  });
});

describe('readingColumnPadding', () => {
  it('centres a 680pt column in a wide pane', () => {
    expect(readingColumnPadding(1376, 16)).toBe(348);
    expect(readingColumnPadding(1032, 16)).toBe(176);
  });

  it('keeps the minimum padding in a narrow pane', () => {
    expect(readingColumnPadding(700, 16)).toBe(16);
    expect(readingColumnPadding(320, 16)).toBe(16);
  });
});
