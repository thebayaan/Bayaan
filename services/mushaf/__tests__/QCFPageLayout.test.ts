// @ai-generated
/**
 * Mushaf 1440 page layout: full lines flush with both margins, the print's
 * short lines centred, one size per page, and touches found on the words.
 * The last suite lays out all 604 pages with the real V4 page fonts' glyph
 * advances (data/mushaf/legacy/QPCTajweed, the files the app downloads).
 */
import * as path from 'path';
import {
  layoutQCFPage,
  qcfBaseline,
  qcfWordAt,
  QCF_DEFAULT_LINE_EM,
  QCF_INK_ABOVE_EM,
  QCF_INK_BELOW_EM,
  QCF_LINE_WIDTH_RATIO,
  QCF_MAX_SQUEEZE,
} from '../QCFPageLayout';
import {
  qcfDataService,
  type QCFLine,
  type QCFPageModel,
  type QCFWord,
} from '../QCFDataService';
import {readTtfMetrics} from '../__fixtures__/ttfMetrics';

const word = (id: number): QCFWord => ({
  id,
  location: `2:1:${id}`,
  verseKey: '2:1',
  code: String.fromCharCode(0xfc40 + id),
});

const ayah = (ids: number[], centered = false): QCFLine => ({
  lineNumber: 0,
  kind: 'ayah',
  surahNumber: null,
  centered,
  words: ids.map(word),
});

const pageOf = (lines: QCFLine[]): QCFPageModel => ({pageNumber: 10, lines});

const geometry = (lines: number) => ({
  contentWidth: 400,
  lineTops: Array.from({length: lines}, (_, i) => i * 40),
  lineHeight: 40,
});

const LINE_WIDTH = 400 * QCF_LINE_WIDTH_RATIO;
const LINE_LEFT = (400 - LINE_WIDTH) / 2;

describe('layoutQCFPage', () => {
  it('justifies full lines flush with both margins, read right to left', () => {
    // 4 words of 4 em per line: 16 em natural width (the page reference).
    const page = pageOf([ayah([1, 2, 3, 4]), ayah([5, 6, 7, 8])]);
    const layout = layoutQCFPage(page, () => 4, geometry(2));
    expect(layout.fontSize).toBeCloseTo(LINE_WIDTH / 16, 9);
    for (const line of layout.lines) {
      const [first, , , last] = line.words;
      expect(first.x + first.width).toBeCloseTo(LINE_LEFT + LINE_WIDTH, 9);
      expect(last.x).toBeCloseTo(LINE_LEFT, 9);
      expect(line.words.map(w => w.word.id)).toEqual(
        [...line.words].sort((a, b) => b.x - a.x).map(w => w.word.id),
      );
    }
  });

  it('spreads a full line’s spare width evenly over its gaps', () => {
    const em: Record<number, number> = {1: 4, 2: 4, 3: 4, 4: 4, 5: 3.8, 6: 4};
    const page = pageOf([
      ayah([1, 2, 3, 4]),
      ayah([1, 2, 3, 4]),
      ayah([5, 6, 6, 6]),
    ]);
    const layout = layoutQCFPage(page, w => em[w.id], geometry(3));
    const short = layout.lines[2];
    const gaps = short.words
      .slice(1)
      .map((w, i) => short.words[i].x - (w.x + w.width));
    for (const gap of gaps) expect(gap).toBeCloseTo(short.gap, 9);
    expect(short.gap).toBeCloseTo((0.2 * layout.fontSize) / 3, 9);
    expect(short.words[3].x).toBeCloseTo(LINE_LEFT, 9);
  });

  it('centres the print’s short lines at their natural spacing', () => {
    const page = pageOf([ayah([1, 2, 3, 4]), ayah([1, 2], true)]);
    const layout = layoutQCFPage(page, () => 4, geometry(2));
    const short = layout.lines[1];
    expect(short.gap).toBe(0);
    const left = short.words[1].x;
    const right = short.words[0].x + short.words[0].width;
    expect(right - left).toBeCloseTo(8 * layout.fontSize, 9);
    expect((left + right) / 2).toBeCloseTo(200, 9);
  });

  it('squeezes a far wider line by at most MAX_SQUEEZE, then shrinks it', () => {
    const page = pageOf([
      ayah([1, 2, 3, 4]),
      ayah([1, 2, 3, 4]),
      ayah([1, 2, 3, 5]),
    ]);
    // Line 3 is 18 em against a 16 em page: 12.5% too wide.
    const layout = layoutQCFPage(page, w => (w.id === 5 ? 6 : 4), geometry(3));
    const wide = layout.lines[2];
    expect(wide.fontSize).toBeLessThan(layout.fontSize);
    expect(wide.gap).toBeCloseTo((-QCF_MAX_SQUEEZE * LINE_WIDTH) / 3, 9);
    expect(wide.words[0].x + wide.words[0].width).toBeCloseTo(
      LINE_LEFT + LINE_WIDTH,
      9,
    );
    expect(wide.words[3].x).toBeCloseTo(LINE_LEFT, 9);
  });

  it('sizes a page by its widest ordinary full line, within bounds', () => {
    const em: Record<number, number> = {1: 4, 2: 4, 3: 4, 4: 4, 5: 4.04};
    const ordinary = layoutQCFPage(
      pageOf([ayah([1, 2, 3, 4]), ayah([1, 2, 3, 4]), ayah([1, 2, 3, 5])]),
      w => em[w.id],
      geometry(3),
    );
    // 16.04 em is within 1.5% of the median line: it sets the size.
    expect(ordinary.fontSize).toBeCloseTo(LINE_WIDTH / 16.04, 9);
    const lines = [ayah([1, 2, 3, 4]), ayah([1, 2, 3, 4]), ayah([1, 2, 3, 4])];
    const tiny = layoutQCFPage(pageOf(lines), () => 1, geometry(3));
    expect(tiny.fontSize).toBeCloseTo(LINE_WIDTH / 15.5, 9);
    const noFullLine = layoutQCFPage(
      pageOf([ayah([1, 2], true)]),
      () => 4,
      geometry(1),
    );
    expect(noFullLine.fontSize).toBeCloseTo(
      LINE_WIDTH / QCF_DEFAULT_LINE_EM,
      9,
    );
  });

  it('centres a line’s typical ink in its slot', () => {
    const baseline = qcfBaseline(100, 40, 20);
    const inkTop = baseline - QCF_INK_ABOVE_EM * 20;
    const inkBottom = baseline + QCF_INK_BELOW_EM * 20;
    expect((inkTop + inkBottom) / 2).toBeCloseTo(120, 9);
  });
});

