// @ai-generated
/**
 * The hit test of the two DigitalKhatt page renderers: SkiaPage (the paged
 * view) and MushafPageContent (a page of the vertical view). Each keeps the
 * paragraph of each drawn line for its hit test. A line that stops drawing
 * while its page stays mounted (its text goes empty, or it has no layout
 * any more) disposes its paragraph, and its entry leaves the hit test with
 * it: a touch on that line finds no text and never reads the freed
 * paragraph.
 *
 * SkiaLine is a stand-in with SkiaLine's contract: it builds one paragraph
 * for a line with text, registers it in an effect (onParagraphReady), and in
 * the cleanup of that paragraph calls onParagraphDisposed and then disposes
 * it. A disposed paragraph throws on use, as Skia's does. The hit test is
 * read through the charAt function each page gives useVerseUnitDragSelect.
 */

import React, {act} from 'react';
import TestRenderer from 'react-test-renderer';
import type {SkParagraph} from '@shopify/react-native-skia';

// Types used inside the jest.mock factories (which may only reference
// mock-prefixed names).
interface MockLine {
  line_type: 'surah_name' | 'basmallah' | 'ayah';
  surah_number: number;
}
interface MockSkiaLineProps {
  pageNumber: number;
  lineIndex: number;
  textIdentity?: string | null;
  onParagraphReady?: (
    lineIndex: number,
    paragraph: SkParagraph,
    xPos: number,
  ) => void;
  onParagraphDisposed?: (lineIndex: number) => void;
}
type MockCharAt = (
  x: number,
  y: number,
) => {lineIndex: number; charIndex: number} | null;

