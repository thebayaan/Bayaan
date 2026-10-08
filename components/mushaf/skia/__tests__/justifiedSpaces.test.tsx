// @ai-generated
/**
 * Justified spaces on a DigitalKhatt line (justifiedSpace.ts).
 *
 * SkParagraph ignores letterSpacing on Arabic runs, so SkiaLine sets each
 * space's justified width through its font size, pins the line box with a
 * forced strut at the words' size, and clamps highlight rects to the words'
 * band. Skia's ParagraphBuilder is a recorder here: the test checks the
 * styles each chunk of the line is added with.
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

const mockSkia = {
  paragraphStyles: [] as unknown[],
  chunks: [] as {text: string; style: MockStyle}[],
  rectsForRange: (_start: number, _end: number): MockRect[] => [],
};

jest.mock('@shopify/react-native-skia', () => {
  const makeBuilder = (paragraphStyle: unknown) => {
    mockSkia.paragraphStyles.push(paragraphStyle);
    const styles: MockStyle[] = [];
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
        mockSkia.chunks.push({text, style: styles[styles.length - 1]});
        return builder;
      },
      build() {
        return {
          layout: () => undefined,
          getLongestLine: () => 300,
          getHeight: () => 53,
          getRectsForRange: (start: number, end: number) =>
            mockSkia.rectsForRange(start, end),
          dispose: () => undefined,
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

// One line of four tokens (the third a verse marker): two simple spaces, then
// an aya space.
const LINE = 'ابت جحخ ۝١ دذر';
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
      getLineInfo: () => ({lineType: 0, lineWidthRatio: 1}),
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
import {
  clampRectToBand,
  justifiedLineStrut,
  justifiedSpaceFontSize,
} from '../justifiedSpace';

const baseProps = {
  pageNumber: 6,
  lineIndex: 2,
  fontMgr: {} as never,
  pageWidth: 400,
  fontSize: 20,
  margin: 10,
  yPos: 100,
  textColor: '#000000',
};

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

beforeEach(() => {
  mockSkia.paragraphStyles = [];
  mockSkia.chunks = [];
  mockSkia.rectsForRange = () => [];
});

describe('justifiedSpace helpers', () => {
  it('sizes a space so its advance is the justified width', () => {
    // The font's space is SPACEWIDTH (100) units: 150 units is 1.5x the size.
    expect(justifiedSpaceFontSize(20, 150)).toBe(30);
    expect(justifiedSpaceFontSize(20, 100)).toBe(20);
    expect(justifiedSpaceFontSize(18, 340)).toBeCloseTo(61.2);
  });

  it('never takes a space to or below zero', () => {
    expect(justifiedSpaceFontSize(20, 0)).toBeGreaterThan(0);
    expect(justifiedSpaceFontSize(20, -40)).toBeGreaterThan(0);
  });

  it('forces a strut at the words size', () => {
    expect(justifiedLineStrut('DigitalKhatt', 22)).toEqual({
      strutEnabled: true,
      forceStrutHeight: true,
      fontFamilies: ['DigitalKhatt'],
      fontSize: 22,
    });
  });

  it('clamps a taller rect to the band and leaves a word rect alone', () => {
    const band = {top: -0.5, bottom: 53};
    expect(clampRectToBand({y: -18, height: 80}, band)).toEqual({
      y: -0.5,
      height: 53.5,
    });
    expect(clampRectToBand({y: -0.5, height: 53.5}, band)).toEqual({
      y: -0.5,
      height: 53.5,
    });
    expect(clampRectToBand({y: 4, height: 10}, null)).toEqual({
      y: 4,
      height: 10,
    });
  });
});

describe('SkiaLine justified spaces', () => {
  it('sets each space at the size of its justified width, never letterSpacing', () => {
    renderLine({simpleSpacing: 150, ayaSpacing: 300, fontSizeRatio: 1});

    const spaces = mockSkia.chunks.filter(c => c.text === ' ');
    expect(spaces).toHaveLength(3);
    // simple, simple, aya: 1.5x and 3x the words' 20.
    expect(spaces.map(s => s.style.fontSize)).toEqual([30, 30, 60]);
    for (const s of spaces) expect(s.style.letterSpacing).toBeUndefined();

    const words = mockSkia.chunks.filter(c => c.text !== ' ');
    for (const w of words) expect(w.style.fontSize).toBe(20);
    expect(mockSkia.chunks.map(c => c.text).join('')).toBe(LINE);
  });

  it('pins the line box with a forced strut at the words size', () => {
    renderLine({simpleSpacing: 150, ayaSpacing: 300, fontSizeRatio: 0.9});

    expect(mockSkia.paragraphStyles).toHaveLength(1);
    expect(mockSkia.paragraphStyles[0]).toMatchObject({
      textHeightBehavior: 3,
      textDirection: 0,
      strutStyle: {
        strutEnabled: true,
        forceStrutHeight: true,
        fontFamilies: ['DigitalKhatt'],
        fontSize: 18,
      },
    });
  });

  it('keeps a shrunk line spaces at the words size', () => {
    // A shrunk line keeps the default spacing (SPACEWIDTH).
    renderLine({simpleSpacing: 100, ayaSpacing: 100, fontSizeRatio: 0.8});

    const spaces = mockSkia.chunks.filter(c => c.text === ' ');
    expect(spaces.map(s => s.style.fontSize)).toEqual([16, 16, 16]);
  });

  it('clamps highlight rects to the words band', () => {
    mockSkia.rectsForRange = (start, end) => {
      if (start === 0 && end === 1) {
        return [{x: 380, y: -0.5, width: 8, height: 53.5}];
      }
      // A word, then a justified space whose rect spans its larger size.
      return [
        {x: 340, y: -0.5, width: 48, height: 53.5},
        {x: 330, y: -18, width: 10, height: 80},
      ];
    };

    const tree = renderLine(
      {simpleSpacing: 150, ayaSpacing: 300, fontSizeRatio: 1},
      {backgroundHighlights: [{start: 0, end: 3, color: 'tint'}]},
    );

    const rects = tree.root.findAll(n => (n.type as unknown) === 'RoundedRect');
    expect(rects).toHaveLength(2);
    for (const r of rects) {
      expect(r.props.y).toBeCloseTo(100 - 0.5);
      expect(r.props.height).toBeCloseTo(53.5);
    }
    expect(rects.map(r => r.props.width)).toEqual([48, 10]);
  });
});
