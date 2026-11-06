import {useMemo} from 'react';
import {Dimensions, useWindowDimensions, type ScaledSize} from 'react-native';
import type {EdgeInsets} from 'react-native-safe-area-context';
import {getIsTablet} from '@/utils/responsive';

// ---------------------------------------------------------------------------
// Live window dimensions (kept in sync via Dimensions subscription)
// ---------------------------------------------------------------------------

let _liveWidth = Dimensions.get('window').width;
let _liveHeight = Dimensions.get('window').height;

Dimensions.addEventListener('change', ({window}: {window: ScaledSize}) => {
  _liveWidth = window.width;
  _liveHeight = window.height;
});

// ---------------------------------------------------------------------------
// Module-level snapshot constants (backward-compat).
//
// These are captured at import time. They remain correct for the default
// phone-portrait case (the only case the app supported before iPad work)
// and are used by modules that cannot easily adopt the hook yet.
//
// iPad / rotation-aware consumers should instead use `useMushafLayout()`
// or `getMushafLayout()` below, which always read the latest dimensions.
// ---------------------------------------------------------------------------

const {width: SCREEN_WIDTH, height: SCREEN_HEIGHT} = Dimensions.get('window');

export const IS_COMPACT_DEVICE = SCREEN_HEIGHT < 700;

export const PAGE_PADDING_HORIZONTAL = IS_COMPACT_DEVICE ? 4 : 8;
export const PAGE_PADDING_TOP = IS_COMPACT_DEVICE ? 95 : 130;
export const PAGE_PADDING_BOTTOM = IS_COMPACT_DEVICE ? 70 : 100;

// @ai-start
/**
 * Where the per-page labels sit. The surah / juz labels sit
 * `SURAH_JUZ_LABEL_OFFSET` above the top of the text, and the fullscreen page
 * number `PAGE_NUMBER_LABEL_OFFSET` below its bottom. Each offset reaches the
 * outer edge of the label, and the label line grows back toward the text. A
 * gutter smaller than the offset puts the label off the page.
 */
export const SURAH_JUZ_LABEL_OFFSET = 30;
export const PAGE_NUMBER_LABEL_OFFSET = 35;

/** Space between a label and the band at the page edge it keeps clear of. */
const PAGE_LABEL_MARGIN = 8;

/**
 * The smallest gutter that keeps both labels clear of a band `edge` deep at
 * the page edge: the band, the larger label offset and an 8pt margin. The
 * label line needs no room of its own (see the offsets above).
 */
export function minLabelGutter(edge = 0): number {
  return edge + PAGE_NUMBER_LABEL_OFFSET + PAGE_LABEL_MARGIN;
}

/**
 * Label positions, measured inward from the page edge. The book-layout page
 * number centres itself in the gutter below the card.
 */
export function getPageLabelOffsets(
  metrics: Pick<MushafLayoutMetrics, 'paddingTop' | 'paddingBottom'>,
  opts: {isBookLayout: boolean; insetTop: number},
): {labelTop: number; pageNumberBottom: number} {
  return {
    labelTop: metrics.paddingTop - SURAH_JUZ_LABEL_OFFSET,
    pageNumberBottom: opts.isBookLayout
      ? opts.insetTop + (metrics.paddingBottom - opts.insetTop) / 2 - 8
      : metrics.paddingBottom - PAGE_NUMBER_LABEL_OFFSET,
  };
}
// @ai-end

// Book page-edge decoration constants
export const PAGE_EDGE_OUTER_MARGIN = 14;
export const PAGE_EDGE_INNER_MARGIN = 2;

export function getPageEdgeLayout(pageNumber: number) {
  const isRightPage = pageNumber % 2 === 1;
  return {
    isRightPage,
    // Right pages: outer edge on RIGHT → small left margin, large right margin
    // Left pages: outer edge on LEFT → large left margin, small right margin
    contentMarginLeft: isRightPage
      ? PAGE_EDGE_INNER_MARGIN
      : PAGE_EDGE_OUTER_MARGIN,
  };
}

export const LINES_PER_PAGE = 15;