// Shared with the mock factories below (read lazily, after module init).
const mockPage = {
  lines: [] as MockLine[],
  /** The text of each line (quranTextService.getLineText). */
  texts: [] as string[],
  /** The layout of each line; a line with none is not drawn. */
  layout: [] as unknown[],
  identity: 'hafs@1',
  listeners: new Set<() => void>(),
};
/** Where each stand-in SkiaLine draws its paragraph (its xPos). */
const MOCK_X_POS = -500;
const mockHitTest = {charAt: null as MockCharAt | null};

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
// The Canvas draws its children in a React root of its own, from a layout
// effect, as Skia's Canvas does: a line's effects run after its page's.
jest.mock('@shopify/react-native-skia', () => {
  const ReactActual = jest.requireActual<typeof import('react')>('react');
  const Renderer = jest.requireActual<typeof import('react-test-renderer')>(
    'react-test-renderer',
  );
  const Canvas = ({children}: {children?: React.ReactNode}) => {
    const root = ReactActual.useRef<ReturnType<typeof Renderer.create> | null>(
      null,
    );
    ReactActual.useLayoutEffect(() => {
      const element = ReactActual.createElement(
        ReactActual.Fragment,
        null,
        children,
      ) as unknown as Parameters<typeof Renderer.create>[0];
      if (root.current) root.current.update(element);
      else root.current = Renderer.create(element);
    }, [children]);
    ReactActual.useEffect(
      () => () => {
        root.current?.unmount();
        root.current = null;
      },
      [],
    );
    return null;
  };
  return {Canvas, Skia: {}};
});
jest.mock('@/hooks/useMushafFontMgr', () => {
  const fontMgr = {};
  return {useMushafFontMgr: () => fontMgr};
});
jest.mock('react-native-gesture-handler', () => {
  const ReactActual = jest.requireActual<typeof import('react')>('react');
  const builder = (): Record<string, () => unknown> => {
    const gesture: Record<string, () => unknown> = {};
    for (const method of [
      'minDuration',
      'maxDistance',
      'activateAfterLongPress',
      'minDistance',
      'onStart',
      'onUpdate',
      'onEnd',
    ]) {
      gesture[method] = () => gesture;
    }
    return gesture;
  };
  return {
    Gesture: {
      LongPress: builder,
      Pan: builder,
      Tap: builder,
      Exclusive: () => ({}),
    },
    GestureDetector: ({children}: {children?: React.ReactNode}) =>
      ReactActual.createElement(ReactActual.Fragment, null, children),
  };
});
jest.mock('react-native-worklets', () => ({runOnJS: (fn: unknown) => fn}));
jest.mock('react-native-actions-sheet', () => ({
  SheetManager: {show: () => Promise.resolve()},
}));
jest.mock('@/services/mushaf/QuranTextService', () => ({
  quranTextService: {
    getLineInfo: () => ({lineWidthRatio: 1}),
    getLineText: (_page: number, lineIndex: number) =>
      mockPage.texts[lineIndex] ?? '',
  },
  PAGE_WIDTH: 1000,
  MARGIN: 10,
  FONTSIZE: 100,
}));
jest.mock('@/services/mushaf/JustificationService', () => ({
  JustService: {
    getCachedPageLayout: () => mockPage.layout,
    getPageLayout: () => mockPage.layout,
  },
}));
jest.mock('@/services/mushaf/DigitalKhattDataService', () => ({
  digitalKhattDataService: {
    rewayah: 'hafs',
    getPageLines: () => mockPage.lines,
    getBasmalaSurah: () => null,
    subscribeCacheChanges: (listener: () => void) => {
      mockPage.listeners.add(listener);
      return () => {
        mockPage.listeners.delete(listener);
      };
    },
  },
  getRewayahFontFamily: () => 'DigitalKhattV2',
}));
jest.mock('@/services/mushaf/MushafLayoutCacheService', () => ({
  mushafLayoutCacheService: {setPageLayout: () => undefined},
}));
jest.mock('@/services/mushaf/MushafVerseMapService', () => ({
  mushafVerseMapService: {getShownVerseUnits: () => null},
}));
jest.mock('@/services/mushaf/RewayahVerseUnitsService', () => ({
  rewayahVerseUnitsService: {
    subscribe: () => () => undefined,
    getVersion: () => 0,
  },
}));
jest.mock('@/services/mushaf/ThemeDataService', () => ({
  themeDataService: {},
}));
jest.mock('@/services/mushaf/MushafPreloadService', () => ({
  mushafPreloadService: {quranCommonTypeface: null},
}));
jest.mock('@/constants/mushafAllahHighlight', () => ({
  getAllahNameHighlightColorHex: () => '#000000',
}));
jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({theme: {isDarkMode: false}, isDarkMode: false}),
}));
jest.mock('@/store/mushafSettingsStore', () => {
  const settings = {
    showTajweed: false,
    showThemes: false,
    uthmaniFont: 'v2',
    mushafRenderer: 'dk_v2',
    arabicTextWeight: 'normal',
    showAllahNameHighlight: false,
    allahNameHighlightColor: 'default',
    rewayah: 'hafs',
    showRewayahDiffs: false,
  };
  return {
    useMushafSettingsStore: (selector: (s: typeof settings) => unknown) =>
      selector(settings),
  };
});
jest.mock('@/store/tajweedStore', () => ({
  useTajweedStore: (selector: (s: {indexedTajweedData: null}) => unknown) =>
    selector({indexedTajweedData: null}),
}));
jest.mock('@/store/mushafVerseSelectionStore', () => {
  const selection = {
    selectedVerseKeys: [],
    selectedRewayah: null,
    selectedPageNumber: null,
  };
  return {
    useMushafVerseSelectionStore: (
      selector: (s: typeof selection) => unknown,
    ) => selector(selection),
  };
});
jest.mock('@/store/verseAnnotationsStore', () => {
  const annotations = {
    highlights: {},
    bookmarkedVerseKeys: new Set<string>(),
    bookmarkRows: [],
    highlightRows: [],
  };
  return {
    useVerseAnnotationsStore: (selector: (s: typeof annotations) => unknown) =>
      selector(annotations),
  };
});
jest.mock('@/store/mushafPlayerStore', () => ({
  usePlaybackBasmalaSurah: () => null,
}));
jest.mock('@/store/recitationTrackingStore', () => ({
  useRecitationTrackingStore: {getState: () => ({marks: []})},
}));
jest.mock('../SkiaLine', () => {
  const ReactActual = jest.requireActual<typeof import('react')>('react');
  const {quranTextService} = jest.requireMock<{
    quranTextService: {getLineText: (page: number, line: number) => string};
  }>('@/services/mushaf/QuranTextService');
  const makeParagraph = (lineIndex: number) => {
    let disposed = false;
    return {
      getGlyphPositionAtCoordinate: () => {
        if (disposed) {
          throw new Error(
            `Attempted to access a disposed object (line ${lineIndex})`,
          );
        }
        return 7;
      },
      dispose: () => {
        disposed = true;
      },
    } as unknown as SkParagraph;
  };
  const MockSkiaLine = ({
    pageNumber,
    lineIndex,
    textIdentity,
    onParagraphReady,
    onParagraphDisposed,
  }: MockSkiaLineProps) => {
    const paragraph = ReactActual.useMemo(
      () =>
        quranTextService.getLineText(pageNumber, lineIndex)
          ? makeParagraph(lineIndex)
          : null,
      // textIdentity: the line text follows it, as in SkiaLine.
      [pageNumber, lineIndex, textIdentity],
    );
    ReactActual.useEffect(
      () => () => {
        if (paragraph) {
          onParagraphDisposed?.(lineIndex);
        }
        paragraph?.dispose();
      },
      [paragraph, lineIndex, onParagraphDisposed],
    );
    ReactActual.useEffect(() => {
      if (paragraph && onParagraphReady) {
        onParagraphReady(lineIndex, paragraph, MOCK_X_POS);
      }
    }, [paragraph, lineIndex, onParagraphReady]);
    return null;
  };
  return {__esModule: true, default: MockSkiaLine};
});
jest.mock('../SkiaSurahHeader', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../pageOverlays', () => ({
  computeLineAllahNameColorMaps: () => null,
  computeLineCharRuleMaps: () => null,
  computeLineTajweedMaps: () => null,
  computePageDiffBackgrounds: () => null,
  getPageTextIdentity: () => mockPage.identity,
  isRewayahDiffPaintEnabled: () => false,
  isTajweedEnabled: () => false,
}));
jest.mock('../verseHighlightLayers', () => ({
  basmalaPlaybackLines: () => null,
  computeUnitPageHighlightLayers: () => null,
}));
jest.mock('../playbackBand', () => ({usePlaybackBand: () => null}));
jest.mock('../useRecitationLineHighlights', () => {
  const none = new Map();
  return {useRecitationLineHighlights: () => none};
});
jest.mock('../useRecitationHiddenText', () => ({
  useRecitationHiddenText: () => null,
}));
jest.mock('../useRecitationMarkColors', () => ({
  useRecitationMarkColors: () => null,
}));
jest.mock('../verseUnitDragSelect', () => {
  const handlers = {
    onDragStart: () => undefined,
    onDragUpdate: () => undefined,
    onDragEnd: () => undefined,
  };
  return {
    useVerseUnitDragSelect: (_page: number, charAt: MockCharAt) => {
      mockHitTest.charAt = charAt;
      return handlers;
    },
  };
});

