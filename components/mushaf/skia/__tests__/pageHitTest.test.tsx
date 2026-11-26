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
 *
 * The same pages pin what the two share (one hook since #541), on each
 * page's own layout: the hit test (the canvas origin, the line lookup and
 * the touch point inside the line's paragraph), the tap (a word marked while
 * reciting opens it, any other tap is the page's own), the long-press and
 * iOS drag-select gestures, and the playback and selection colours.
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
interface MockGesture {
  kind: string;
  config: [string, unknown][];
  handlers: Record<string, (event?: {x: number; y: number}) => void>;
  gestures?: MockGesture[];
}

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
/** Where each touch landed in a paragraph (getGlyphPositionAtCoordinate). */
const mockParagraphReads: {lineIndex: number; x: number; y: number}[] = [];
/** The gesture each page last gave its GestureDetector. */
const mockGestures = {detector: null as MockGesture | null};
const mockDrag = {calls: [] as [string, ...number[]][]};
const mockSheets: {name: string; payload: unknown}[] = [];
const mockRecitation = {
  marks: [] as unknown[],
  /** The line and character the first mark is on (markAtChar). */
  markedAt: null as {lineIndex: number; charIndex: number} | null,
};
const mockTheme = {isDarkMode: false};
const mockHighlightLayers = {
  last: null as {playbackColor: string; selectionColor: string} | null,
};

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
  // A gesture builder that records its configuration and its callbacks.
  const builder = (kind: string) => () => {
    const gesture: MockGesture & Record<string, unknown> = {
      kind,
      config: [],
      handlers: {},
    };
    for (const method of [
      'minDuration',
      'maxDistance',
      'activateAfterLongPress',
      'minDistance',
    ]) {
      gesture[method] = (value: unknown) => {
        gesture.config.push([method, value]);
        return gesture;
      };
    }
    for (const method of ['onStart', 'onUpdate', 'onEnd']) {
      gesture[method] = (handler: () => void) => {
        gesture.handlers[method] = handler;
        return gesture;
      };
    }
    return gesture;
  };
  return {
    Gesture: {
      LongPress: builder('LongPress'),
      Pan: builder('Pan'),
      Tap: builder('Tap'),
      Exclusive: (...gestures: MockGesture[]) => ({
        kind: 'Exclusive',
        config: [],
        handlers: {},
        gestures,
      }),
    },
    GestureDetector: ({
      gesture,
      children,
    }: {
      gesture: MockGesture;
      children?: React.ReactNode;
    }) => {
      mockGestures.detector = gesture;
      return ReactActual.createElement(ReactActual.Fragment, null, children);
    },
  };
});
jest.mock('react-native-worklets', () => ({runOnJS: (fn: unknown) => fn}));
jest.mock('react-native-actions-sheet', () => ({
  SheetManager: {
    show: (name: string, options: {payload: unknown}) => {
      mockSheets.push({name, payload: options.payload});
      return Promise.resolve();
    },
  },
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
  mushafVerseMapService: {
    getShownVerseUnits: () => null,
    // The word flash of a search hit (useWordFlashHighlights).
    getOrderedVerseKeysForPage: () => [],
  },
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
  useTheme: () => ({
    theme: {isDarkMode: mockTheme.isDarkMode},
    isDarkMode: mockTheme.isDarkMode,
  }),
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
  useRecitationTrackingStore: {
    getState: () => ({marks: mockRecitation.marks}),
  },
}));
jest.mock('../recitationTap', () => ({
  markAtChar: (line: MockLine, charIndex: number, marks: unknown[]) => {
    const at = mockRecitation.markedAt;
    const {lines} = mockPage;
    return at && line === lines[at.lineIndex] && charIndex === at.charIndex
      ? marks[0]
      : null;
  },
}));
jest.mock('../SkiaLine', () => {
  const ReactActual = jest.requireActual<typeof import('react')>('react');
  const {quranTextService} = jest.requireMock<{
    quranTextService: {getLineText: (page: number, line: number) => string};
  }>('@/services/mushaf/QuranTextService');
  const makeParagraph = (lineIndex: number) => {
    let disposed = false;
    return {
      getGlyphPositionAtCoordinate: (x: number, y: number) => {
        if (disposed) {
          throw new Error(
            `Attempted to access a disposed object (line ${lineIndex})`,
          );
        }
        mockParagraphReads.push({lineIndex, x, y});
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
  computeUnitPageHighlightLayers: (args: {
    playbackColor: string;
    selectionColor: string;
  }) => {
    mockHighlightLayers.last = {
      playbackColor: args.playbackColor,
      selectionColor: args.selectionColor,
    };
    return null;
  },
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
    onDragStart: (x: number, y: number) => {
      mockDrag.calls.push(['start', x, y]);
    },
    onDragUpdate: (x: number, y: number) => {
      mockDrag.calls.push(['update', x, y]);
    },
    onDragEnd: () => {
      mockDrag.calls.push(['end']);
    },
  };
  return {
    useVerseUnitDragSelect: (_page: number, charAt: MockCharAt) => {
      mockHitTest.charAt = charAt;
      return handlers;
    },
  };
});

import {Platform} from 'react-native';
import SkiaPage from '../SkiaPage';
import MushafPageContent from '../MushafPageContent';
import {buildRenderConstants} from '../continuousRenderConstants';
import {calculateLineYPositions, getMushafLayout} from '../../constants';

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
const onTap = jest.fn();

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
        onTap={onTap}
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
        onTap={onTap}
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

// ── What the two pages share, on each page's own layout ─────────────────

function threeLines(): void {
  mockPage.lines = Array.from({length: LINE_COUNT}, () => ({
    line_type: 'ayah' as const,
    surah_number: 2,
  }));
  mockPage.texts = ['first line', 'second line', 'third line'];
  mockPage.layout = Array.from({length: LINE_COUNT}, () => ({}));
  mockPage.identity = 'hafs@1';
}

function mount(element: JSX.Element): TestRenderer.ReactTestRenderer {
  mockHitTest.charAt = null;
  mockGestures.detector = null;
  mockHighlightLayers.last = null;
  let renderer: TestRenderer.ReactTestRenderer | undefined;
  act(() => {
    renderer = TestRenderer.create(element);
  });
  if (!renderer) throw new Error('no renderer');
  return renderer;
}

/** Where a page's text canvas sits in the page, and where its lines are. */
interface TextFrame {
  originX: number;
  originY: number;
  width: number;
  height: number;
  lineTops: number[];
}

interface LayoutCase {
  name: string;
  render: () => JSX.Element;
  frame: () => TextFrame;
}

const LAYOUTS: LayoutCase[] = [
  {
    // Pages 1 and 2 centre their short block: the lines start lower.
    name: 'SkiaPage, page 1 (a centred short page)',
    render: () => (
      <SkiaPage
        pageNumber={1}
        textColor="#111111"
        dividerColor="#666666"
        {...PAGED}
      />
    ),
    frame: () => ({
      originX: PAGED.paddingHorizontal,
      originY: PAGED.paddingTop,
      width: PAGED.contentWidth,
      height: PAGED.contentHeight,
      lineTops: calculateLineYPositions(
        mockPage.lines,
        1,
        PAGED.contentHeight,
        PAGED.baseLineHeight,
      ),
    }),
  },
  {
    name: 'SkiaPage, a page with a left content margin',
    render: () => (
      <SkiaPage
        pageNumber={PAGE}
        textColor="#111111"
        dividerColor="#666666"
        contentMarginLeft={30}
        {...PAGED}
      />
    ),
    frame: () => ({
      originX: 30,
      originY: PAGED.paddingTop,
      width: PAGED.contentWidth,
      height: PAGED.contentHeight,
      lineTops: mockPage.lines.map((_, i) => i * PAGED.baseLineHeight),
    }),
  },
  {
    name: 'MushafPageContent',
    render: PAGES[1].render,
    frame: () => ({
      originX: CONTINUOUS.canvasMarginX,
      originY: 0,
      width: CONTINUOUS.contentWidth,
      height: 15 * CONTINUOUS.baseLineHeight,
      lineTops: mockPage.lines.map((_, i) => i * CONTINUOUS.baseLineHeight),
    }),
  },
];

describe.each(LAYOUTS)('the hit test of $name', ({render, frame}) => {
  let renderer: TestRenderer.ReactTestRenderer | undefined;

  beforeEach(() => {
    threeLines();
    mockParagraphReads.length = 0;
  });

  afterEach(() => {
    act(() => renderer?.unmount());
    renderer = undefined;
  });

  it("maps a touch on each line to that line, at the touch's place in its paragraph", () => {
    renderer = mount(render());
    const {originX, originY, lineTops} = frame();
    for (let lineIndex = 0; lineIndex < LINE_COUNT; lineIndex++) {
      const hit = hitAt({
        x: originX + 20,
        y: originY + lineTops[lineIndex] + 3,
      });
      expect(hit).toEqual({lineIndex, charIndex: 7});
      expect(mockParagraphReads[mockParagraphReads.length - 1]).toEqual({
        lineIndex,
        x: 20 - MOCK_X_POS,
        y: 3,
      });
    }
  });

  it('finds no text outside the text canvas', () => {
    renderer = mount(render());
    const {originX, originY, width, height, lineTops} = frame();
    const y = originY + lineTops[0] + 3;
    expect(hitAt({x: originX - 1, y})).toBeNull();
    expect(hitAt({x: originX + width + 1, y})).toBeNull();
    expect(hitAt({x: originX + 20, y: originY - 1})).toBeNull();
    expect(hitAt({x: originX + 20, y: originY + height + 1})).toBeNull();
    expect(mockParagraphReads).toHaveLength(0);
  });

  it('finds no text on a surah name line', () => {
    mockPage.lines[1] = {line_type: 'surah_name', surah_number: 3};
    renderer = mount(render());
    const {originX, originY, lineTops} = frame();
    expect(hitAt({x: originX + 20, y: originY + lineTops[1] + 3})).toBeNull();
    expect(hitAt({x: originX + 20, y: originY + lineTops[2] + 3})).toEqual({
      lineIndex: 2,
      charIndex: 7,
    });
  });
});

describe.each(PAGES)('the tap on $name', ({render, pointOnLine}) => {
  let renderer: TestRenderer.ReactTestRenderer | undefined;
  const MARK = {surah: 2, ayah: 5, word: 1, kind: 'wrong'};

  function tap(point: {x: number; y: number}): void {
    const tapGesture = mockGestures.detector?.gestures?.[1];
    if (tapGesture?.kind !== 'Tap') throw new Error('no tap gesture');
    act(() => tapGesture.handlers.onEnd(point));
  }

  beforeEach(() => {
    threeLines();
    onTap.mockClear();
    mockSheets.length = 0;
    mockParagraphReads.length = 0;
    mockRecitation.marks = [];
    mockRecitation.markedAt = null;
  });

  afterEach(() => {
    act(() => renderer?.unmount());
    renderer = undefined;
  });

  it("is the page's own while nothing is marked, with no hit test", () => {
    renderer = mount(render());
    tap(pointOnLine(1));
    expect(onTap).toHaveBeenCalledTimes(1);
    expect(mockSheets).toHaveLength(0);
    expect(mockParagraphReads).toHaveLength(0);
  });

  it('opens the mark under the touch', () => {
    mockRecitation.marks = [MARK];
    mockRecitation.markedAt = {lineIndex: 1, charIndex: 7};
    renderer = mount(render());
    tap(pointOnLine(1));
    expect(mockSheets).toEqual([
      {name: 'recitation-mistake', payload: {mark: MARK}},
    ]);
    expect(onTap).not.toHaveBeenCalled();
  });

  it("is the page's own on a word that is not marked", () => {
    mockRecitation.marks = [MARK];
    mockRecitation.markedAt = {lineIndex: 1, charIndex: 7};
    renderer = mount(render());
    tap(pointOnLine(0));
    expect(onTap).toHaveBeenCalledTimes(1);
    expect(mockSheets).toHaveLength(0);
  });
});

describe.each(PAGES)('the gestures of $name', ({render}) => {
  let renderer: TestRenderer.ReactTestRenderer | undefined;

  beforeEach(() => {
    threeLines();
    mockDrag.calls = [];
  });

  afterEach(() => {
    act(() => renderer?.unmount());
    renderer = undefined;
  });

  it('on iOS: a pan after a 400 ms press drag-selects, and a tap', () => {
    const replaced = jest.replaceProperty(Platform, 'OS', 'ios');
    try {
      renderer = mount(render());
    } finally {
      replaced.restore();
    }
    const detector = mockGestures.detector;
    expect(detector?.kind).toBe('Exclusive');
    const [press, tapGesture] = detector?.gestures ?? [];
    expect(press.kind).toBe('Pan');
    expect(press.config).toEqual([
      ['activateAfterLongPress', 400],
      ['minDistance', 0],
    ]);
    expect(tapGesture.kind).toBe('Tap');
    press.handlers.onStart({x: 1, y: 2});
    press.handlers.onUpdate({x: 3, y: 4});
    press.handlers.onEnd();
    expect(mockDrag.calls).toEqual([
      ['start', 1, 2],
      ['update', 3, 4],
      ['end'],
    ]);
  });

  it('on Android: a still 400 ms long-press selects, and a tap', () => {
    const replaced = jest.replaceProperty(Platform, 'OS', 'android');
    try {
      renderer = mount(render());
    } finally {
      replaced.restore();
    }
    const [press, tapGesture] = mockGestures.detector?.gestures ?? [];
    expect(press.kind).toBe('LongPress');
    expect(press.config).toEqual([
      ['minDuration', 400],
      ['maxDistance', 20],
    ]);
    expect(press.handlers.onUpdate).toBeUndefined();
    expect(tapGesture.kind).toBe('Tap');
    press.handlers.onStart({x: 1, y: 2});
    press.handlers.onEnd();
    expect(mockDrag.calls).toEqual([['start', 1, 2], ['end']]);
  });
});

describe.each(PAGES)('the highlight colours of $name', ({render}) => {
  let renderer: TestRenderer.ReactTestRenderer | undefined;

  beforeEach(() => {
    threeLines();
  });

  afterEach(() => {
    act(() => renderer?.unmount());
    renderer = undefined;
    mockTheme.isDarkMode = false;
  });

  it('paints playback and selection in the text colour, in light mode', () => {
    mockTheme.isDarkMode = false;
    renderer = mount(render());
    expect(mockHighlightLayers.last).toEqual({
      playbackColor: 'rgba(17, 17, 17, 0.12)',
      selectionColor: 'rgba(17, 17, 17, 0.18)',
    });
  });

  it('paints them lighter in dark mode', () => {
    mockTheme.isDarkMode = true;
    renderer = mount(render());
    expect(mockHighlightLayers.last).toEqual({
      playbackColor: 'rgba(17, 17, 17, 0.1)',
      selectionColor: 'rgba(17, 17, 17, 0.15)',
    });
  });
});
