// @ai-generated
/**
 * The mushaf page renderers (SkiaPage, ContinuousMushafView) follow the
 * identity of the text they draw (the active DigitalKhatt data), not every
 * DigitalKhatt cache event:
 * - across a rewayah switch, no line is ever built from the new text with a
 *   layout (justification) computed for other text, not even for one frame;
 * - a side-cache load, or a failed one, for another rewayah (the player, a
 *   share, the word-by-word sheet) neither re-renders a mounted page nor
 *   rebuilds its lines.
 *
 * The same holds for a font change: a line is never built with the layout of
 * another font.
 *
 * DigitalKhattDataService is the fixture-backed stand-in (real slot texts of
 * the bundled words DBs) with a data identity and cache listeners added.
 * JustService is a stand-in whose layouts mark the line text and font they
 * were computed for, and Skia's ParagraphBuilder records what each paragraph
 * it builds holds, so every line built can be checked against its layout.
 */

import React, {act} from 'react';
import TestRenderer from 'react-test-renderer';
import type {DKLine} from '@/services/mushaf/DigitalKhattDataService';
import type {RewayahId} from '@/services/rewayah/RewayahIdentity';
import type {FixtureDb} from '@/services/mushaf/__fixtures__/rewayahOverlayFixture';

// Types used inside the jest.mock factories (which may only reference
// mock-prefixed names).
type MockDKLine = DKLine;
type MockRewayahId = RewayahId;
type MockFixtureDb = FixtureDb;
interface MockStyle {
  fontFamilies?: string[];
  fontFeatures?: {name: string; value: number}[];
}
interface MockFlashListProps {
  data: number[];
  renderItem: (info: {item: number; index: number}) => React.ReactNode;
}

interface MockParagraph {
  text: string;
  font: string | undefined;
  /** Ids (mockLayouts.textIds) of the texts its layout marks were computed for. */
  layoutOf: number[];
  /** Ids (mockLayouts.fontIds) of the fonts its layout marks were computed for. */
  layoutFont: number[];
}

// Shared with the mock factories below (read lazily, after module init).
const mockSkia = {
  paragraphs: [] as MockParagraph[],
  canvasRenders: 0,
  canvasMounts: 0,
};

function mockIdIn(ids: Map<string, number>, key: string): number {
  let id = ids.get(key);
  if (id === undefined) {
    id = ids.size + 1;
    ids.set(key, id);
  }
  return id;
}

const mockLayouts = {
  // Keyed by data identity, font, size and page (like the MMKV layer).
  cache: new Map<string, unknown[]>(),
  textIds: new Map<string, number>(),
  fontIds: new Map<string, number>(),
  computed: 0,
};

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('@shopify/react-native-skia', () => {
  const ReactActual = jest.requireActual<typeof import('react')>('react');
  const makeBuilder = () => {
    const styles: MockStyle[] = [];
    let text = '';
    let font: string | undefined;
    const layoutOf: number[] = [];
    const layoutFont: number[] = [];
    const builder = {
      pushStyle(style: MockStyle) {
        if (styles.length === 0) font = style.fontFamilies?.[0];
        styles.push(style);
        return builder;
      },
      pop() {
        styles.pop();
        return builder;
      },
      addText(chunk: string) {
        for (const feature of styles[styles.length - 1]?.fontFeatures ?? []) {
          if (feature.name === 'layout-of') layoutOf.push(feature.value);
          if (feature.name === 'layout-font') layoutFont.push(feature.value);
        }
        text += chunk;
        return builder;
      },
      build() {
        const paragraph = {
          text,
          font,
          layoutOf,
          layoutFont,
          layout: () => undefined,
          getLongestLine: () => 0,
          getHeight: () => 0,
          getRectsForRange: () => [],
          getGlyphPositionAtCoordinate: () => 0,
          dispose: () => undefined,
        };
        mockSkia.paragraphs.push(paragraph);
        return paragraph;
      },
    };
    return builder;
  };
  const Canvas = ({children}: {children?: React.ReactNode}) => {
    mockSkia.canvasRenders += 1;
    ReactActual.useEffect(() => {
      mockSkia.canvasMounts += 1;
    }, []);
    return ReactActual.createElement(ReactActual.Fragment, null, children);
  };
  const Group = ({children}: {children?: React.ReactNode}) =>
    ReactActual.createElement(ReactActual.Fragment, null, children);
  return {
    Canvas,
    Group,
    Paragraph: () => null,
    RoundedRect: () => null,
    Skia: {
      Color: (color: string) => color,
      ParagraphBuilder: {Make: () => makeBuilder()},
    },
    TextAlign: {Left: 0},
    TextDirection: {RTL: 0},
    TextHeightBehavior: {DisableAll: 3},
    PaintStyle: {Stroke: 1},
    StrokeCap: {Round: 1},
    StrokeJoin: {Round: 1},
  };
});