export const CONTENT_WIDTH = SCREEN_WIDTH - PAGE_PADDING_HORIZONTAL * 2;
export const CONTENT_HEIGHT =
  SCREEN_HEIGHT - PAGE_PADDING_TOP - PAGE_PADDING_BOTTOM;
export const BASE_LINE_HEIGHT = CONTENT_HEIGHT / LINES_PER_PAGE;

export {SCREEN_WIDTH, SCREEN_HEIGHT};

// ---------------------------------------------------------------------------
// Responsive mushaf layout (hook + static helper)
// ---------------------------------------------------------------------------

export interface MushafLayoutMetrics {
  /** Full device/container width — what the FlatList item occupies. */
  screenWidth: number;
  /** Full device/container height — what each page View occupies. */
  screenHeight: number;
  /** Width of ONE rendered mushaf page (capped on iPad to stay readable). */
  pageWidth: number;
  /**
   * Horizontal offset from the FlatList item's left edge to the first
   * rendered page. On phones this is 0. On iPad we center the page(s).
   */
  pageOffsetX: number;
  /** Gap between the two facing pages. Only non-zero when `facingPages`. */
  facingGap: number;
  contentWidth: number;
  contentHeight: number;
  baseLineHeight: number;
  paddingHorizontal: number;
  paddingTop: number;
  paddingBottom: number;
  /** True when rendering two facing pages side-by-side (iPad landscape). */
  facingPages: boolean;
  /**
   * When set, the page view is taller than the physical screen and should be
   * wrapped in a ScrollView of this height (= physical landscape screen height).
   * Only used for phone landscape mode.
   */
  scrollContainerHeight?: number;
  // @ai-start
  /**
   * Whether pages 1-2 centre their short block in `contentHeight` (see
   * `calculateLineYPositions`). False in phone landscape, where the page
   * scrolls and a centred block would start below the fold.
   */
  centerShortPages: boolean;
  /**
   * Whether the book-edge decoration is drawn on both sides of the page, with
   * four rounded corners: one page narrower than the item, with no facing
   * page (iPad portrait, and one page of an iPad spread). False for spreads,
   * full-width pages and phone landscape, which keep the one-sided edge.
   */
  symmetricEdges: boolean;
  // @ai-end
}

export interface MushafLayoutOpts {
  width?: number;
  height?: number;
  /**
   * When provided, overrides `width`/`height` and is treated as the *measured*
   * container size (i.e. after the parent has subtracted the stack header,
   * toolbar, and safe-area insets). Prefer this on iPad to avoid the "cut off
   * at the bottom" bug — computing metrics from raw window dimensions
   * overestimates the available space because the stack chrome is not
   * accounted for in `useWindowDimensions()`.
   */
  containerWidth?: number;
  containerHeight?: number;
  /** Safe-area insets. Only `top` and `bottom` are read. */ // @ai
  insets?: EdgeInsets | null;
  // @ai-start
  /**
   * The left and right insets the page keeps clear of. Only phone landscape
   * reads them. The caller decides which insets count: main.tsx passes the
   * iOS cutout (the sensor housing) and nothing on Android.
   */
  sideInsets?: {left: number; right: number};
  // @ai-end
  /** Height of the custom bottom player/toolbar, if any (phone only). */
  toolbarHeight?: number;
  /** Height of the native stack header, if one is shown (phone only). */
  headerHeight?: number;
  // @ai-start
  /**
   * Height of a header that floats over the page (the iOS 26 glass Stack
   * header), or 0. Only phone landscape reads it: that page scrolls, so its
   * top gutter grows to keep the surah / juz labels below the header.
   */
  floatingHeaderHeight?: number;
  // @ai-end
  isTablet?: boolean;
}

/**
 * Target fontSize for iPad rendering. `SkiaPage` derives `fontSize` from
 * `contentWidth` via `fontSize ≈ contentWidth * 0.053` (because the DK font
 * reports `PAGE_WIDTH = 17000` and `FONTSIZE = 1000` at a `*0.9` render
 * factor). We aim for a comfortable ~34pt font on iPad which maps to a
 * `contentWidth ≈ 640pt` → `pageWidth ≈ 688pt`.
 *
 * Phones are never clamped (their width is always below this value).
 */