import SkiaPage from '../SkiaPage';
import MushafPageContent from '../MushafPageContent';
import {buildRenderConstants} from '../continuousRenderConstants';
import {getMushafLayout} from '../../constants';

declare const global: {IS_REACT_ACT_ENVIRONMENT?: boolean};
global.IS_REACT_ACT_ENVIRONMENT = true;

const PAGE = 50;
const LINE_COUNT = 3;

/** The paged view's page box (explicit metrics: no default constants). */
const PAGED = {
  screenWidth: 400,
  screenHeight: 800,
  contentWidth: 384,
  contentHeight: 600,
  baseLineHeight: 40,
  paddingHorizontal: 8,
  paddingTop: 100,
};
const CONTINUOUS = buildRenderConstants(
  getMushafLayout({width: 390, height: 844, isTablet: false}),
);

interface PageCase {
  name: string;
  render: () => JSX.Element;
  /** A touch point in the middle of a line, in the page's own frame. */
  pointOnLine: (lineIndex: number) => {x: number; y: number};
}

const PAGES: PageCase[] = [
  {
    name: 'SkiaPage (paged view)',
    render: () => (
      <SkiaPage
        pageNumber={PAGE}
        textColor="#111111"
        dividerColor="#666666"
        {...PAGED}
      />
    ),
    pointOnLine: lineIndex => ({
      x: PAGED.paddingHorizontal + 20,
      y:
        PAGED.paddingTop +
        lineIndex * PAGED.baseLineHeight +
        PAGED.baseLineHeight / 2,
    }),
  },
  {
    name: 'MushafPageContent (vertical view)',
    render: () => (
      <MushafPageContent
        pageNumber={PAGE}
        fontMgr={{} as never}
        textColor="#111111"
        dividerColor="#666666"
        showTajweed={false}
        indexedTajweedData={null}
        fontFamily="DigitalKhattV2"
        arabicTextWeight="normal"
        showAllahNameHighlight={false}
        allahNameHighlightColor="#000000"
        rewayah="hafs"
        showRewayahDiffs={false}
        textIdentity={mockPage.identity}
        dividerFont={null}
        nameFontSize={0}
        render={CONTINUOUS}
        pageHeight={15 * CONTINUOUS.baseLineHeight}
      />
    ),
    pointOnLine: lineIndex => ({
      x: CONTINUOUS.canvasMarginX + 20,
      y: lineIndex * CONTINUOUS.baseLineHeight + CONTINUOUS.baseLineHeight / 2,
    }),
  },
];