jest.mock('@/services/mushaf/DigitalKhattDataService', () => {
  const actual = jest.requireActual<
    typeof import('@/services/mushaf/DigitalKhattDataService')
  >('@/services/mushaf/DigitalKhattDataService');
  const {createFakeDKService} = jest.requireActual<
    typeof import('@/services/mushaf/__fixtures__/rewayahOverlayFixture')
  >('@/services/mushaf/__fixtures__/rewayahOverlayFixture');
  const base = createFakeDKService(actual.BASMALLAH_TEXT);
  const listeners = new Set<() => void>();
  let version = 0;
  let identity: string | null = null;
  const service = {
    get rewayah() {
      return base.rewayah;
    },
    get initialized() {
      return identity !== null;
    },
    getCacheVersion: () => version,
    subscribeCacheChanges: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getLayoutIdentityKey: () => identity,
    getPageLines: (page: number) => base.getPageLines(page),
    getWordText: (wordId: number) => base.getWordText(wordId),
    getWordInfo: (wordId: number) => base.getWordInfo(wordId),
    getLineText: (line: MockDKLine) => base.getLineText(line),
    getVerseWords: (verseKey: string, rewayah?: MockRewayahId) =>
      base.getVerseWords(verseKey, rewayah),
    getVerseText: (verseKey: string, rewayah?: MockRewayahId) =>
      base.getVerseText(verseKey, rewayah),
    getSurahStartPages: () => ({}),
    getPageToSurah: () => ({}),
    /** swapMain: words, identity (content-addressed) and version flip together. */
    swapMain(db: MockFixtureDb) {
      base.load(db);
      identity = `${base.rewayah}@fixture-${db}`;
      version += 1;
    },
    /** A side-cache load or failed load: a cache event, same main text. */
    sideCacheEvent() {
      version += 1;
      service.notify();
    },
    notify() {
      for (const listener of [...listeners]) listener();
    },
  };
  return {...actual, digitalKhattDataService: service};
});

jest.mock('@/services/mushaf/JustificationService', () => {
  const layoutKey = (ratio: number, page: number, font: string): string => {
    const {
      digitalKhattDataService,
    } = require('@/services/mushaf/DigitalKhattDataService');
    return `${digitalKhattDataService.getLayoutIdentityKey()}|${font}|${ratio}|${page}`;
  };
  return {
    JustService: {
      getCachedPageLayout: (ratio: number, page: number, font: string) =>
        mockLayouts.cache.get(layoutKey(ratio, page, font)),
      getPageLayout: (
        page: number,
        ratio: number,
        _fontMgr: unknown,
        font: string,
      ) => {
        const key = layoutKey(ratio, page, font);
        const cached = mockLayouts.cache.get(key);
        if (cached) return cached;
        const {
          digitalKhattDataService,
        } = require('@/services/mushaf/DigitalKhattDataService');
        const {
          quranTextService,
        } = require('@/services/mushaf/QuranTextService');
        // Each line's layout marks (through font features on its first
        // character) the line text and the font it was computed for.
        const layout = digitalKhattDataService
          .getPageLines(page)
          .map((_line: MockDKLine, lineIndex: number) => ({
            fontFeatures: new Map([
              [
                0,
                [
                  {
                    name: 'layout-of',
                    value: mockIdIn(
                      mockLayouts.textIds,
                      quranTextService.getLineText(page, lineIndex),
                    ),
                  },
                  {
                    name: 'layout-font',
                    value: mockIdIn(mockLayouts.fontIds, font),
                  },
                ],
              ],
            ]),
            simpleSpacing: 100,
            ayaSpacing: 100,
            fontSizeRatio: 1,
          }));
        mockLayouts.computed += 1;
        mockLayouts.cache.set(key, layout);
        return layout;
      },
      clearPageLayoutCache: () => undefined,
    },
  };
});

jest.mock('@/services/mushaf/MushafLayoutCacheService', () => ({
  mushafLayoutCacheService: {
    getPageLayout: () => undefined,
    setPageLayout: () => undefined,
  },
}));

jest.mock('@/services/mushaf/MushafPreloadService', () => ({
  mushafPreloadService: {quranCommonTypeface: null},
}));

jest.mock('@/hooks/useMushafFontMgr', () => {
  const fontMgr = {};
  return {useMushafFontMgr: () => fontMgr};
});

jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({theme: {isDarkMode: false}, isDarkMode: false}),
}));