const IPAD_MAX_PAGE_WIDTH_SINGLE = 720;
/**
 * Cap for iPad landscape single-page rendering. Narrower than portrait so
 * the page doesn't hog the whole screen when the device is rotated; also
 * keeps the font noticeably smaller than portrait which mirrors how a
 * physical mushaf feels when held landscape.
 */
const IPAD_MAX_PAGE_WIDTH_LANDSCAPE = 640;

/**
 * Pure helper that returns mushaf metrics for a given window/container + insets.
 *
 * Three important differences vs the legacy `SCREEN_*`/`CONTENT_*` constants:
 *
 *   1. `paddingTop` / `paddingBottom` are derived from the real safe area
 *      instead of being frozen at 130/100pt. This fixes the "page cut off at
 *      the bottom" bug on iPad portrait.
 *   2. On tablet we cap `pageWidth` so `SkiaPage`'s font size (which scales
 *      linearly with `contentWidth`) never grows past ~38pt. Without the cap,
 *      iPad Pro 13" landscape renders 70pt+ text and lines overlap.
 *   3. iPad landscape lays out two facing pages (`facingPages`). Views that
 *      show one page at a time there take `singlePageLayout(metrics)`.
 */
export function getMushafLayout(
  opts: MushafLayoutOpts = {},
): MushafLayoutMetrics {
  // Prefer measured container dims when provided (iPad path). Fall back to
  // raw window dims for the phone path and for first-render before layout.
  const width = opts.containerWidth ?? opts.width ?? _liveWidth;
  const height = opts.containerHeight ?? opts.height ?? _liveHeight;
  const insetTop = opts.insets?.top ?? 0;
  const insetBottom = opts.insets?.bottom ?? 0;
  // @ai-start
  const insetLeft = opts.sideInsets?.left ?? 0;
  const insetRight = opts.sideInsets?.right ?? 0;
  // @ai-end
  const headerHeight = opts.headerHeight ?? 0;
  const toolbarHeight = opts.toolbarHeight ?? 0;
  const isTablet = opts.isTablet ?? getIsTablet();

  const landscape = width >= height;
  const compact = height < 700;

  // --- Vertical padding ----------------------------------------------------
  // Phone bakes in the old legacy values so we don't shift any existing pixels.
  const basePaddingTop = compact ? 95 : 130;
  const basePaddingBottom = compact ? 70 : 100;
  // Tablet: overlay chrome (non-glass `headerHeight`/`toolbarHeight`) + safe
  // area inset + aesthetic margin for surah/juz/page labels. On iOS 26 glass
  // iPad the stack chrome lives *outside* the container; callers should
  // pass `headerHeight=0, toolbarHeight=0` and measure the true container
  // height via `onLayout`.
  const tabletPaddingTop = headerHeight + Math.max(insetTop, 8) + 28;
  // @ai With glass chrome (headerHeight = toolbarHeight = 0) an iPad with no
  // home indicator got a 32pt bottom gutter, and the fullscreen page number
  // sat at 32 - 35 = -3. Floor only that gutter; every other iPad already
  // clears the floor, and the top label never goes negative. The floor keeps
  // the label on the page only: an iPad gutter takes its height from the
  // text, so it does not grow to clear the home indicator as well.
  const tabletPaddingBottom = Math.max(
    toolbarHeight + Math.max(insetBottom, 8) + 24,
    minLabelGutter(),
  );

  const paddingTop = isTablet ? tabletPaddingTop : basePaddingTop;
  const paddingBottom = isTablet ? tabletPaddingBottom : basePaddingBottom;

  const contentHeight = Math.max(height - paddingTop - paddingBottom, 1);
  const baseLineHeight = contentHeight / LINES_PER_PAGE;

  // --- Horizontal layout ---------------------------------------------------
  // Phone: one page fills the FlatList item, with a small edge margin.
  // iPad: cap the page width so font size stays readable; center the page
  //       (or a pair of pages) within the item and report `pageOffsetX`.
  const basePaddingHorizontal = compact ? 4 : 8;

  if (!isTablet) {
    const paddingHorizontal = basePaddingHorizontal;

    if (!landscape) {
      const pageWidth = width;
      const contentWidth = pageWidth - paddingHorizontal * 2;
      return {
        screenWidth: width,
        screenHeight: height,
        pageWidth,
        pageOffsetX: 0,
        facingGap: 0,
        contentWidth,
        contentHeight,
        baseLineHeight,
        paddingHorizontal,
        paddingTop,
        paddingBottom,
        facingPages: false,
        centerShortPages: true, // @ai
        symmetricEdges: false, // @ai
      };
    }

    // Phone landscape: "zoomed in" layout, inset by the cutout safe area.
    //
    // The page fills the width between the left and right cutout insets.
    // Because the font size scales with contentWidth, the text is noticeably
    // larger than in portrait. The page content is taller than the physical
    // screen, so a ScrollView wraps it — the user scrolls vertically through
    // the page and swipes horizontally to change pages.
    //
    // @ai pageOffsetX carries the left inset, and both readers place the page
    // from it. screenWidth stays the full window width: the pager item must
    // stay one window wide to snap (getItemLayout in main.tsx).
    //
    // fontSize ≈ contentWidth × 0.053 (from SkiaPage: FONTSIZE/PAGE_WIDTH × 0.9)
    // We maintain the portrait baseLineHeight/fontSize ratio of ~2.1 so
    // harakat never overlap the line below.
    const headerH = opts.headerHeight ?? 60;
    const toolbarH = opts.toolbarHeight ?? 60;
    // @ai-start
    // Keep the labels clear of the safe area, or they land at a negative
    // offset: with glass chrome (0 heights) an iPhone 15 had a 29pt bottom
    // gutter and the page number at -6. At the top they also clear a
    // floating glass header, which covered them at 22pt. The page scrolls and
    // the glyphs follow contentWidth, so a deeper gutter costs no text size.
    const landscapePaddingTop = Math.max(
      headerH + insetTop + 12,
      minLabelGutter(Math.max(insetTop, opts.floatingHeaderHeight ?? 0)),
    );
    const landscapePaddingBottom = Math.max(
      toolbarH + insetBottom + 8,
      minLabelGutter(insetBottom),
    );
    // @ai-end

    // @ai-start
    const landscapePageWidth = Math.max(width - insetLeft - insetRight, 1);
    const landscapeContentWidth = Math.max(
      landscapePageWidth - basePaddingHorizontal * 2,
      1,
    );
    // @ai-end
    const fontSizeEst = landscapeContentWidth * 0.053;
    const landscapeBaseLineHeight = fontSizeEst * 2.1;
    const landscapeContentHeight = landscapeBaseLineHeight * LINES_PER_PAGE;
    const landscapeScreenHeight =
      landscapeContentHeight + landscapePaddingTop + landscapePaddingBottom;

    return {
      screenWidth: width,
      screenHeight: landscapeScreenHeight,
      pageWidth: landscapePageWidth, // @ai
      pageOffsetX: insetLeft, // @ai
      facingGap: 0,
      contentWidth: landscapeContentWidth,
      contentHeight: landscapeContentHeight,
      baseLineHeight: landscapeBaseLineHeight,
      paddingHorizontal: basePaddingHorizontal,
      paddingTop: landscapePaddingTop,
      paddingBottom: landscapePaddingBottom,
      facingPages: false,
      scrollContainerHeight: height,
      centerShortPages: false, // @ai
      symmetricEdges: false, // @ai
    };
  }

  // iPad pages get a touch more horizontal padding than phones so surah/juz
  // labels breathe. Tuned to keep `fontSize ≈ 34pt` at 720pt page width.
  const paddingHorizontal = 24;

  // Landscape iPad: render two facing pages per spread. `pageWidth` is each
  // individual page's width, capped so the font size stays readable. The
  // FlatList items are spreads whose width is `screenWidth`; the consumer
  // centers `(2*pageWidth + facingGap)` within `screenWidth` via
  // `pageOffsetX`.
  if (landscape) {
    const facingGap = 12;
    // Available width for the two pages combined.
    const availableForPages = Math.max(width - facingGap, 1);
    const pageWidth = Math.min(
      IPAD_MAX_PAGE_WIDTH_LANDSCAPE,
      Math.floor(availableForPages / 2),
    );
    const pageOffsetX = Math.max((width - (2 * pageWidth + facingGap)) / 2, 0);
    const contentWidth = pageWidth - paddingHorizontal * 2;

    return {
      screenWidth: width,
      screenHeight: height,
      pageWidth,
      pageOffsetX,
      facingGap,
      contentWidth,
      contentHeight,
      baseLineHeight,
      paddingHorizontal,
      paddingTop,
      paddingBottom,
      facingPages: true,
      centerShortPages: true, // @ai
      symmetricEdges: false, // @ai
    };
  }

  // Portrait iPad: single centered page, capped width.
  const cap = IPAD_MAX_PAGE_WIDTH_SINGLE;
  const pageWidth = Math.min(width, cap);
  const pageOffsetX = Math.max((width - pageWidth) / 2, 0);
  const contentWidth = pageWidth - paddingHorizontal * 2;

  return {
    screenWidth: width,
    screenHeight: height,
    pageWidth,
    pageOffsetX,
    facingGap: 0,
    contentWidth,
    contentHeight,
    baseLineHeight,
    paddingHorizontal,
    paddingTop,
    paddingBottom,
    facingPages: false,
    centerShortPages: true, // @ai
    symmetricEdges: pageWidth < width, // @ai
  };
}

