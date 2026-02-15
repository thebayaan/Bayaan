import {Dimensions} from 'react-native';

const {width: SCREEN_WIDTH, height: SCREEN_HEIGHT} = Dimensions.get('window');

export const IS_COMPACT_DEVICE = SCREEN_HEIGHT < 700;

export const PAGE_PADDING_HORIZONTAL = IS_COMPACT_DEVICE ? 4 : 8;
export const PAGE_PADDING_TOP = IS_COMPACT_DEVICE ? 90 : 120;
export const PAGE_PADDING_BOTTOM = IS_COMPACT_DEVICE ? 70 : 100;

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
export const AYAH_LINE_SPACING = IS_COMPACT_DEVICE ? 0.75 : 0.7;
export const SURAH_HEADER_TOP_GAP = 0.3;
export const LINES_PER_PAGE = 15;

export const CONTENT_WIDTH = SCREEN_WIDTH - PAGE_PADDING_HORIZONTAL * 2;
export const CONTENT_HEIGHT =
  SCREEN_HEIGHT - PAGE_PADDING_TOP - PAGE_PADDING_BOTTOM;
export const BASE_LINE_HEIGHT = CONTENT_HEIGHT / LINES_PER_PAGE;

export {SCREEN_WIDTH, SCREEN_HEIGHT};

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
const JUZ_START_PAGES: number[] = [
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
 * Calculate Y positions for mushaf page lines, accounting for line type heights.
 * - surah_name lines get 1.0x base height
 * - ayah/basmallah lines get AYAH_LINE_SPACING base height
 * - Pages 1-2 center content vertically
 * - Other pages scale to fill CONTENT_HEIGHT
 */
export function calculateLineYPositions(
  lines: {line_type: string}[],
  pageNumber: number,
): number[] {
  const linePositions: number[] = [];
  let currentY = 0;
  for (let i = 0; i < lines.length; i++) {
    const isSurahName = lines[i].line_type === 'surah_name';

    // Extra gap above mid-page surah headers
    if (isSurahName && i > 0) {
      currentY += BASE_LINE_HEIGHT * SURAH_HEADER_TOP_GAP;
    }

    linePositions.push(currentY);

    // Surah headers get full base height; ayah lines use compressed spacing
    currentY += BASE_LINE_HEIGHT * (isSurahName ? 1.0 : AYAH_LINE_SPACING);
  }
  const totalContentHeight = currentY;
  const shouldCenter = pageNumber === 1 || pageNumber === 2;

  const yPositions: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (shouldCenter) {
      yPositions.push(
        linePositions[i] + (CONTENT_HEIGHT - totalContentHeight) / 2,
      );
    } else {
      const scaleFactor = CONTENT_HEIGHT / totalContentHeight;
      yPositions.push(linePositions[i] * scaleFactor);
    }
  }
  return yPositions;
}
