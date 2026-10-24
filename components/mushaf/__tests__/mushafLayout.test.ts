// @ai-generated
// getMushafLayout and calculateLineYPositions in phone landscape and on iPad:
// the iOS cutout, pages 1-2, and the page-label gutters.
//
// UIKit reports landscape horizontal insets on both sides (59/59 on a
// Dynamic Island phone, 44/44 on a notch phone). Android reports its
// navigation bar through the same fields, so the insets count on iOS only.

import {Platform} from 'react-native';
import {
  calculateLineYPositions,
  getMushafLayout,
  getPageLabelOffsets,
  TABLET_MIN_PADDING_BOTTOM,
} from '../constants';

// iPhone 15 Pro, landscape.
const W = 852;
const H = 393;
const ISLAND = 59; // Dynamic Island, reported on BOTH sides in landscape.

// iPhone 11 / X-class notch, landscape.
const NOTCH_W = 896;
const NOTCH_H = 414;
const NOTCH = 44;

// Android 3-button navigation bar in landscape, in the same inset fields.
const NAV_BAR = 48;

const baseOpts = {
  width: W,
  height: H,
  isTablet: false,
  headerHeight: 0,
  toolbarHeight: 0,
};

const insets = (left: number, right: number) => ({
  top: 0,
  bottom: 21,
  left,
  right,
});

describe('getMushafLayout — phone landscape display cutout', () => {
  it('insets the page by the Dynamic Island on both sides (iPhone 15 Pro)', () => {
    const m = getMushafLayout({...baseOpts, insets: insets(ISLAND, ISLAND)});

    // The pager item must stay one full window wide or `getItemLayout` in
    // main.tsx stops snapping.
    expect(m.screenWidth).toBe(W);

    expect(m.pageOffsetX).toBe(ISLAND);
    expect(m.pageWidth).toBe(W - ISLAND * 2); // 734
    expect(m.contentWidth).toBe(726);

    // Confirms this is the landscape branch (it alone sets this).
    expect(m.scrollContainerHeight).toBe(H);
  });

  it('insets the page by the notch on both sides (iPhone 11)', () => {
    const m = getMushafLayout({
      ...baseOpts,
      width: NOTCH_W,
      height: NOTCH_H,
      insets: insets(NOTCH, NOTCH),
    });

    expect(m.screenWidth).toBe(NOTCH_W);
    expect(m.pageOffsetX).toBe(NOTCH);
    expect(m.pageWidth).toBe(NOTCH_W - NOTCH * 2); // 808
    expect(m.contentWidth).toBe(800);
  });

  it('keeps the whole page box inside both safe edges', () => {
    for (const [w, l, r] of [
      [W, ISLAND, ISLAND],
      [NOTCH_W, NOTCH, NOTCH],
      [W, ISLAND, 0], // hypothetical; see the generality test below
    ]) {
      const m = getMushafLayout({
        ...baseOpts,
        width: w,
        insets: insets(l, r),
      });

      // Nothing is drawn left of the left inset...
      expect(m.pageOffsetX).toBeGreaterThanOrEqual(l);
      // ...nor right of the right inset.
      expect(m.pageOffsetX + m.pageWidth).toBeLessThanOrEqual(w - r);
    }
  });

  it('is equivalent to centring whenever the insets are symmetric', () => {
    for (const [w, i] of [
      [W, ISLAND],
      [NOTCH_W, NOTCH],
    ]) {
      const m = getMushafLayout({...baseOpts, width: w, insets: insets(i, i)});
      expect(m.pageOffsetX).toBe((m.screenWidth - m.pageWidth) / 2);
    }
  });

  it('documents the real font cost on an iPhone 15 Pro', () => {
    // `fontSizeEst = contentWidth * 0.053` drives baseLineHeight and hence the
    // rendered glyph size, so every point of inset is font size.
    const before = getMushafLayout({...baseOpts, insets: insets(0, 0)});
    const after = getMushafLayout({
      ...baseOpts,
      insets: insets(ISLAND, ISLAND),
    });

    expect(before.contentWidth).toBe(844);
    expect(after.contentWidth).toBe(726);

    // Glyph size: 44.73pt -> 38.48pt.
    expect(before.contentWidth * 0.053).toBeCloseTo(44.73, 2);
    expect(after.contentWidth * 0.053).toBeCloseTo(38.48, 2);

    const lossPct = (1 - after.contentWidth / before.contentWidth) * 100;
    expect(lossPct).toBeCloseTo(14.0, 1);
  });

  it('handles a one-sided inset (not observed on iOS)', () => {
    const before = getMushafLayout({...baseOpts, insets: insets(0, 0)});
    const m = getMushafLayout({...baseOpts, insets: insets(ISLAND, 0)});

    expect(m.pageOffsetX).toBe(ISLAND);
    expect(m.pageWidth).toBe(W - ISLAND); // 793
    expect(m.contentWidth).toBe(785);
    expect((1 - m.contentWidth / before.contentWidth) * 100).toBeCloseTo(
      7.0,
      1,
    );
  });
});

