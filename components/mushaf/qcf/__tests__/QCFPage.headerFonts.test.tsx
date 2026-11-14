// @ai-generated
/**
 * A QCF (Mushaf 1440) page that mounts before the fonts draws its surah
 * header once they arrive. QCFPage memoised the header font on the content
 * width only, so a first render with no fonts kept {dividerFont: null} for
 * good. The test renders the real QCFPage: the control mounts after the
 * fonts.
 */
import React, {act} from 'react';
import TestRenderer from 'react-test-renderer';

const mockFonts = {
  fontMgr: null as object | null,
  typeface: null as object | null,
  listeners: new Set<() => void>(),
};
const mockHeaders = {count: 0, lines: 0};

jest.mock('@shopify/react-native-skia', () => {
  const para = {
    layout: () => undefined,
    getLongestLine: () => 100,
    getHeight: () => 10,
    dispose: () => undefined,
    getRectsForRange: () => [],
  };
  const builder = {
    reset: () => undefined,
    pushStyle: () => undefined,
    pop: () => undefined,
    addText: () => undefined,
    build: () => para,
  };
  return {
    Canvas: ({children}: {children: React.ReactNode}) => children,
    Group: ({children}: {children: React.ReactNode}) => children,
    Paragraph: () => {
      mockHeaders.lines += 1;
      return null;
    },
    RoundedRect: () => null,
    TextAlign: {Center: 1},
    TextDirection: {RTL: 0},
    TextHeightBehavior: {DisableAll: 3},
    Skia: {
      Font: () => ({
        getGlyphIDs: () => [1],
        getGlyphWidths: () => [50],
      }),
      Color: (c: string) => c,
      ParagraphBuilder: {Make: () => builder},
    },
  };
});
jest.mock('react-native-gesture-handler', () => {
  const chain: Record<string, unknown> = {};
  const g = new Proxy(chain, {get: () => () => g});
  return {
    Gesture: {
      Tap: () => g,
      LongPress: () => g,
      Pan: () => g,
      Exclusive: () => g,
      Race: () => g,
      Simultaneous: () => g,
    },
    GestureDetector: ({children}: {children: React.ReactNode}) => children,
  };
});
jest.mock('react-native-worklets', () => ({runOnJS: (fn: unknown) => fn}));
jest.mock('expo-haptics', () => ({}));
jest.mock('react-native-actions-sheet', () => ({SheetManager: {}}));
jest.mock('@/services/mushaf/DigitalKhattDataService', () => ({
  digitalKhattDataService: {
    getPageLines: () => [
      {line_type: 'surah_name', line_number: 1, surah_number: 2},
      {line_type: 'ayah', line_number: 2},
    ],
    getBasmalaSurah: () => null,
  },
  BASMALLAH_TEXT: 'b',
}));
jest.mock('@/services/mushaf/QCFDataService', () => ({
  qcfDataService: {
    getOrderedVerseKeysForPage: () => ['2:1'],
    getWordsForLine: () => [{}],
  },
}));
jest.mock('@/services/mushaf/QCFLineService', () => ({
  buildQCFLineRenderModel: () => ({renderedText: 'x', verseSegments: []}),
  buildQCFLineAllahNameMap: () => null,
  findQCFVerseAtCharIndex: () => null,
}));
jest.mock('@/services/mushaf/QuranTextService', () => ({
  PAGE_WIDTH: 1000,
  FONTSIZE: 100,
}));
jest.mock('@/services/mushaf/QCFFontLoader', () => ({
  qcfFontFamilyForPage: () => 'QCF_P002',
  getQCFFontVariant: () => 'v2',
  qcfFontLoader: {
    isReady: () => true,
    ensure: () => Promise.resolve(),
    prefetch: () => undefined,
  },
}));
jest.mock('@/services/mushaf/QCFLayoutCacheService', () => ({
  qcfLayoutCacheService: {
    getPageLayout: () => null,
    setPageLayout: () => undefined,
  },
}));
jest.mock('@/services/mushaf/QCFVerticalLayout', () => ({
  fitQCFLinePositions: (p: number[]) => p,
}));
jest.mock('@/services/mushaf/MushafPreloadService', () => ({
  mushafPreloadService: {
    get quranCommonTypeface() {
      return mockFonts.typeface;
    },
  },
}));
jest.mock('@/hooks/useMushafFontMgr', () => {
  const R = jest.requireActual<typeof import('react')>('react');
  return {
    useMushafFontMgr: () =>
      R.useSyncExternalStore(
        (l: () => void) => {
          mockFonts.listeners.add(l);
          return () => mockFonts.listeners.delete(l);
        },
        () => mockFonts.fontMgr,
      ),
  };
});
jest.mock('@/services/mushaf/AllahNameHighlightService', () => ({
  getTextAllahNameCharMap: () => null,
}));
jest.mock('@/services/mushaf/ThemeDataService', () => ({
  themeDataService: {getThemeForVerse: () => null},
}));
jest.mock('@/store/mushafSettingsStore', () => ({
  useMushafSettingsStore: Object.assign(
    (sel: (s: object) => unknown) =>
      sel({
        showTajweed: false,
        arabicTextWeight: 0,
        showThemes: false,
        showAllahNameHighlight: false,
        allahNameHighlightColor: 'default',
      }),
    {getState: () => ({})},
  ),
}));
jest.mock('@/store/mushafPlayerStore', () => ({
  usePlaybackBasmalaSurah: () => null,
  usePlaybackVerseKeys: () => [],
}));
jest.mock('@/store/mushafVerseSelectionStore', () => ({
  useMushafVerseSelectionStore: (sel: (s: object) => unknown) =>
    sel({
      selectedVerseKeys: [],
      selectedPageNumber: null,
      selectVerse: () => undefined,
      selectVerseRange: () => undefined,
    }),
}));
jest.mock('@/utils/skiaTextWeight', () => ({
  createTextStrokePaint: () => undefined,
  getArabicTextWeightStrokeWidth: () => 0,
}));
jest.mock('@/constants/mushafAllahHighlight', () => ({
  getAllahNameHighlightColorHex: () => null,
}));
jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({theme: {isDarkMode: false}}),
}));
jest.mock('@/components/mushaf/skia/SkiaSurahHeader', () => ({
  __esModule: true,
  default: () => {
    mockHeaders.count += 1;
    return null;
  },
}));
jest.mock('@/components/mushaf/constants', () => ({
  calculateLineYPositions: (lines: unknown[]) => lines.map((_, i) => i * 50),
  canvasBottomOverflow: () => 0,
}));