// @ai-start
/**
 * The same layout with one page centred in the item. The vertical scroll
 * shows one page per row even where the pager shows a spread (iPad
 * landscape), so it can't use the spread's offset, which put its page in
 * the left half of the screen. The page keeps the spread's width, so the
 * text is the same size in both.
 */
export function singlePageLayout(
  metrics: MushafLayoutMetrics,
): MushafLayoutMetrics {
  if (!metrics.facingPages) return metrics;
  return {
    ...metrics,
    pageOffsetX: Math.max((metrics.screenWidth - metrics.pageWidth) / 2, 0),
    facingGap: 0,
    facingPages: false,
    symmetricEdges: metrics.pageWidth < metrics.screenWidth, // @ai
  };
}

/**
 * Key for a reader list. A list keeps its pixel offset when its items change
 * size, which leaves a pager between two pages after a rotation, a Stage
 * Manager resize or a switch between single pages and spreads. Keying the
 * list on what it shows and how wide it is remounts it at the current page
 * instead. Height is left out, so the keyboard never remounts the reader.
 */
export function readerListKey(kind: string, width: number): string {
  return `${kind}-${Math.round(width)}`;
}

/** The widest a line of reading text gets on iPad (reading standards §2). */
export const READING_COLUMN_MAX_WIDTH = 680;

