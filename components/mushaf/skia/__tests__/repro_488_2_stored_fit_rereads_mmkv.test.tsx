// @ai-generated
/**
 * Repro for PR 488 review, finding 2.
 *
 * getLineFit returns `fit ?? readStoredLineFit(key)` and never puts a stored
 * hit into the session map, and SkiaLine calls setLineFit only when it had no
 * fit. So a line served from the store reads MMKV (and hashes its key) on every
 * rebuild of that line: every colour, tajweed or highlight change.
 *
 * Expected: the first read on the next launch promotes the stored fit into the
 * session map, so a line served from the store and redrawn three times reads
 * MMKV once.
 * On the PR head: it reads MMKV four times (once per build). The module test
 * below shows the same at getLineFit level: five calls, five reads.
 *
 * The harness (Skia recorder, QuranTextService line) is copied from the PR's
 * justifiedSpaces.test.tsx; here the real lineFitStore runs over one shared
 * MMKV mock instead of being mocked away.
 */

import React, {act} from 'react';
import TestRenderer from 'react-test-renderer';

interface MockStyle {
  fontSize?: number;
  letterSpacing?: number;
  fontFamilies?: string[];
}
interface MockRect {
  x: number;
  y: number;
  width: number;
  height: number;
}
interface MockChunk {
  text: string;
  style: MockStyle;
}
interface MockBuilt {
  style: unknown;
  chunks: MockChunk[];
  width: number;
  disposed: boolean;
}

const mockSkia = {
  built: [] as MockBuilt[],
  shapingLoss: 0,
  rectsForRange: (_start: number, _end: number): MockRect[] => [],
};

jest.mock('@shopify/react-native-skia', () => {
  const makeBuilder = (paragraphStyle: unknown) => {
    const styles: MockStyle[] = [];
    const chunks: MockChunk[] = [];
    const builder = {
      pushStyle(style: MockStyle) {
        styles.push(style);
        return builder;
      },
      pop() {
        styles.pop();
        return builder;
      },
      addText(text: string) {
        chunks.push({text, style: styles[styles.length - 1]});
        return builder;
      },
      build() {
        let width = -mockSkia.shapingLoss;
        for (const c of chunks) {
          const size = c.style.fontSize ?? 0;
          width += c.text === ' ' ? size / 10 : size / 2;
        }
        const record: MockBuilt = {
          style: paragraphStyle,
          chunks,
          width,
          disposed: false,
        };
        mockSkia.built.push(record);
        return {
          layout: () => undefined,
          getLongestLine: () => width,
          getHeight: () => 53,
          getRectsForRange: (start: number, end: number) =>
            mockSkia.rectsForRange(start, end),
          dispose: () => {
            record.disposed = true;
          },
        };
      },
    };
    return builder;
  };
  return {
    Paragraph: 'Paragraph',
    Group: 'Group',
    RoundedRect: 'RoundedRect',
    Skia: {
      Color: (c: string) => c,
      ParagraphBuilder: {Make: (style: unknown) => makeBuilder(style)},
    },
    TextHeightBehavior: {DisableAll: 3},
    TextDirection: {RTL: 0, LTR: 1},
  };
});

jest.mock('@/utils/skiaTextWeight', () => ({
  getArabicTextWeightStrokeWidth: () => 0,
  createTextStrokePaint: () => undefined,
}));

// One native MMKV store, shared by every launch, recording each fit read.
const mockNative = {
  data: new Map<string, unknown>(),
  fitReads: 0,
};
jest.mock('react-native-mmkv', () => ({
  createMMKV: () => ({
    get length() {
      return mockNative.data.size;
    },
    getString: (key: string) => {
      if (key !== '#version') mockNative.fitReads += 1;
      const value = mockNative.data.get(key);
      return typeof value === 'string' ? value : undefined;
    },
    set: (key: string, value: unknown) => {
      mockNative.data.set(key, value);
    },
    clearAll: () => {
      mockNative.data.clear();
    },
  }),
}));

// A release build of one update.
jest.mock('expo-updates', () => ({
  __esModule: true,
  updateId: 'aaaaaaaa-0000-4000-8000-000000000000',
}));
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {expoConfig: {extra: {}}},
}));