import QCFPage from '@/components/mushaf/qcf/QCFPage';

const metrics = {
  pageWidth: 400,
  screenHeight: 800,
  contentWidth: 380,
  contentHeight: 700,
  paddingHorizontal: 10,
  paddingTop: 50,
  baseLineHeight: 40,
} as never;

function fontsArrive() {
  mockFonts.fontMgr = {};
  mockFonts.typeface = {};
  mockFonts.listeners.forEach(l => l());
}

beforeEach(() => {
  mockFonts.fontMgr = null;
  mockFonts.typeface = null;
  mockFonts.listeners.clear();
  mockHeaders.count = 0;
  mockHeaders.lines = 0;
});

const page = (
  <QCFPage
    metrics={metrics}
    pageNumber={2}
    textColor="#000"
    dividerColor="#888"
  />
);

it('control: mounted after the fonts, the page draws its surah header', async () => {
  fontsArrive();
  await act(async () => {
    TestRenderer.create(page);
  });
  expect(mockHeaders.count).toBeGreaterThan(0);
});

it('mounted after the data but before the fonts, the header draws once the fonts arrive', async () => {
  let r!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    r = TestRenderer.create(page);
  });
  expect(mockHeaders.count).toBe(0);
  await act(async () => {
    fontsArrive();
  });
  // The page itself drew its lines after the fonts arrived ...
  expect(r.toJSON()).not.toBeNull();
  expect(mockHeaders.lines).toBeGreaterThan(0);
  // ... so the surah header is there too.
  expect(mockHeaders.count).toBeGreaterThan(0);
});
