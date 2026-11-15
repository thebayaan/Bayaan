// @ai-generated
import type {QCFLine, QCFPageModel} from '@/services/mushaf/QCFDataService';
import {layoutQCFPage} from '@/services/mushaf/QCFPageLayout';
import {
  CARET_HALF_WIDTH,
  lineGlyphRuns,
  lineHighlightShapes,
  measureWordGlyphs,
  positionWordGlyphs,
  wordAdvanceEm,
} from '../qcfDrawing';

const line = (ids: number[], centered = false): QCFLine => ({
  lineNumber: 1,
  kind: 'ayah',
  surahNumber: null,
  centered,
  // Word 3 is two glyphs: a base and a zero-width mark over it.
  words: ids.map(id => ({
    id,
    location: `2:1:${id}`,
    verseKey: id < 3 ? '2:1' : '2:2',
    code:
      id === 3 ? 'ﱃﱄ' : String.fromCharCode(0xfc40 + (id > 3 ? id + 1 : id)),
  })),
});

const page: QCFPageModel = {
  pageNumber: 20,
  lines: [line([1, 2, 3, 4]), line([5, 6, 7, 8])],
};

// One glyph per code point; the mark (U+FC44) has no advance.
const glyphs = measureWordGlyphs(page, {
  glyphIds: text => [...text].map(c => c.charCodeAt(0) - 0xfc00),
  advancesEm: ids => ids.map(id => (id === 0x44 ? 0 : 4)),
});

const layout = layoutQCFPage(page, w => wordAdvanceEm(glyphs.get(w.id)), {
  contentWidth: 400,
  lineTops: [0, 40],
  lineHeight: 40,
});

describe('measureWordGlyphs', () => {
  it('splits one page measurement into words', () => {
    expect(glyphs.get(3)).toEqual({ids: [0x43, 0x44], ems: [4, 0]});
    expect(glyphs.get(4)).toEqual({ids: [0x45], ems: [4]});
    expect(wordAdvanceEm(glyphs.get(3))).toBe(4);
  });
});

describe('positionWordGlyphs', () => {
  it('draws a word’s extra glyphs at its base glyph (right to left)', () => {
    const placed = positionWordGlyphs({ids: [7, 8], ems: [4, 0]}, 10, 50, 20);
    expect(placed).toEqual([
      {id: 7, pos: {x: 10, y: 50}},
      {id: 8, pos: {x: 10, y: 50}},
    ]);
    // Two advancing glyphs: the first read is the rightmost.
    expect(
      positionWordGlyphs({ids: [1, 2], ems: [1, 2]}, 0, 0, 10).map(
        g => g.pos.x,
      ),
    ).toEqual([20, 0]);
  });
});

describe('lineGlyphRuns', () => {
  const placed = layout.lines[0];

  it('draws a line in one run in the text style', () => {
    const runs = lineGlyphRuns(placed, glyphs, new Map(), () => false);
    expect(runs).toHaveLength(1);
    expect(runs[0].color).toBeNull();
    expect(runs[0].glyphs).toHaveLength(5);
  });

  it('draws coloured words in their own run and leaves hidden words out', () => {
    const colors = new Map([
      [2, '#d32f2f'],
      [4, 'rgba(0,0,0,0)'],
    ]);
    const runs = lineGlyphRuns(
      placed,
      glyphs,
      colors,
      c => c === 'rgba(0,0,0,0)',
    );
    expect(runs.map(r => [r.color, r.glyphs.map(g => g.id)])).toEqual([
      [null, [0x41, 0x43, 0x44]],
      ['#d32f2f', [0x42]],
    ]);
  });
});

describe('lineHighlightShapes', () => {
  const placed = layout.lines[1];
  const {lineLeft, lineWidth} = layout;

  it('draws a band over a run of words, past its first and last letters', () => {
    const shapes = lineHighlightShapes(
      placed,
      {runs: [{firstWord: 0, lastWord: 2, color: 'blue'}], wholeLine: []},
      lineLeft,
      lineWidth,
      400,
    );
    expect(shapes).toHaveLength(1);
    const [band] = shapes;
    const [first, , third] = placed.words;
    expect(band.style).toBe('band');
    expect(band.x).toBeLessThan(third.x);
    expect(band.x + band.width).toBeGreaterThan(first.x + first.width);
    expect(band.y).toBeGreaterThan(placed.top);
    expect(band.y + band.height).toBeLessThan(placed.top + placed.height);
  });

  it('lights the whole line for a basmala and keeps underlines per run', () => {
    const shapes = lineHighlightShapes(
      placed,
      {
        runs: [{firstWord: 1, lastWord: 1, color: 'red', style: 'underline'}],
        wholeLine: ['gold'],
      },
      lineLeft,
      lineWidth,
      400,
    );
    expect(shapes.map(s => s.style)).toEqual(['band', 'underline']);
    expect(shapes[0]).toMatchObject({x: lineLeft, width: lineWidth});
  });

  it('puts an added-word caret in the gap before the word', () => {
    const [first, second] = placed.words;
    const [caret] = lineHighlightShapes(
      placed,
      {
        runs: [{firstWord: 1, lastWord: 1, color: 'red', style: 'caret'}],
        wholeLine: [],
      },
      lineLeft,
      lineWidth,
      400,
    );
    expect(caret.x).toBeCloseTo((second.x + second.width + first.x) / 2, 9);
    // A line's first word has no gap before it: just past its start.
    const [start] = lineHighlightShapes(
      placed,
      {
        runs: [{firstWord: 0, lastWord: 0, color: 'red', style: 'caret'}],
        wholeLine: [],
      },
      lineLeft,
      lineWidth,
      400,
    );
    expect(start.x).toBeCloseTo(
      Math.min(
        first.x + first.width + placed.fontSize * CARET_HALF_WIDTH * 1.5,
        400 - placed.fontSize * CARET_HALF_WIDTH,
      ),
      9,
    );
  });
});
