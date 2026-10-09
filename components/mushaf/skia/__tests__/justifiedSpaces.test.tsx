// @ai-generated
/**
 * Justified spaces on a DigitalKhatt line (justifiedSpace.ts).
 *
 * SkParagraph ignores letterSpacing on Arabic runs, so SkiaLine sets each
 * space's justified width through its font size, pins the line box with a
 * forced strut at the words' size, clamps highlight rects to the words' band,
 * and fits a widened line to its exact width by spreading any residue over
 * its spaces, or scaling a shrunk line. Skia's ParagraphBuilder is a recorder
 * here: every paragraph keeps the chunks it was built from, and its width is
 * half the font size per letter (10 px at 20) plus each space's advance (a
 * tenth of its font size), less `mockSkia.shapingLoss` (the cross-word
 * adjustment a space shaped apart from its words loses, or a shrunk line's
 * rounding).
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

// One line of four tokens (the third a verse marker): two simple spaces, then
// an aya space. 11 letters: 110 px in the mock.
const LINE = 'ابت جحخ ۝١ دذر';
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
import {
  clampBandToSlot,
  clampRectToBand,
  clearLineFits,
  fitWordSize,
  isNaturalWidthLine,
  naturalJustification,
  justifiedLineStrut,
  justifiedSpaceFontSize,
  mergeTouchingRects,
  rectsBand,
  shortestRectBand,
  spaceFitExtra,
} from '../justifiedSpace';

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

const spaceSizes = (b: MockBuilt) =>
  b.chunks.filter(c => c.text === ' ').map(c => c.style.fontSize);

beforeEach(() => {
  clearLineFits();
  mockSkia.built = [];
  mockSkia.shapingLoss = 0;
  mockSkia.rectsForRange = () => [];
  mockLine.lineType = 0;
  mockLine.lineWidthRatio = 1;
  mockLine.isCentered = false;
});

describe('justifiedSpace helpers', () => {
  it('sizes a space so its advance is the justified width', () => {
    // The font's space is SPACEWIDTH (100) units: 150 units is 1.5x the size.
    expect(justifiedSpaceFontSize(20, 150)).toBe(30);
    expect(justifiedSpaceFontSize(20, 100)).toBe(20);
    expect(justifiedSpaceFontSize(18, 340)).toBeCloseTo(61.2);
  });

  it('adds extra width in px', () => {
    // 1 px more is 10 more font size (the space is a tenth of the size).
    expect(justifiedSpaceFontSize(20, 150, 1)).toBeCloseTo(40);
    expect(justifiedSpaceFontSize(20, 150, -0.5)).toBeCloseTo(25);
  });

  it('never takes a space to or below zero', () => {
    expect(justifiedSpaceFontSize(20, 0)).toBeGreaterThan(0);
    expect(justifiedSpaceFontSize(20, -40)).toBeGreaterThan(0);
    expect(justifiedSpaceFontSize(20, 150, -50)).toBeGreaterThan(0);
  });

  it('spreads a residue over the spaces, beyond a quarter pixel', () => {
    expect(spaceFitExtra(126, 118, 4)).toBe(2);
    expect(spaceFitExtra(120, 121, 2)).toBe(-0.5);
    expect(spaceFitExtra(120, 119.8, 3)).toBe(0);
    expect(spaceFitExtra(120, 100, 0)).toBe(0);
  });

  it('scales a shrunk line to its width, beyond a quarter pixel', () => {
    expect(fitWordSize(20, 100, 125)).toBe(16);
    expect(fitWordSize(20, 100, 100.2)).toBe(20);
    expect(fitWordSize(20, 100, 0)).toBe(20);
  });

  it('draws only an untabled centred ayah line at its natural width', () => {
    expect(
      isNaturalWidthLine({lineType: 0, lineWidthRatio: 1, isCentered: true}),
    ).toBe(true);
    // A width of its own (pages 1-2, 600-604) is justified to that width.
    expect(
      isNaturalWidthLine({lineType: 0, lineWidthRatio: 0.84, isCentered: true}),
    ).toBe(false);
    expect(
      isNaturalWidthLine({lineType: 0, lineWidthRatio: 1, isCentered: false}),
    ).toBe(false);
    // Surah names and basmalas are centred already.
    expect(
      isNaturalWidthLine({lineType: 2, lineWidthRatio: 1, isCentered: true}),
    ).toBe(false);
    const natural = naturalJustification({
      fontFeatures: new Map([[2, [{name: 'cv01', value: 3}]]]),
      simpleSpacing: 180,
      ayaSpacing: 400,
      fontSizeRatio: 1,
    });
    expect(natural.fontFeatures.size).toBe(0);
    expect([natural.simpleSpacing, natural.ayaSpacing]).toEqual([100, 100]);
    expect(
      naturalJustification({...natural, fontSizeRatio: 0.9}).fontSizeRatio,
    ).toBe(0.9);
  });

  it('forces a strut at the words size', () => {
    expect(justifiedLineStrut('DigitalKhatt', 22)).toEqual({
      strutEnabled: true,
      forceStrutHeight: true,
      fontFamilies: ['DigitalKhatt'],
      fontSize: 22,
    });
  });

  it('takes a band from rects', () => {
    expect(
      rectsBand([
        {y: 0, height: 40},
        {y: -2, height: 30},
      ]),
    ).toEqual({top: -2, bottom: 40});
    expect(rectsBand([])).toBeNull();
    expect(
      shortestRectBand([
        {y: -18, height: 80},
        {y: 1, height: 44},
      ]),
    ).toEqual({top: 1, bottom: 45});
    expect(shortestRectBand([])).toBeNull();
  });

  it('merges rects that touch side by side, and only those', () => {
    const r = (x: number, width: number, y = 0, height = 40) => ({
      x,
      y,
      width,
      height,
    });
    // Unsorted, touching (within half a pixel) and overlapping: one rect.
    expect(mergeTouchingRects([r(60, 20), r(0, 30), r(30.3, 30)])).toEqual([
      r(0, 80),
    ]);
    // A real gap keeps two rects (two tinted words with an untinted one
    // between them).
    expect(mergeTouchingRects([r(0, 30), r(40, 20)])).toEqual([
      r(0, 30),
      r(40, 20),
    ]);
    expect(mergeTouchingRects([])).toEqual([]);
  });

  it('limits a band to the line slot', () => {
    const band = {top: -0.5, bottom: 53};
    expect(clampBandToSlot(band, 0, 50)).toEqual({top: 0, bottom: 50});
    // A centred basmala's paragraph sits 3 px into its slot.
    expect(clampBandToSlot(band, -3, 50)).toEqual({top: -0.5, bottom: 47});
    expect(clampBandToSlot(band, 0, undefined)).toBe(band);
    expect(clampBandToSlot(null, 0, 50)).toBeNull();
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
    renderLine(WIDENED);

    expect(mockSkia.built).toHaveLength(1);
    const [p] = mockSkia.built;
    // simple, simple, aya: 1.5x and 3x the words' 20.
    expect(spaceSizes(p)).toEqual([30, 30, 60]);
    for (const c of p.chunks.filter(chunk => chunk.text === ' ')) {
      expect(c.style.letterSpacing).toBeUndefined();
    }
    for (const c of p.chunks.filter(chunk => chunk.text !== ' ')) {
      expect(c.style.fontSize).toBe(20);
    }
    expect(p.chunks.map(c => c.text).join('')).toBe(LINE);
    expect(p.width).toBe(122);
  });

  it('pins the line box with a forced strut at the words size', () => {
    renderLine({simpleSpacing: 150, ayaSpacing: 300, fontSizeRatio: 0.9});

    expect(mockSkia.built[0].style).toMatchObject({
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

  it('fits a widened line exactly when its spaces lose shaping width', () => {
    // Shaped apart from their words, the spaces lose 4 px: 118 of 122 px.
    mockSkia.shapingLoss = 4;
    renderLine(WIDENED);

    expect(mockSkia.built).toHaveLength(2);
    const [first, fitted] = mockSkia.built;
    expect(first.width).toBe(118);
    expect(first.disposed).toBe(true);
    // 4 px over 3 spaces: each 4/3 px (13.33 font size) wider.
    const sizes = spaceSizes(fitted);
    expect(sizes[0]).toBeCloseTo(30 + 40 / 3);
    expect(sizes[1]).toBeCloseTo(30 + 40 / 3);
    expect(sizes[2]).toBeCloseTo(60 + 40 / 3);
    expect(fitted.width).toBeCloseTo(122);
    expect(fitted.disposed).toBe(false);
  });

  it('narrows the spaces of a line that overshoots', () => {
    mockSkia.shapingLoss = -3; // drawn 125 of 122 px
    renderLine(WIDENED);

    expect(mockSkia.built).toHaveLength(2);
    expect(mockSkia.built[1].width).toBeCloseTo(122);
  });

  it('builds a line that fits once', () => {
    mockSkia.shapingLoss = 0.2; // within the quarter-pixel tolerance
    renderLine(WIDENED);

    expect(mockSkia.built).toHaveLength(1);
  });

  it('keeps a shrunk line that fits at the words size and spacing', () => {
    // 0.8 x 20 = 16: 11 letters at 8 px and 3 spaces at 1.6 px = 92.8 px.
    renderLine(
      {simpleSpacing: 100, ayaSpacing: 100, fontSizeRatio: 0.8},
      {pageWidth: 112.8},
    );

    expect(mockSkia.built).toHaveLength(1);
    expect(spaceSizes(mockSkia.built[0])).toEqual([16, 16, 16]);
  });

  it('scales a shrunk line that overshoots, its spaces at the words size', () => {
    // Drawn 2 px past its 92.8 px target: every size scales by 92.8 / 94.8.
    mockSkia.shapingLoss = -2;
    renderLine(
      {simpleSpacing: 100, ayaSpacing: 100, fontSizeRatio: 0.8},
      {pageWidth: 112.8},
    );

    expect(mockSkia.built).toHaveLength(2);
    const fitted = mockSkia.built[1];
    const size = (16 * 92.8) / 94.8;
    for (const c of fitted.chunks) expect(c.style.fontSize).toBeCloseTo(size);
    expect(fitted.style).toMatchObject({strutStyle: {fontSize: size}});
    // The mock's 2 px overshoot does not scale: 92.8 * ratio + 2 px.
    expect(fitted.width).toBeCloseTo(92.8 * (size / 16) + 2);
  });

  it('leaves a centered line as built', () => {
    mockLine.lineType = 1;
    mockSkia.shapingLoss = 4;
    renderLine(WIDENED);

    expect(mockSkia.built).toHaveLength(1);
  });

  it('clamps highlight rects to the band of the line first word', () => {
    // Like SkParagraph: part of a grapheme cluster (the first letter without
    // its marks) has no rect; the first word (0-2) has the words' band.
    mockSkia.rectsForRange = (start, end) => {
      if (start === 0 && end === 1) return [];
      if (start === 0 && end === 3) {
        return [{x: 370, y: -0.5, width: 18, height: 53.5}];
      }
      // A word, then a justified space whose rect spans its larger size.
      return [
        {x: 340, y: -0.5, width: 48, height: 53.5},
        {x: 330, y: -18, width: 10, height: 80},
      ];
    };

    const tree = renderLine(WIDENED, {
      backgroundHighlights: [{start: 0, end: 3, color: 'tint'}],
    });

    // Clamped to the band, the word and the space touch: one band, no seam.
    const rects = tree.root.findAll(n => (n.type as unknown) === 'RoundedRect');
    expect(rects).toHaveLength(1);
    expect(rects[0].props.y).toBeCloseTo(100 - 0.5);
    expect(rects[0].props.height).toBeCloseTo(53.5);
    expect(rects[0].props.width).toBeCloseTo(58);
  });

  it('clamps a highlight to its shortest rect when the line has no band', () => {
    // No rect for the first word: the highlight's own word rect bounds it.
    mockSkia.rectsForRange = (start, end) => {
      if (start === 0 && end === 3) return [];
      return [
        {x: 340, y: 2, width: 48, height: 40},
        {x: 330, y: -18, width: 10, height: 80},
      ];
    };

    const tree = renderLine(WIDENED, {
      backgroundHighlights: [{start: 4, end: 9, color: 'tint'}],
    });

    const rects = tree.root.findAll(n => (n.type as unknown) === 'RoundedRect');
    expect(rects).toHaveLength(1);
    expect(rects[0].props.y).toBeCloseTo(100 + 2);
    expect(rects[0].props.height).toBeCloseTo(40);
    expect(rects[0].props.width).toBeCloseTo(58);
  });

  it('reuses a line fit when the line is built again', () => {
    mockSkia.shapingLoss = 4;
    const tree = renderLine(WIDENED);
    expect(mockSkia.built).toHaveLength(2); // measured, then fitted

    // A colour change rebuilds the line: one build, with the kept fit.
    act(() => {
      tree.update(
        <SkiaLine
          {...baseProps}
          justResult={{fontFeatures: new Map(), ...WIDENED}}
          charToColor={new Map([[0, '#ff0000']])}
        />,
      );
    });
    expect(mockSkia.built).toHaveLength(3);
    expect(mockSkia.built[2].width).toBeCloseTo(122);
  });

  it('fits again when the width the line fills changes', () => {
    mockSkia.shapingLoss = 4;
    const tree = renderLine(WIDENED);
    act(() => {
      tree.update(
        <SkiaLine
          {...baseProps}
          pageWidth={152}
          justResult={{fontFeatures: new Map(), ...WIDENED}}
        />,
      );
    });
    // A new width is a new fit: measured, then fitted to 132 px.
    expect(mockSkia.built).toHaveLength(4);
    expect(mockSkia.built[3].width).toBeCloseTo(132);
  });

  it('draws a centred line without a width of its own unstretched, centred', () => {
    // 586:1-like: the layout centres it and the width table has no entry.
    mockLine.isCentered = true;
    mockSkia.shapingLoss = 4; // would trigger a fit on a justified line
    const tree = renderLine({
      fontFeatures: new Map([[1, [{name: 'cv01', value: 5}]]]),
      ...WIDENED,
    } as never);

    // One build: no fit pass. Spaces at the words' size, no kashida feature.
    expect(mockSkia.built).toHaveLength(1);
    const [p] = mockSkia.built;
    expect(spaceSizes(p)).toEqual([20, 20, 20]);
    for (const c of p.chunks) {
      expect(
        (c.style as {fontFeatures?: unknown}).fontFeatures,
      ).toBeUndefined();
    }
    // 11 letters (110) + 3 spaces (6) - 4 = 112 px, centred in 142 px:
    // x = -(maxWidth - pageWidth + (pageWidth - width) / 2).
    const [para] = tree.root.findAll(n => (n.type as unknown) === 'Paragraph');
    expect(para.props.x).toBeCloseTo(-(284 - 142 + (142 - 112) / 2));
  });

  it('keeps a highlight within the line slot', () => {
    // The words' band (53.5 px) is taller than the 50 px line pitch: tints on
    // neighbouring lines would overlap.
    mockSkia.rectsForRange = (start, end) =>
      start === 0 && end === 3
        ? [{x: 370, y: -0.5, width: 18, height: 53.5}]
        : [{x: 340, y: -0.5, width: 48, height: 53.5}];

    const tree = renderLine(WIDENED, {
      lineHeight: 50,
      backgroundHighlights: [{start: 0, end: 2, color: 'tint'}],
    });

    const [rect] = tree.root.findAll(
      n => (n.type as unknown) === 'RoundedRect',
    );
    expect(rect.props.y).toBeCloseTo(100);
    expect(rect.props.height).toBeCloseTo(50);
  });
});