/**
 * Side padding that keeps reading text in a centred column no wider than
 * `READING_COLUMN_MAX_WIDTH`, and never less than `minPadding`.
 */
export function readingColumnPadding(
  width: number,
  minPadding: number,
): number {
  return Math.max(minPadding, (width - READING_COLUMN_MAX_WIDTH) / 2);
}
// @ai-end

/**
 * React hook that returns live mushaf metrics. Re-renders on rotation /
 * split-view changes via `useWindowDimensions`.
 *
 * Pass `insets` from `useSafeAreaInsets()` and, if applicable, the height
 * of any on-screen toolbar so the page never clips underneath it.
 */
export function useMushafLayout(
  opts: Omit<MushafLayoutOpts, 'width' | 'height'> = {},
): MushafLayoutMetrics {
  const {width, height} = useWindowDimensions();

  return useMemo(
    () => getMushafLayout({...opts, width, height}),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      width,
      height,
      opts.containerWidth,
      opts.containerHeight,
      opts.insets?.top,
      opts.insets?.bottom,
      opts.insets?.left,
      opts.insets?.right,
      opts.sideInsets?.left, // @ai
      opts.sideInsets?.right, // @ai
      opts.toolbarHeight,
      opts.headerHeight,
      opts.floatingHeaderHeight, // @ai
      opts.isTablet,
    ],
  );
}