describe('qcfWordAt', () => {
  const title: QCFLine = {
    lineNumber: 1,
    kind: 'surah_name',
    surahNumber: 2,
    centered: true,
    words: [],
  };
  // The second line is 15 em on a 16 em page: its words have gaps.
  const page = pageOf([title, ayah([1, 2, 3, 4]), ayah([5, 6, 7, 8])]);
  const layout = layoutQCFPage(page, w => (w.id >= 5 ? 3.75 : 4), geometry(3));

  it('finds the word under a touch', () => {
    const target = layout.lines[1].words[2];
    const hit = qcfWordAt(layout, target.x + target.width / 2, 60);
    expect(hit).toEqual({lineIndex: 1, wordIndex: 2, word: target.word});
  });

  it('gives a touch between two words to the nearer one', () => {
    const [right, left] = layout.lines[2].words;
    expect(layout.lines[2].gap).toBeGreaterThan(1);
    expect(qcfWordAt(layout, right.x - 0.1, 95)?.word.id).toBe(5);
    expect(qcfWordAt(layout, left.x + left.width + 0.1, 95)?.word.id).toBe(6);
  });

  it('finds nothing off the text', () => {
    expect(qcfWordAt(layout, 200, 20)).toBeNull(); // the title line
    expect(qcfWordAt(layout, 200, 500)).toBeNull(); // below the lines
    expect(qcfWordAt(layout, -50, 60)).toBeNull(); // far left of a line
  });
});

describe('every page with the real Mushaf 1440 fonts', () => {
  const FONT_DIR = path.join(process.cwd(), 'data/mushaf/legacy/QPCTajweed');
  // An iPhone in portrait: the content block of a mushaf page.
  const contentWidth = 377;
  // Ayah lines of the 1441H layout (8820) less the 30 the print centres.
  const FULL_LINES = 8790;
  const lineHeight = 41.5;

  it('keeps every full line flush, no glyph run overlapping its neighbour', () => {
    const lineWidth = contentWidth * QCF_LINE_WIDTH_RATIO;
    const right = (contentWidth + lineWidth) / 2;
    const left = (contentWidth - lineWidth) / 2;
    let fullLines = 0;
    let squeezed = 0;
    const sizes: number[] = [];
    for (let pageNumber = 1; pageNumber <= 604; pageNumber++) {
      const page = qcfDataService.getPage(pageNumber);
      const metrics = readTtfMetrics(path.join(FONT_DIR, `p${pageNumber}.ttf`));
      const layout = layoutQCFPage(
        page,
        w => metrics.advancesEm(w.code).reduce((a, b) => a + b, 0),
        {
          contentWidth,
          lineTops: page.lines.map((_, i) => i * lineHeight),
          lineHeight,
        },
      );
      sizes.push(layout.fontSize);
      for (const line of layout.lines) {
        if (line.words.length === 0) continue;
        const first = line.words[0];
        const last = line.words[line.words.length - 1];
        const ink = {
          right: first.x + first.width,
          left: last.x,
        };
        if (line.line.centered) {
          expect(ink.left).toBeGreaterThanOrEqual(left - 1e-6);
          expect(ink.right).toBeLessThanOrEqual(right + 1e-6);
          expect((ink.left + ink.right) / 2).toBeCloseTo(contentWidth / 2, 6);
          continue;
        }
        fullLines++;
        expect(ink.right).toBeCloseTo(right, 6);
        expect(ink.left).toBeCloseTo(left, 6);
        if (line.fontSize < layout.fontSize) squeezed++;
        // Never squeezed by more than MAX_SQUEEZE of the line in total.
        expect(line.gap * (line.words.length - 1)).toBeGreaterThanOrEqual(
          -QCF_MAX_SQUEEZE * lineWidth - 1e-6,
        );
      }
    }
    expect(fullLines).toBe(FULL_LINES);
    // A handful of lines at most need their glyphs shrunk (10 today).
    expect(squeezed).toBeLessThanOrEqual(12);
    // One size per page, every page within a few percent of the others.
    const min = Math.min(...sizes);
    const max = Math.max(...sizes);
    expect(max / min).toBeLessThan(1.09);
  });
});
