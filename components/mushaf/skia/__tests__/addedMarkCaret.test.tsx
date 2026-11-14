// SkiaLine draws the caret of an added mark: where its strokes land for what the
// paragraph reports. A recorder, so this checks the numbers, not the look: nobody has
// seen this on a screen.
import React, {act} from 'react';
import TestRenderer from 'react-test-renderer';

interface MockRect {
  x: number;
  y: number;
  width: number;
  height: number;
}
const mockSkia = {
  rectsForRange: (_start: number, _end: number): MockRect[] => [],
};

jest.mock('@shopify/react-native-skia', () => {
  const makeBuilder = () => {
    const builder = {
      pushStyle: () => builder,
      pop: () => builder,
      addText: () => builder,
      build: () => ({
        layout: () => undefined,
        getLongestLine: () => 122,
        getHeight: () => 53,
        getRectsForRange: (start: number, end: number) =>
          mockSkia.rectsForRange(start, end),
        dispose: () => undefined,
      }),
    };
    return builder;
  };
  return {
    Paragraph: 'Paragraph',
    Group: 'Group',
    RoundedRect: 'RoundedRect',
    Line: 'Line',
    DashPathEffect: 'DashPathEffect',
    vec: (x: number, y: number) => ({x, y}),
    Skia: {
      Color: (c: string) => c,
      ParagraphBuilder: {Make: () => makeBuilder()},
    },
    TextHeightBehavior: {DisableAll: 3},
    TextDirection: {RTL: 0, LTR: 1},
  };
});
jest.mock('@/utils/skiaTextWeight', () => ({
  getArabicTextWeightStrokeWidth: () => 0,
  createTextStrokePaint: () => undefined,
}));
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
      getLineInfo: () => ({lineType: 0, lineWidthRatio: 1, isCentered: false}),
      getLineText: () => 'ابت جحخ',
      analyzeText: () => ({
        ayaSpaceIndexes: [],
        simpleSpaceIndexes: [3],
        spaces: new Map([[3, 1]]),
        wordInfos: [word(0, 2), word(4, 6)],
      }),
    },
  };
});

import SkiaLine from '../SkiaLine';
import {clearLineFits} from '@/services/mushaf/lineFitCache';

const baseProps = {
  pageNumber: 6,
  lineIndex: 2,
  fontMgr: {} as never,
  pageWidth: 142,
  fontSize: 20,
  margin: 10,
  yPos: 100,
  textColor: '#000000',
  justResult: {
    fontFeatures: new Map(),
    simpleSpacing: 100,
    ayaSpacing: 100,
    fontSizeRatio: 1,
  },
};
// The paragraph is 284 wide (twice the page), right aligned; drawn at -(284 - 142 + 10).
const X_POS = -152;

function draw(highlight: {start: number; end: number}) {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(
      <SkiaLine
        {...baseProps}
        backgroundHighlights={[
          {...highlight, color: '#D32F2F', style: 'caret'},
        ]}
      />,
    );
  });
  return tree;
}

const named = (tree: TestRenderer.ReactTestRenderer, type: string) =>
  tree.root.findAll(n => (n.type as unknown) === type);

beforeEach(() => {
  clearLineFits();
});

describe('the caret', () => {
  // Right to left: the first word at 200-260, the space at 190-200, the second word
  // at 130-190.
  const rects: Record<string, MockRect[]> = {
    '0:3': [{x: 200, y: 2, width: 60, height: 40}],
    '3:4': [{x: 190, y: -10, width: 10, height: 70}],
    '4:7': [{x: 130, y: 2, width: 60, height: 40}],
  };
  beforeEach(() => {
    mockSkia.rectsForRange = (start, end) => rects[`${start}:${end}`] ?? [];
  });

  it('is two short strokes in the gap before the word, in the mark colour', () => {
    const tree = draw({start: 4, end: 6});
    const lines = named(tree, 'Line');
    expect(lines).toHaveLength(2);
    // The middle of the space before the word.
    const x = X_POS + 195;
    for (const line of lines) {
      expect(line.props.color).toBe('#D32F2F');
      expect(line.props.p1.x).toBe(x);
      expect(Math.abs(line.props.p2.x - x)).toBeGreaterThan(0);
      expect(line.props.p2.y).toBeGreaterThan(line.props.p1.y);
    }
    expect(lines[0].props.p2.x).toBeLessThan(x);
    expect(lines[1].props.p2.x).toBeGreaterThan(x);
  });

  it('sits at the bottom of the words, not over their letters', () => {
    const tree = draw({start: 4, end: 6});
    const [line] = named(tree, 'Line');
    // Band of the first word: y 2 to 42, drawn from the line's y of 100.
    expect(line.props.p2.y).toBeCloseTo(100 + 42);
    expect(line.props.p1.y).toBeGreaterThan(100 + 2);
  });

  it('adds no band behind the letters', () => {
    const tree = draw({start: 4, end: 6});
    expect(named(tree, 'RoundedRect')).toHaveLength(0);
    expect(named(tree, 'DashPathEffect')).toHaveLength(0);
  });

  it('at the start of a line, it sits just past the word on the margin side', () => {
    const tree = draw({start: 0, end: 2});
    const [line] = named(tree, 'Line');
    // No gap there: the word's own start, at its right edge, and a little beyond.
    const edge = X_POS + 260;
    expect(line.props.p1.x).toBeGreaterThan(edge);
    expect(line.props.p1.x).toBeLessThan(edge + 10);
  });

  it('stays on the canvas', () => {
    mockSkia.rectsForRange = (start, end) =>
      start === 0 && end === 3
        ? [{x: 290, y: 2, width: 4, height: 40}]
        : (rects[`${start}:${end}`] ?? []);
    const tree = draw({start: 0, end: 2});
    for (const line of named(tree, 'Line')) {
      expect(line.props.p2.x).toBeLessThanOrEqual(baseProps.pageWidth);
    }
  });
});