export const SURAH_NAMES: Record<number, string> = {
  1: '\u0627\u0644\u0641\u0627\u062A\u062D\u0629',
  2: '\u0627\u0644\u0628\u0642\u0631\u0629',
  3: '\u0622\u0644 \u0639\u0645\u0631\u0627\u0646',
  4: '\u0627\u0644\u0646\u0633\u0627\u0621',
  5: '\u0627\u0644\u0645\u0627\u0626\u062F\u0629',
  6: '\u0627\u0644\u0623\u0646\u0639\u0627\u0645',
  7: '\u0627\u0644\u0623\u0639\u0631\u0627\u0641',
  8: '\u0627\u0644\u0623\u0646\u0641\u0627\u0644',
  9: '\u0627\u0644\u062A\u0648\u0628\u0629',
  10: '\u064A\u0648\u0646\u0633',
  11: '\u0647\u0648\u062F',
  12: '\u064A\u0648\u0633\u0641',
  13: '\u0627\u0644\u0631\u0639\u062F',
  14: '\u0625\u0628\u0631\u0627\u0647\u064A\u0645',
  15: '\u0627\u0644\u062D\u062C\u0631',
  16: '\u0627\u0644\u0646\u062D\u0644',
  17: '\u0627\u0644\u0625\u0633\u0631\u0627\u0621',
  18: '\u0627\u0644\u0643\u0647\u0641',
  19: '\u0645\u0631\u064A\u0645',
  20: '\u0637\u0647',
  21: '\u0627\u0644\u0623\u0646\u0628\u064A\u0627\u0621',
  22: '\u0627\u0644\u062D\u062C',
  23: '\u0627\u0644\u0645\u0624\u0645\u0646\u0648\u0646',
  24: '\u0627\u0644\u0646\u0648\u0631',
  25: '\u0627\u0644\u0641\u0631\u0642\u0627\u0646',
  26: '\u0627\u0644\u0634\u0639\u0631\u0627\u0621',
  27: '\u0627\u0644\u0646\u0645\u0644',
  28: '\u0627\u0644\u0642\u0635\u0635',
  29: '\u0627\u0644\u0639\u0646\u0643\u0628\u0648\u062A',
  30: '\u0627\u0644\u0631\u0648\u0645',
  31: '\u0644\u0642\u0645\u0627\u0646',
  32: '\u0627\u0644\u0633\u062C\u062F\u0629',
  33: '\u0627\u0644\u0623\u062D\u0632\u0627\u0628',
  34: '\u0633\u0628\u0623',
  35: '\u0641\u0627\u0637\u0631',
  36: '\u064A\u0633',
  37: '\u0627\u0644\u0635\u0627\u0641\u0627\u062A',
  38: '\u0635',
  39: '\u0627\u0644\u0632\u0645\u0631',
  40: '\u063A\u0627\u0641\u0631',
  41: '\u0641\u0635\u0644\u062A',
  42: '\u0627\u0644\u0634\u0648\u0631\u0649',
  43: '\u0627\u0644\u0632\u062E\u0631\u0641',
  44: '\u0627\u0644\u062F\u062E\u0627\u0646',
  45: '\u0627\u0644\u062C\u0627\u062B\u064A\u0629',
  46: '\u0627\u0644\u0623\u062D\u0642\u0627\u0641',
  47: '\u0645\u062D\u0645\u062F',
  48: '\u0627\u0644\u0641\u062A\u062D',
  49: '\u0627\u0644\u062D\u062C\u0631\u0627\u062A',
  50: '\u0642',
  51: '\u0627\u0644\u0630\u0627\u0631\u064A\u0627\u062A',
  52: '\u0627\u0644\u0637\u0648\u0631',
  53: '\u0627\u0644\u0646\u062C\u0645',
  54: '\u0627\u0644\u0642\u0645\u0631',
  55: '\u0627\u0644\u0631\u062D\u0645\u0646',
  56: '\u0627\u0644\u0648\u0627\u0642\u0639\u0629',
  57: '\u0627\u0644\u062D\u062F\u064A\u062F',
  58: '\u0627\u0644\u0645\u062C\u0627\u062F\u0644\u0629',
  59: '\u0627\u0644\u062D\u0634\u0631',
  60: '\u0627\u0644\u0645\u0645\u062A\u062D\u0646\u0629',
  61: '\u0627\u0644\u0635\u0641',
  62: '\u0627\u0644\u062C\u0645\u0639\u0629',
  63: '\u0627\u0644\u0645\u0646\u0627\u0641\u0642\u0648\u0646',
  64: '\u0627\u0644\u062A\u063A\u0627\u0628\u0646',
  65: '\u0627\u0644\u0637\u0644\u0627\u0642',
  66: '\u0627\u0644\u062A\u062D\u0631\u064A\u0645',
  67: '\u0627\u0644\u0645\u0644\u0643',
  68: '\u0627\u0644\u0642\u0644\u0645',
  69: '\u0627\u0644\u062D\u0627\u0642\u0629',
  70: '\u0627\u0644\u0645\u0639\u0627\u0631\u062C',
  71: '\u0646\u0648\u062D',
  72: '\u0627\u0644\u062C\u0646',
  73: '\u0627\u0644\u0645\u0632\u0645\u0644',
  74: '\u0627\u0644\u0645\u062F\u062B\u0631',
  75: '\u0627\u0644\u0642\u064A\u0627\u0645\u0629',
  76: '\u0627\u0644\u0625\u0646\u0633\u0627\u0646',
  77: '\u0627\u0644\u0645\u0631\u0633\u0644\u0627\u062A',
  78: '\u0627\u0644\u0646\u0628\u0623',
  79: '\u0627\u0644\u0646\u0627\u0632\u0639\u0627\u062A',
  80: '\u0639\u0628\u0633',
  81: '\u0627\u0644\u062A\u0643\u0648\u064A\u0631',
  82: '\u0627\u0644\u0627\u0646\u0641\u0637\u0627\u0631',
  83: '\u0627\u0644\u0645\u0637\u0641\u0641\u064A\u0646',
  84: '\u0627\u0644\u0627\u0646\u0634\u0642\u0627\u0642',
  85: '\u0627\u0644\u0628\u0631\u0648\u062C',
  86: '\u0627\u0644\u0637\u0627\u0631\u0642',
  87: '\u0627\u0644\u0623\u0639\u0644\u0649',
  88: '\u0627\u0644\u063A\u0627\u0634\u064A\u0629',
  89: '\u0627\u0644\u0641\u062C\u0631',
  90: '\u0627\u0644\u0628\u0644\u062F',
  91: '\u0627\u0644\u0634\u0645\u0633',
  92: '\u0627\u0644\u0644\u064A\u0644',
  93: '\u0627\u0644\u0636\u062D\u0649',
  94: '\u0627\u0644\u0634\u0631\u062D',
  95: '\u0627\u0644\u062A\u064A\u0646',
  96: '\u0627\u0644\u0639\u0644\u0642',
  97: '\u0627\u0644\u0642\u062F\u0631',
  98: '\u0627\u0644\u0628\u064A\u0646\u0629',
  99: '\u0627\u0644\u0632\u0644\u0632\u0644\u0629',
  100: '\u0627\u0644\u0639\u0627\u062F\u064A\u0627\u062A',
  101: '\u0627\u0644\u0642\u0627\u0631\u0639\u0629',
  102: '\u0627\u0644\u062A\u0643\u0627\u062B\u0631',
  103: '\u0627\u0644\u0639\u0635\u0631',
  104: '\u0627\u0644\u0647\u0645\u0632\u0629',
  105: '\u0627\u0644\u0641\u064A\u0644',
  106: '\u0642\u0631\u064A\u0634',
  107: '\u0627\u0644\u0645\u0627\u0639\u0648\u0646',
  108: '\u0627\u0644\u0643\u0648\u062B\u0631',
  109: '\u0627\u0644\u0643\u0627\u0641\u0631\u0648\u0646',
  110: '\u0627\u0644\u0646\u0635\u0631',
  111: '\u0627\u0644\u0645\u0633\u062F',
  112: '\u0627\u0644\u0625\u062E\u0644\u0627\u0635',
  113: '\u0627\u0644\u0641\u0644\u0642',
  114: '\u0627\u0644\u0646\u0627\u0633',
};