describe('getMushafLayout — Android is never shrunk (regression guard)', () => {
  const original = Platform.OS;
  afterEach(() => {
    Platform.OS = original;
  });

  it('ignores Android navigation-bar insets entirely', () => {
    // Edge to edge, a landscape inset on Android is the navigation bar, not a
    // cutout.
    Platform.OS = 'android';

    const withNavBar = getMushafLayout({
      ...baseOpts,
      insets: insets(NAV_BAR, 0),
    });
    const withNothing = getMushafLayout({...baseOpts, insets: insets(0, 0)});

    expect(withNavBar).toEqual(withNothing);
    expect(withNavBar.pageWidth).toBe(W);
    expect(withNavBar.pageOffsetX).toBe(0);
  });

  it('still applies the same insets on iOS', () => {
    Platform.OS = 'ios';

    const m = getMushafLayout({...baseOpts, insets: insets(NAV_BAR, NAV_BAR)});
    expect(m.pageOffsetX).toBe(NAV_BAR);
  });
});

describe('getMushafLayout — no movement where there is no cutout', () => {
  it('phone landscape is unchanged (pre-fix behaviour)', () => {
    const m = getMushafLayout({...baseOpts, insets: insets(0, 0)});

    // The formula before this change: pageWidth = width,
    // contentWidth = width - 2 * padding, baseLineHeight = contentWidth *
    // 0.053 * 2.1.
    expect(m.screenWidth).toBe(852);
    expect(m.pageWidth).toBe(852);
    expect(m.pageOffsetX).toBe(0);
    expect(m.paddingHorizontal).toBe(4); // compact device (height < 700)
    expect(m.contentWidth).toBe(844);
    expect(m.baseLineHeight).toBeCloseTo(844 * 0.053 * 2.1);
    expect(m.scrollContainerHeight).toBe(393);
  });

  it('an absent inset object behaves exactly like zero insets', () => {
    const absent = getMushafLayout({...baseOpts, insets: null});
    const zeroed = getMushafLayout({
      ...baseOpts,
      insets: {top: 0, bottom: 0, left: 0, right: 0},
    });

    expect(absent).toEqual(zeroed);
  });

  it('phone portrait ignores horizontal insets entirely', () => {
    const portrait = {...baseOpts, width: H, height: W};

    expect(
      getMushafLayout({...portrait, insets: insets(ISLAND, ISLAND)}),
    ).toEqual(getMushafLayout({...portrait, insets: insets(0, 0)}));
  });

  it('both iPad branches ignore horizontal insets entirely', () => {
    const tabletLandscape = {
      width: 1366,
      height: 1024,
      isTablet: true,
      headerHeight: 0,
      toolbarHeight: 0,
    };
    const tabletPortrait = {...tabletLandscape, width: 1024, height: 1366};

    for (const opts of [tabletLandscape, tabletPortrait]) {
      expect(
        getMushafLayout({...opts, insets: insets(ISLAND, ISLAND)}),
      ).toEqual(getMushafLayout({...opts, insets: insets(0, 0)}));
    }
  });
});

// Pages 1-2 centre their short block inside contentHeight. In phone landscape
// the page is much taller than its ScrollView, so the block starts below the
// fold. centerShortPages: false starts it at the top.
describe('calculateLineYPositions — pages 1-2 in a short scroll viewport', () => {
  // A short block of 8 lines, the size of the pages 1-2 blocks.
  const lines = Array.from({length: 8}, () => ({line_type: 'ayah'}));
  const m = getMushafLayout({...baseOpts, insets: insets(0, 0)});

  it('the centred block leaves no full line visible at offset 0 (the defect)', () => {
    // Both chrome regimes main.tsx uses: 0 (iOS 26 glass) and 60.
    for (const chrome of [0, 60]) {
      const mm = getMushafLayout({
        ...baseOpts,
        headerHeight: chrome,
        toolbarHeight: chrome,
        insets: insets(0, 0),
      });
      const ys = calculateLineYPositions(
        lines,
        1,
        mm.contentHeight,
        mm.baseLineHeight,
      );
      // The first line does not fit in the viewport before a scroll.
      expect(mm.scrollContainerHeight).toBe(H);
      expect(mm.paddingTop + ys[0] + mm.baseLineHeight).toBeGreaterThan(H);
    }
  });

  it('starts at the top when centering is turned off', () => {
    for (const page of [1, 2]) {
      const ys = calculateLineYPositions(
        lines,
        page,
        m.contentHeight,
        m.baseLineHeight,
        false,
      );
      expect(ys[0]).toBe(0);
      expect(ys[1]).toBeCloseTo(m.baseLineHeight);
    }
  });

  it('keeps the centering by default, and never affects pages 3-604', () => {
    const centred = calculateLineYPositions(lines, 1, 1000, 50);
    expect(centred[0]).toBe((1000 - 8 * 50) / 2);

    expect(calculateLineYPositions(lines, 3, 1000, 50, true)).toEqual(
      calculateLineYPositions(lines, 3, 1000, 50, false),
    );
  });
});