jest.mock('../SkiaSurahHeader', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('react-native-gesture-handler', () => {
  const gesture = (): Record<string, unknown> => {
    const chain: Record<string, unknown> = {};
    for (const method of [
      'minDuration',
      'maxDistance',
      'activateAfterLongPress',
      'minDistance',
      'onStart',
      'onUpdate',
      'onEnd',
    ]) {
      chain[method] = () => chain;
    }
    return chain;
  };
  return {
    Gesture: {
      LongPress: gesture,
      Pan: gesture,
      Tap: gesture,
      Exclusive: () => ({}),
    },
    GestureDetector: ({children}: {children: React.ReactNode}) => children,
  };
});

jest.mock('react-native-worklets', () => ({
  runOnJS: (fn: unknown) => fn,
}));

jest.mock('expo-haptics', () => ({
  impactAsync: () => undefined,
  ImpactFeedbackStyle: {Light: 'light', Medium: 'medium'},
}));

jest.mock('react-native-actions-sheet', () => ({
  SheetManager: {show: () => undefined},
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({top: 0, bottom: 0, left: 0, right: 0}),
}));

// Renders the item of page 4 only (the fixture page under test).
jest.mock('@shopify/flash-list', () => {
  const ReactActual = jest.requireActual<typeof import('react')>('react');
  const FlashList = ReactActual.forwardRef((props: MockFlashListProps, ref) => {
    ReactActual.useImperativeHandle(ref, () => ({
      scrollToIndex: () => undefined,
    }));
    return ReactActual.createElement(
      ReactActual.Fragment,
      null,
      props.data
        .filter(page => page === 4)
        .map(page =>
          ReactActual.createElement(
            ReactActual.Fragment,
            {key: page},
            props.renderItem({item: page, index: page - 1}),
          ),
        ),
    );
  });
  return {FlashList};
});

jest.mock('@/store/mushafPlayerStore', () => {
  const idle: string[] = [];
  return {usePlaybackVerseKeys: () => idle};
});

jest.mock('@/store/verseAnnotationsStore', () => {
  const {create} = jest.requireActual<typeof import('zustand')>('zustand');
  return {
    useVerseAnnotationsStore: create(() => ({
      highlights: {},
      bookmarkedVerseKeys: new Set<string>(),
      loadAnnotationsForSurah: () => undefined,
    })),
  };
});

jest.mock('@/store/tajweedStore', () => {
  const {create} = jest.requireActual<typeof import('zustand')>('zustand');
  return {useTajweedStore: create(() => ({indexedTajweedData: null}))};
});

jest.mock('@/services/mushaf/ThemeDataService', () => ({
  themeDataService: {getThemeForVerse: () => undefined},
}));

import SkiaPage from '../SkiaPage';
import ContinuousMushafView from '../ContinuousMushafView';
import {getMushafLayout} from '../../constants';
import {digitalKhattDataService} from '@/services/mushaf/DigitalKhattDataService';
import {quranTextService} from '@/services/mushaf/QuranTextService';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';

declare const global: {IS_REACT_ACT_ENVIRONMENT?: boolean};
global.IS_REACT_ACT_ENVIRONMENT = true;

interface TestDKService {
  readonly rewayah: RewayahId;
  swapMain(db: FixtureDb): void;
  sideCacheEvent(): void;
  notify(): void;
}

const dk = digitalKhattDataService as unknown as TestDKService;

const PAGE = 4;

const renderers: TestRenderer.ReactTestRenderer[] = [];

function mount(element: React.JSX.Element): void {
  act(() => {
    renderers.push(TestRenderer.create(element));
  });
}

const skiaPage = () => (
  <SkiaPage pageNumber={PAGE} textColor="#111111" dividerColor="#666666" />
);

const continuousView = () => (
  <ContinuousMushafView
    textColor="#111111"
    dividerColor="#666666"
    initialPage={PAGE}
    metrics={getMushafLayout({width: 390, height: 844, isTablet: false})}
  />
);

/**
 * A main-cache commit in DigitalKhattDataService's order: maps, identity and
 * version swap and the settings store follows (swapMain), the rewayah
 * listeners run (MushafPreloadService clears the line-text caches), then cache
 * subscribers wake (announceMainCommit).
 */
function commit(db: FixtureDb): void {
  act(() => {
    dk.swapMain(db);
    useMushafSettingsStore.getState().setRewayah(dk.rewayah);
    quranTextService.clearCaches();
    dk.notify();
  });
}

function lineTexts(): string[] {
  return digitalKhattDataService
    .getPageLines(PAGE)
    .map((_line, lineIndex) => quranTextService.getLineText(PAGE, lineIndex))
    .filter(text => text !== '');
}

/**
 * Paragraphs built from one text or font with a layout computed for another,
 * as "text <id> in font <id> with the layout of text <id> in font <id>" (ids
 * from mockLayouts.textIds / fontIds).
 */
function mispairedParagraphs(paragraphs: readonly MockParagraph[]): string[] {
  const out: string[] = [];
  for (const paragraph of paragraphs) {
    const textId = mockLayouts.textIds.get(paragraph.text);
    const fontId = mockLayouts.fontIds.get(paragraph.font ?? '');
    if (
      paragraph.layoutOf.length === 1 &&
      paragraph.layoutOf[0] === textId &&
      paragraph.layoutFont.length === 1 &&
      paragraph.layoutFont[0] === fontId
    ) {
      continue;
    }
    out.push(
      `text ${textId ?? '(never laid out)'} in font ${fontId ?? '(none)'} ` +
        `with the layout of text ${paragraph.layoutOf.join(', ') || '(none)'} ` +
        `in font ${paragraph.layoutFont.join(', ') || '(none)'}`,
    );
  }
  return out;
}

beforeEach(() => {
  useMushafSettingsStore.setState({
    mushafRenderer: 'dk_v2',
    uthmaniFont: 'v2',
    arabicTextWeight: 'normal',
    showTajweed: false,
    showThemes: false,
    showAllahNameHighlight: false,
    showRewayahDiffs: false,
    rewayah: 'hafs',
  });
  mockLayouts.cache.clear();
  mockLayouts.computed = 0;
  mockSkia.paragraphs.length = 0;
  mockSkia.canvasRenders = 0;
  mockSkia.canvasMounts = 0;
  commit('hafs');
});

afterEach(() => {
  act(() => {
    for (const renderer of renderers.splice(0)) renderer.unmount();
  });
});

describe.each([
  ['SkiaPage', skiaPage],
  ['ContinuousMushafView', continuousView],
])('%s across rewayah switches', (_name, view) => {
  it('never builds a line from the new text with a layout of other text', () => {
    mount(view());
    const hafsLines = lineTexts();
    expect(hafsLines.length).toBeGreaterThan(0);
    expect(mockSkia.paragraphs.map(p => p.text)).toEqual(hafsLines);
    expect(mispairedParagraphs(mockSkia.paragraphs)).toEqual([]);

    // The first switch to a rewayah computes the page layout once; switching
    // back to Hafs finds its layout cached.
    for (const db of ['warsh', 'qaloon', 'hafs'] as const) {
      const before = lineTexts();
      const computed = mockLayouts.computed;
      mockSkia.paragraphs.length = 0;
      commit(db);
      const after = lineTexts();
      // The page text really changes, so a stale layout would show.
      expect(after).not.toEqual(before);
      expect(mockLayouts.computed - computed).toBe(db === 'hafs' ? 0 : 1);
      expect(mispairedParagraphs(mockSkia.paragraphs)).toEqual([]);
      // Every line is drawn from the new text.
      expect(mockSkia.paragraphs.slice(-after.length).map(p => p.text)).toEqual(
        after,
      );
    }
  });

  it('never builds a line with the layout of another font', () => {
    mount(view());
    mockSkia.paragraphs.length = 0;
    act(() => {
      useMushafSettingsStore.setState({
        mushafRenderer: 'dk_v1',
        uthmaniFont: 'v1',
      });
    });
    expect(mockSkia.paragraphs.length).toBeGreaterThan(0);
    expect(mockSkia.paragraphs.every(p => p.font === 'DigitalKhattV1')).toBe(
      true,
    );
    expect(mispairedParagraphs(mockSkia.paragraphs)).toEqual([]);
  });

  it('keeps the page drawn while it takes the new layout (no blank frame)', () => {
    mount(view());
    expect(mockSkia.canvasMounts).toBe(1);
    commit('warsh');
    commit('hafs');
    expect(mockSkia.canvasMounts).toBe(1);
  });
});

describe.each([
  ['SkiaPage', skiaPage],
  ['ContinuousMushafView', continuousView],
])('%s and side-cache events', (_name, view) => {
  it('a side-cache load or failed load neither re-renders the page nor rebuilds its lines', () => {
    commit('warsh');
    mount(view());
    const built = mockSkia.paragraphs.length;
    const canvasRenders = mockSkia.canvasRenders;
    expect(built).toBeGreaterThan(0);

    // e.g. the player loading Hafs for a Hafs reciter, then a failed load.
    act(() => dk.sideCacheEvent());
    act(() => dk.sideCacheEvent());

    expect(mockSkia.canvasRenders).toBe(canvasRenders);
    expect(mockSkia.paragraphs.length).toBe(built);
  });

  it('a rewayah switch still rebuilds every line from the new text', () => {
    mount(view());
    const before = lineTexts();
    mockSkia.paragraphs.length = 0;
    commit('doori');
    const after = lineTexts();
    expect(after).not.toEqual(before);
    expect(mockSkia.paragraphs.slice(-after.length).map(p => p.text)).toEqual(
      after,
    );
  });
});