// Standard Uthmani (Medina) mushaf juz start pages (30 juz)
export const JUZ_START_PAGES: number[] = [
  1, 22, 42, 62, 82, 102, 121, 142, 162, 182, 201, 222, 242, 262, 282, 302, 322,
  342, 362, 382, 402, 422, 442, 462, 482, 502, 522, 542, 562, 582,
];

// Standard Uthmani (Medina) mushaf hizb start pages (60 hizb)
const HIZB_START_PAGES: number[] = [
  1, 12, 22, 32, 42, 52, 62, 72, 82, 92, 102, 112, 121, 132, 142, 152, 162, 173,
  182, 192, 201, 212, 222, 232, 242, 252, 262, 272, 282, 292, 302, 312, 322,
  332, 342, 352, 362, 372, 382, 392, 402, 412, 422, 432, 442, 452, 462, 472,
  482, 492, 502, 512, 522, 532, 542, 553, 562, 572, 582, 591,
];

export function getJuzForPage(page: number): number {
  for (let i = JUZ_START_PAGES.length - 1; i >= 0; i--) {
    if (page >= JUZ_START_PAGES[i]) return i + 1;
  }
  return 1;
}

export function getHizbForPage(page: number): number {
  for (let i = HIZB_START_PAGES.length - 1; i >= 0; i--) {
    if (page >= HIZB_START_PAGES[i]) return i + 1;
  }
  return 1;
}