// The labels sit at paddingTop - 30 and paddingBottom - 35 (or centred in the
// bottom gutter in book layout). On iOS 26+ main.tsx passes 0 for the header
// and toolbar heights (glass chrome), so a shallow gutter put the page number
// at a negative offset: 29 - 35 = -6 on an iPhone 15 in landscape, 32 - 35 =
// -3 on an iPad.
describe('getPageLabelOffsets — labels stay on the page', () => {
  // main.tsx passes 0 for both heights with glass chrome, and 60 otherwise.
  const CHROME = [0, 60];
  // Plausible vertical safe-area shapes: none, a home indicator, a rotated
  // notch, and an iPad's small inset.
  const TOPS = [0, 8, 21, 44];
  const BOTTOMS = [0, 8, 21, 34];

  const shapes = (width: number, height: number, isTablet: boolean) => {
    const out = [];
    for (const chrome of CHROME) {
      for (const top of TOPS) {
        for (const bottom of BOTTOMS) {
          out.push({
            width,
            height,
            isTablet,
            headerHeight: chrome,
            toolbarHeight: chrome,
            insets: {top, bottom, left: ISLAND, right: ISLAND},
          });
        }
      }
    }
    return out;
  };

  const expectOnPage = (opts: ReturnType<typeof shapes>[number]) => {
    const m = getMushafLayout(opts);

    for (const isBookLayout of [true, false]) {
      const {labelTop, pageNumberBottom} = getPageLabelOffsets(m, {
        isBookLayout,
        insetTop: opts.insets.top,
      });
      const where = `${JSON.stringify(opts.insets)} chrome=${opts.headerHeight} book=${isBookLayout}`;

      expect([where, labelTop >= 0]).toEqual([where, true]);
      expect([where, pageNumberBottom >= 0]).toEqual([where, true]);
    }
  };

  it('phone landscape — every inset shape, both page layouts', () => {
    for (const opts of shapes(W, H, false)) expectOnPage(opts);
  });

  it('phone portrait — every inset shape, both page layouts', () => {
    for (const opts of shapes(H, W, false)) expectOnPage(opts);
  });

  it('tablet, both orientations — every inset shape, both page layouts', () => {
    for (const opts of shapes(1366, 1024, true)) expectOnPage(opts);
    for (const opts of shapes(1024, 1366, true)) expectOnPage(opts);
  });

  it('tablet: floors only the clipped bottom gutter, never the top', () => {
    // The pre-fix tablet arithmetic, verbatim from develop.
    const developTop = (chrome: number, top: number) =>
      chrome + Math.max(top, 8) + 28;
    const developBottom = (chrome: number, bottom: number) =>
      chrome + Math.max(bottom, 8) + 24;

    for (const [width, height] of [
      [1366, 1024],
      [1024, 1366],
    ]) {
      for (const opts of shapes(width, height, true)) {
        const m = getMushafLayout(opts);
        const chrome = opts.headerHeight;
        const {top, bottom} = opts.insets;

        // The top gutter is byte-identical to develop on every iPad.
        expect(m.paddingTop).toBe(developTop(chrome, top));

        const before = developBottom(chrome, bottom);
        if (before >= TABLET_MIN_PADDING_BOTTOM) {
          // Face ID iPads and every non-glass iPad: unchanged.
          expect(m.paddingBottom).toBe(before);
        } else {
          // Only a glass iPad with a small bottom inset moves, to the floor.
          expect(chrome).toBe(0);
          expect(m.paddingBottom).toBe(TABLET_MIN_PADDING_BOTTOM);
        }
      }
    }
  });

  it('leaves the non-glass gutters untouched — they already clear the band', () => {
    const nonGlass = {
      width: W,
      height: H,
      isTablet: false,
      headerHeight: 60,
      toolbarHeight: 60,
      insets: insets(ISLAND, ISLAND),
    };
    const m = getMushafLayout(nonGlass);

    // 60 + 0 + 12 and 60 + 21 + 8 — the pre-fix arithmetic verbatim.
    expect(m.paddingTop).toBe(72);
    expect(m.paddingBottom).toBe(89);
  });

  it('does not move a glyph — only the gutters deepen', () => {
    const glass = {
      width: W,
      height: H,
      isTablet: false,
      headerHeight: 0,
      toolbarHeight: 0,
      insets: insets(ISLAND, ISLAND),
    };
    const nonGlass = {...glass, headerHeight: 60, toolbarHeight: 60};
    const m = getMushafLayout(glass);

    // fontSize and baseLineHeight come from contentWidth, never from the
    // gutters, so deepening a gutter must not shift any text.
    expect(m.contentWidth).toBe(getMushafLayout(nonGlass).contentWidth);
    expect(m.baseLineHeight).toBe(getMushafLayout(nonGlass).baseLineHeight);
    // The page already scrolls, so the extra gutter costs nothing.
    expect(m.screenHeight).toBeGreaterThan(H);
    expect(m.scrollContainerHeight).toBe(H);
  });
});
