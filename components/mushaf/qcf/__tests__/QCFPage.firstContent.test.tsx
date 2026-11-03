// @ai-generated
/**
 * RFC-023 step 5: a Mushaf 1440 page reports its first content once. That is its
 * lines, or its error state when the page font cannot load (offline). A download
 * that neither ends nor fails reports nothing: the restore deadline covers it.
 */
import React, {act} from 'react';
import {ActivityIndicator, Text} from 'react-native';
import TestRenderer from 'react-test-renderer';
import type {MushafLayoutMetrics} from '../../constants';

/** The font load of the test: it settles when the test says so. */
const mockFont = {
  ready: false,
  settle: null as null | {
    resolve: () => void;
    reject: (error: Error) => void;
  },
};

jest.mock('@shopify/react-native-skia', () => {
  const ReactActual = jest.requireActual('react');
  const passThrough = ({children}: {children?: React.ReactNode}) =>
    ReactActual.createElement(ReactActual.Fragment, null, children);
  const makeBuilder = () => {
    const builder = {
      reset: () => undefined,
      pushStyle: () => builder,
      pop: () => builder,
      addText: () => builder,
      build: () => ({
        layout: () => undefined,
        getLongestLine: () => 100,
        getHeight: () => 20,
        getRectsForRange: () => [],
        dispose: () => undefined,
      }),
    };
    return builder;
  };
  return {
    Canvas: passThrough,
    Group: passThrough,
    Paragraph: () => null,
    RoundedRect: () => null,
    Skia: {
      Color: (color: string) => color,
      ParagraphBuilder: {Make: () => makeBuilder()},
    },
    TextAlign: {Center: 1},
    TextDirection: {RTL: 0},
    TextHeightBehavior: {DisableAll: 3},
  };
});

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
jest.mock('react-native-worklets', () => ({runOnJS: (fn: unknown) => fn}));
jest.mock('expo-haptics', () => ({
  impactAsync: () => undefined,
  ImpactFeedbackStyle: {Light: 'light', Medium: 'medium'},
}));
jest.mock('react-native-actions-sheet', () => ({
  SheetManager: {show: () => undefined},
}));
jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({theme: {isDarkMode: false}, isDarkMode: false}),
}));
jest.mock('@/hooks/useMushafFontMgr', () => {
  const fontMgr = {};
  return {useMushafFontMgr: () => fontMgr};
});
jest.mock('@/services/mushaf/DigitalKhattDataService', () => ({
  digitalKhattDataService: {
    getPageLines: () => [
      {line_type: 'ayah', line_number: 1, surah_number: 0},
      {line_type: 'ayah', line_number: 2, surah_number: 0},
    ],
    getBasmalaSurah: () => null,
  },
  BASMALLAH_TEXT: 'basmallah',
}));
jest.mock('@/services/mushaf/QCFDataService', () => ({
  qcfDataService: {
    getOrderedVerseKeysForPage: () => ['2:1'],
    getWordsForLine: () => [{}],
  },
}));
jest.mock('@/services/mushaf/QCFLineService', () => ({
  buildQCFLineRenderModel: () => ({renderedText: 'text', verseSegments: []}),
  buildQCFLineAllahNameMap: () => null,
  findQCFVerseAtCharIndex: () => null,
}));
jest.mock('@/services/mushaf/QuranTextService', () => ({
  PAGE_WIDTH: 400,
  FONTSIZE: 20,
}));
jest.mock('@/services/mushaf/QCFFontLoader', () => ({
  qcfFontFamilyForPage: (page: number) => `qcf-${page}`,
  getQCFFontVariant: () => 'v2',
  qcfFontLoader: {
    isReady: () => mockFont.ready,
    ensure: () =>
      new Promise<void>((resolve, reject) => {
        mockFont.settle = {resolve, reject};
      }),
    prefetch: () => undefined,
  },
}));
jest.mock('@/services/mushaf/QCFLayoutCacheService', () => ({
  qcfLayoutCacheService: {
    getPageLayout: () => ({
      fontSize: 20,
      lineWidthsAtRef: [
        {lineIndex: 0, width: 100},
        {lineIndex: 1, width: 100},
      ],
    }),
    setPageLayout: () => undefined,
  },
}));
jest.mock('@/services/mushaf/MushafPreloadService', () => ({
  mushafPreloadService: {quranCommonTypeface: null},
}));
jest.mock('@/services/mushaf/AllahNameHighlightService', () => ({
  getTextAllahNameCharMap: () => null,
}));
jest.mock('@/services/mushaf/ThemeDataService', () => ({
  themeDataService: {getThemeForVerse: () => undefined},
}));
jest.mock('@/store/mushafPlayerStore', () => ({
  usePlaybackBasmalaSurah: () => null,
  usePlaybackVerseKeys: () => [],
}));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('../../skia/SkiaSurahHeader', () => ({
  __esModule: true,
  default: () => null,
}));