function hitAt(point: {x: number; y: number}) {
  const charAt = mockHitTest.charAt;
  if (!charAt) throw new Error('the page gave no hit test');
  return charAt(point.x, point.y);
}

describe.each(PAGES)('$name', ({render, pointOnLine}) => {
  let renderer: TestRenderer.ReactTestRenderer;

  /** A new text (a rewayah switch, a data reload) reaches the page. */
  function textChanges(): void {
    act(() => {
      mockPage.identity = 'hafs@2';
      for (const listener of [...mockPage.listeners]) listener();
      renderer.update(render());
    });
  }

  beforeEach(() => {
    mockPage.lines = Array.from({length: LINE_COUNT}, () => ({
      line_type: 'ayah' as const,
      surah_number: 2,
    }));
    mockPage.texts = ['first line', 'second line', 'third line'];
    mockPage.layout = Array.from({length: LINE_COUNT}, () => ({}));
    mockPage.identity = 'hafs@1';
    mockHitTest.charAt = null;
    act(() => {
      renderer = TestRenderer.create(render());
    });
  });

  afterEach(() => {
    act(() => renderer.unmount());
  });

  it('finds the text under a touch on each drawn line', () => {
    for (let lineIndex = 0; lineIndex < LINE_COUNT; lineIndex++) {
      expect(hitAt(pointOnLine(lineIndex))).toEqual({lineIndex, charIndex: 7});
    }
  });

  it('finds no text on a line whose text goes empty, and never reads its freed paragraph', () => {
    mockPage.texts = ['first line', '', 'third line'];
    textChanges();
    expect(() => hitAt(pointOnLine(1))).not.toThrow();
    expect(hitAt(pointOnLine(1))).toBeNull();
    expect(hitAt(pointOnLine(0))).toEqual({lineIndex: 0, charIndex: 7});
    expect(hitAt(pointOnLine(2))).toEqual({lineIndex: 2, charIndex: 7});
  });

  it('finds no text on a line that has no layout any more, and never reads its freed paragraph', () => {
    mockPage.layout = [{}, undefined, {}];
    textChanges();
    expect(() => hitAt(pointOnLine(1))).not.toThrow();
    expect(hitAt(pointOnLine(1))).toBeNull();
    expect(hitAt(pointOnLine(0))).toEqual({lineIndex: 0, charIndex: 7});
    expect(hitAt(pointOnLine(2))).toEqual({lineIndex: 2, charIndex: 7});
  });
});