// One line of four tokens (the third a verse marker): two simple spaces, then
// an aya space. 11 letters: 110 px in the mock. (Copied from the PR harness.)
const mockLine = {lineType: 0, lineWidthRatio: 1, isCentered: false};
jest.mock('@/services/mushaf/QuranTextService', () => {
  const word = (startIndex: number, endIndex: number) => ({
    startIndex,
    endIndex,
    text: '',
    baseText: '',
    baseIndexes: [],
    subwords: [],
  });
  return {
    FONTSIZE: 1000,
    SPACEWIDTH: 100,
    SpaceType: {Simple: 1, Aya: 2},
    quranTextService: {
      getLineInfo: () => mockLine,
      getLineText: () => 'ابت جحخ ۝١ دذر',
      analyzeText: () => ({
        ayaSpaceIndexes: [10],
        simpleSpaceIndexes: [3, 7],
        // index of the space -> SpaceType (1 simple, 2 aya)
        spaces: new Map([
          [3, 1],
          [7, 1],
          [10, 2],
        ]),
        wordInfos: [word(0, 2), word(4, 6), word(8, 9), word(11, 13)],
      }),
    },
  };
});

import SkiaLine from '../SkiaLine';
import {clearLineFits, getLineFit, setLineFit} from '../justifiedSpace';

// Words at 20 px with spaces at 150/150/300 units: 110 + 3 + 3 + 6 = 122 px.
// pageWidth 142 and margin 10 give a 122 px target, so that line fits.
const baseProps = {
  pageNumber: 6,
  lineIndex: 2,
  fontMgr: {} as never,
  pageWidth: 142,
  fontSize: 20,
  margin: 10,
  yPos: 100,
  textColor: '#000000',
};
const WIDENED = {simpleSpacing: 150, ayaSpacing: 300, fontSizeRatio: 1};

function renderLine(
  justResult: {
    simpleSpacing: number;
    ayaSpacing: number;
    fontSizeRatio: number;
  },
  extra: Partial<React.ComponentProps<typeof SkiaLine>> = {},
) {
  const rendered: {tree?: TestRenderer.ReactTestRenderer} = {};
  act(() => {
    rendered.tree = TestRenderer.create(
      <SkiaLine
        {...baseProps}
        justResult={{fontFeatures: new Map(), ...justResult}}
        {...extra}
      />,
    );
  });
  if (!rendered.tree) throw new Error('SkiaLine did not render');
  return rendered.tree;
}

const devFlag = globalThis as unknown as {__DEV__: boolean};
const devAtStart = devFlag.__DEV__;

beforeAll(() => {
  jest.useFakeTimers();
});

afterAll(() => {
  jest.useRealTimers();
  devFlag.__DEV__ = devAtStart;
});

beforeEach(() => {
  // The store is on only in release and preview builds.
  devFlag.__DEV__ = false;
  clearLineFits();
  mockNative.data.clear();
  mockNative.fitReads = 0;
  mockSkia.built = [];
  mockSkia.shapingLoss = 0;
  mockSkia.rectsForRange = () => [];
  mockLine.lineType = 0;
  mockLine.lineWidthRatio = 1;
  mockLine.isCentered = false;
});

describe('finding 2: a stored fit is read from MMKV on every rebuild', () => {
  it('a line served from the store and redrawn three times reads MMKV once', () => {
    // Launch 1: the line is measured, fitted, and its fit is written.
    mockSkia.shapingLoss = 4;
    renderLine(WIDENED);
    expect(mockSkia.built).toHaveLength(2); // measured, then fitted
    jest.runOnlyPendingTimers(); // the write queue runs after the render

    // Launch 2: the session map is empty, the stored fit stays.
    clearLineFits();
    mockSkia.built = [];
    mockNative.fitReads = 0;
    const tree = renderLine(WIDENED);

    // Three colour changes, as verse highlights during playback do.
    for (const textColor of ['#111111', '#222222', '#333333']) {
      act(() => {
        tree.update(
          <SkiaLine
            {...baseProps}
            textColor={textColor}
            justResult={{fontFeatures: new Map(), ...WIDENED}}
          />,
        );
      });
    }

    // One build per memo run, each with the stored fit: that part works.
    expect(mockSkia.built).toHaveLength(4);
    for (const b of mockSkia.built) expect(b.width).toBeCloseTo(122);
    // The store should be read once, then the session map serves the fit.
    expect(mockNative.fitReads).toBe(1);
  });

  it('getLineFit promotes a stored fit, so five calls read MMKV once', () => {
    const key = 'DigitalKhattV2|23.4|360|1|240|300|3:jt=1,;|line';
    setLineFit(key, {wordSize: 20, spaceExtra: 1});
    jest.runOnlyPendingTimers();

    // The next launch.
    clearLineFits();
    mockNative.fitReads = 0;
    for (let i = 0; i < 5; i++) {
      expect(getLineFit(key)).toEqual({wordSize: 20, spaceExtra: 1});
    }
    expect(mockNative.fitReads).toBe(1);
  });
});