/**
 * Calculate Y positions for mushaf page lines with uniform line heights.
 * Every line (surah_name, basmallah, ayah) gets exactly `baseLineHeight`.
 * Pages 1-2 center the block vertically; pages 3-604 start from the top.
 *
 * `contentHeight` and `baseLineHeight` default to the module-level constants
 * (phone-portrait snapshot). iPad / rotation-aware callers should pass the
 * values returned by `useMushafLayout()` instead.
 *
 * @ai Pass `metrics.centerShortPages` from `getMushafLayout`. It is false
 * where the page scrolls inside a shorter viewport (phone landscape): the
 * centred block would start below the fold there, and the page would look
 * blank.
 */
// @ai-start
/**
 * Room (pt) a mushaf page canvas keeps below its last line. A DigitalKhatt
 * line box is taller than the line pitch, and marks below the last line (an
 * open tanween, a small low meem, a deep tail) reach past the content height:
 * up to about 4.4 pt on an iPhone 17 Pro and 11.2 pt on an iPhone SE-class
 * screen (every page's last ayah line, measured on CanvasKit). The canvas
 * extends this far below the content. It is transparent and the lines keep
 * their positions, so the only change is that those marks are no longer cut.
 */
export function canvasBottomOverflow(fontSize: number): number {
  return Math.ceil(fontSize);
}
// @ai-end

export function calculateLineYPositions(
  lines: {line_type: string}[],
  pageNumber: number,
  contentHeight: number = CONTENT_HEIGHT,
  baseLineHeight: number = BASE_LINE_HEIGHT,
  centerShortPages = true, // @ai
): number[] {
  if ((pageNumber === 1 || pageNumber === 2) && centerShortPages) {
    const totalHeight = lines.length * baseLineHeight;
    const topOffset = (contentHeight - totalHeight) / 2;
    return lines.map((_, i) => topOffset + i * baseLineHeight);
  }

  return lines.map((_, i) => i * baseLineHeight);
}