import QCFPage from '../QCFPage';

declare const global: {IS_REACT_ACT_ENVIRONMENT?: boolean};
global.IS_REACT_ACT_ENVIRONMENT = true;

const METRICS = {
  contentWidth: 380,
  contentHeight: 700,
  paddingHorizontal: 10,
  paddingTop: 50,
  baseLineHeight: 40,
  pageWidth: 400,
  screenHeight: 800,
} as MushafLayoutMetrics;

let renderer: TestRenderer.ReactTestRenderer | null = null;
const onFirstContent = jest.fn();
const onReady = jest.fn();

function qcfPage(): React.JSX.Element {
  return (
    <QCFPage
      metrics={METRICS}
      pageNumber={2}
      textColor="#111111"
      dividerColor="#666666"
      onReady={onReady}
      onFirstContent={onFirstContent}
    />
  );
}

function render(): void {
  act(() => {
    renderer = TestRenderer.create(qcfPage());
  });
}

function ofType(type: unknown): TestRenderer.ReactTestInstance[] {
  if (!renderer) throw new Error('not rendered');
  return renderer.root.findAll(node => node.type === type);
}

async function settleFont(result: 'loads' | 'fails'): Promise<void> {
  await act(async () => {
    if (result === 'loads') mockFont.settle?.resolve();
    else mockFont.settle?.reject(new Error('offline'));
  });
}

beforeEach(() => {
  onFirstContent.mockClear();
  onReady.mockClear();
  mockFont.ready = false;
  mockFont.settle = null;
});

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
});

it('reports nothing during a download', () => {
  render();
  expect(ofType(ActivityIndicator)).toHaveLength(1);
  expect(onFirstContent).not.toHaveBeenCalled();
});

it('reports once, when the font has loaded and the lines are there', async () => {
  render();
  await settleFont('loads');
  expect(ofType(ActivityIndicator)).toHaveLength(0);
  expect(onFirstContent).toHaveBeenCalledTimes(1);

  act(() => renderer?.update(qcfPage()));
  expect(onFirstContent).toHaveBeenCalledTimes(1);
});

it('reports at once when the font is already on the device', () => {
  mockFont.ready = true;
  render();
  expect(onFirstContent).toHaveBeenCalledTimes(1);
});

it('reports the error state when the font cannot load (offline)', async () => {
  render();
  await settleFont('fails');
  const message = ofType(Text).map(node => node.props.children);
  expect(message).toContain('Unable to load this page.');
  expect(onReady).toHaveBeenCalled();
  expect(onFirstContent).toHaveBeenCalledTimes(1);
});

it('does not report again when a retry brings the page', async () => {
  render();
  await settleFont('fails');
  expect(onFirstContent).toHaveBeenCalledTimes(1);

  const retry = renderer?.root.findAll(
    node => node.props.accessibilityRole === 'button' && !!node.props.onPress,
  )[0];
  act(() => retry?.props.onPress());
  await settleFont('loads');
  expect(ofType(Text)).toHaveLength(0);
  expect(onFirstContent).toHaveBeenCalledTimes(1);
});
