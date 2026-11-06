// @ai-generated
// getMushafLayout and calculateLineYPositions in phone landscape and on iPad:
// the iOS cutout, pages 1-2, and the page-label gutters.
//
// UIKit reports landscape horizontal insets on both sides (59/59 on a
// Dynamic Island phone, 44/44 on a notch phone). Android reports its
// navigation bar through the same fields, so main.tsx passes them as
// `sideInsets` on iOS only.

import {
  calculateLineYPositions,
  getMushafLayout,
  getPageLabelOffsets,
  minLabelGutter,
  PAGE_NUMBER_LABEL_OFFSET,
  singlePageLayout,
  SURAH_JUZ_LABEL_OFFSET,
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

// What main.tsx passes: on iOS the side insets are the cutout, and on
// Android it passes none.
const ios = (left: number, right: number) => ({
  insets: insets(left, right),
  sideInsets: {left, right},
});
const android = (left: number, right: number) => ({
  insets: insets(left, right),
});

describe('getMushafLayout — phone landscape display cutout', () => {
  it('insets the page by the Dynamic Island on both sides (iPhone 15 Pro)', () => {
    const m = getMushafLayout({...baseOpts, ...ios(ISLAND, ISLAND)});

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
      ...ios(NOTCH, NOTCH),
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
        ...ios(l, r),
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
      const m = getMushafLayout({...baseOpts, width: w, ...ios(i, i)});
      expect(m.pageOffsetX).toBe((m.screenWidth - m.pageWidth) / 2);
    }
  });

  it('documents the real font cost on an iPhone 15 Pro', () => {
    // `fontSizeEst = contentWidth * 0.053` drives baseLineHeight and hence the
    // rendered glyph size, so every point of inset is font size.
    const before = getMushafLayout({...baseOpts, insets: insets(0, 0)});
    const after = getMushafLayout({
      ...baseOpts,
      ...ios(ISLAND, ISLAND),
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
    const m = getMushafLayout({...baseOpts, ...ios(ISLAND, 0)});

    expect(m.pageOffsetX).toBe(ISLAND);
    expect(m.pageWidth).toBe(W - ISLAND); // 793
    expect(m.contentWidth).toBe(785);
    expect((1 - m.contentWidth / before.contentWidth) * 100).toBeCloseTo(
      7.0,
      1,
    );
  });
});

describe('getMushafLayout — only sideInsets move the page', () => {
  it('never reads insets.left / insets.right (Android: no side insets)', () => {
    // Edge to edge, a landscape inset on Android is the navigation bar, not a
    // cutout, and main.tsx passes no side insets there.
    const withNavBar = getMushafLayout({...baseOpts, ...android(NAV_BAR, 0)});
    const withNothing = getMushafLayout({...baseOpts, insets: insets(0, 0)});

    expect(withNavBar).toEqual(withNothing);
    expect(withNavBar.pageWidth).toBe(W);
    expect(withNavBar.pageOffsetX).toBe(0);
  });

  it('applies the side insets it is given', () => {
    const m = getMushafLayout({...baseOpts, ...ios(NAV_BAR, NAV_BAR)});
    expect(m.pageOffsetX).toBe(NAV_BAR);
    expect(m.pageWidth).toBe(W - NAV_BAR * 2);
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

    expect(getMushafLayout({...portrait, ...ios(ISLAND, ISLAND)})).toEqual(
      getMushafLayout({...portrait, insets: insets(0, 0)}),
    );
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
      expect(getMushafLayout({...opts, ...ios(ISLAND, ISLAND)})).toEqual(
        getMushafLayout({...opts, insets: insets(0, 0)}),
      );
    }
  });
});

// The layout decides two things that the renderers and DKPageView read:
// whether pages 1-2 are centred, and whether the book edge is drawn on both
// sides.
describe('getMushafLayout — the layout decisions', () => {
  const phonePortrait = {...baseOpts, width: H, height: W};
  const tabletLandscape = {
    width: 1366,
    height: 1024,
    isTablet: true,
    headerHeight: 0,
    toolbarHeight: 0,
    insets: insets(0, 0),
  };
  const tabletPortrait = {...tabletLandscape, width: 1024, height: 1366};
  // A narrow Split View pane: the page is not capped, so it fills the item.
  const tabletPane = {...tabletLandscape, width: 507, height: 1366};

  it('phone portrait: pages 1-2 centred, one-sided book edge', () => {
    const m = getMushafLayout({...phonePortrait, insets: insets(0, 0)});
    expect(m.centerShortPages).toBe(true);
    expect(m.symmetricEdges).toBe(false);
  });

  it('phone landscape: pages 1-2 at the top, one-sided book edge', () => {
    for (const chrome of [0, 60]) {
      for (const side of [0, NOTCH, ISLAND]) {
        const m = getMushafLayout({
          ...baseOpts,
          headerHeight: chrome,
          toolbarHeight: chrome,
          ...ios(side, side),
        });
        expect(m.centerShortPages).toBe(false);
        // The cutout makes the page narrower than the item, and the page
        // still keeps the book-edge look.
        expect(m.symmetricEdges).toBe(false);
      }
    }
  });

  it('iPad portrait: pages 1-2 centred, book edge on both sides', () => {
    const m = getMushafLayout(tabletPortrait);
    expect(m.pageWidth).toBeLessThan(m.screenWidth);
    expect(m.centerShortPages).toBe(true);
    expect(m.symmetricEdges).toBe(true);
  });

  it('iPad Split View pane: the page fills the item, one-sided edge', () => {
    const m = getMushafLayout(tabletPane);
    expect(m.pageWidth).toBe(m.screenWidth);
    expect(m.centerShortPages).toBe(true);
    expect(m.symmetricEdges).toBe(false);
  });

  it('iPad landscape: a spread keeps the one-sided edge on each page', () => {
    const m = getMushafLayout(tabletLandscape);
    expect(m.facingPages).toBe(true);
    expect(m.centerShortPages).toBe(true);
    expect(m.symmetricEdges).toBe(false);

    // One page of the spread, centred in the item (the vertical reader).
    const single = singlePageLayout(m);
    expect(single.centerShortPages).toBe(true);
    expect(single.symmetricEdges).toBe(true);
  });

  it('outside phone landscape, symmetricEdges is the rule develop used', () => {
    // develop: !facingPages && pageWidth < screenWidth.
    for (const opts of [
      {...phonePortrait, insets: insets(0, 0)},
      tabletPortrait,
      tabletPane,
      tabletLandscape,
    ]) {
      for (const m of [
        getMushafLayout(opts),
        singlePageLayout(getMushafLayout(opts)),
      ]) {
        expect(m.symmetricEdges).toBe(
          !m.facingPages && m.pageWidth < m.screenWidth,
        );
      }
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

  it('starts at the top with the phone-landscape layout decision', () => {
    expect(m.centerShortPages).toBe(false);
    for (const page of [1, 2]) {
      const ys = calculateLineYPositions(
        lines,
        page,
        m.contentHeight,
        m.baseLineHeight,
        m.centerShortPages,
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
            sideInsets: {left: ISLAND, right: ISLAND},
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
        if (before >= minLabelGutter()) {
          // Face ID iPads and every non-glass iPad: unchanged.
          expect(m.paddingBottom).toBe(before);
        } else {
          // Only a glass iPad with a small bottom inset moves, to the floor.
          expect(chrome).toBe(0);
          expect(m.paddingBottom).toBe(minLabelGutter());
        }
      }
    }
  });

  it('one rule for both floors: minLabelGutter of the band to keep clear', () => {
    // An offset reaches the outer edge of its label, and the 12pt label line
    // (about 16pt) grows back toward the text. So a gutter as deep as the
    // offset keeps the label on the page, and the line needs no room.
    expect(SURAH_JUZ_LABEL_OFFSET).toBeGreaterThan(16);
    expect(PAGE_NUMBER_LABEL_OFFSET).toBeGreaterThan(16);
    expect(minLabelGutter()).toBe(PAGE_NUMBER_LABEL_OFFSET + 8); // 43
    expect(minLabelGutter(21)).toBe(21 + 43);

    // Phone landscape keeps both labels 8pt or more clear of the safe area.
    for (const opts of shapes(W, H, false)) {
      const m = getMushafLayout(opts);
      const {labelTop, pageNumberBottom} = getPageLabelOffsets(m, {
        isBookLayout: false,
        insetTop: opts.insets.top,
      });
      expect(m.paddingTop).toBeGreaterThanOrEqual(
        minLabelGutter(opts.insets.top),
      );
      expect(m.paddingBottom).toBeGreaterThanOrEqual(
        minLabelGutter(opts.insets.bottom),
      );
      expect(labelTop).toBeGreaterThanOrEqual(opts.insets.top + 8);
      expect(pageNumberBottom).toBeGreaterThanOrEqual(opts.insets.bottom + 8);
    }

    // An iPad keeps the page number on the page, 8pt or more from its edge.
    for (const opts of shapes(1024, 1366, true)) {
      const m = getMushafLayout(opts);
      expect(m.paddingBottom).toBeGreaterThanOrEqual(minLabelGutter());
      const {pageNumberBottom} = getPageLabelOffsets(m, {
        isBookLayout: false,
        insetTop: opts.insets.top,
      });
      expect(pageNumberBottom).toBeGreaterThanOrEqual(8);
    }
  });

  it('glass phone landscape: the surah / juz labels clear the floating header', () => {
    // iPhone 17 Pro in landscape on the iOS 26 simulator: useHeaderHeight()
    // read 78, and the safe-area insets were 0 / 20 and 62 / 62.
    const glass = {
      width: 874,
      height: 402,
      isTablet: false,
      headerHeight: 0,
      toolbarHeight: 0,
      ...ios(62, 62),
      insets: {top: 0, bottom: 20, left: 62, right: 62},
    };
    const m = getMushafLayout({...glass, floatingHeaderHeight: 78});
    for (const isBookLayout of [true, false]) {
      const {labelTop} = getPageLabelOffsets(m, {isBookLayout, insetTop: 0});
      expect(labelTop).toBe(78 + 13);
    }
    expect(m.paddingTop).toBe(minLabelGutter(78)); // 121

    // With no floating header, only the safe area counts.
    const bare = getMushafLayout(glass);
    expect(bare.paddingTop).toBe(minLabelGutter(0)); // 43
    // The text size follows contentWidth, so no glyph changes size.
    expect(m.contentWidth).toBe(bare.contentWidth);
    expect(m.baseLineHeight).toBe(bare.baseLineHeight);
    expect(m.paddingBottom).toBe(bare.paddingBottom);
  });

  it('only phone landscape reads floatingHeaderHeight', () => {
    for (const opts of [
      ...shapes(H, W, false),
      ...shapes(1366, 1024, true),
      ...shapes(1024, 1366, true),
    ]) {
      expect(getMushafLayout({...opts, floatingHeaderHeight: 116})).toEqual(
        getMushafLayout(opts),
      );
    }
    // Non-glass: main.tsx passes 0, and the 60pt header already sets the
    // gutter.
    const nonGlass = {...baseOpts, headerHeight: 60, toolbarHeight: 60};
    expect(
      getMushafLayout({...nonGlass, floatingHeaderHeight: 0}).paddingTop,
    ).toBe(72);
  });

  it('leaves the non-glass gutters untouched — they already clear the floor', () => {
    const nonGlass = {
      width: W,
      height: H,
      isTablet: false,
      headerHeight: 60,
      toolbarHeight: 60,
      ...ios(ISLAND, ISLAND),
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
      ...ios(ISLAND, ISLAND),
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
