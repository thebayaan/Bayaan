// @ai-generated
// What a Mushaf 1440 page draws, as plain data: the glyph runs of each line
// and the highlight shapes behind and under its words. Pure (no Skia), so
// QCFPage stays a thin drawing layer and this logic is unit-tested.

import type {QCFPageModel} from '@/services/mushaf/QCFDataService';
import type {QCFPlacedLine} from '@/services/mushaf/QCFPageLayout';
import type {QCFLineHighlights} from '@/services/mushaf/qcfDkWordMap';

/** A word's glyph ids and each glyph's advance in em. */
export interface WordGlyphs {
  ids: number[];
  ems: number[];
}

export interface GlyphMeasure {
  /** Glyph id of each code point of `text` (one per UTF-16 unit here). */
  glyphIds(text: string): number[];
  /** Advance of each glyph, in em. */
  advancesEm(ids: number[]): number[];
}

/**
 * Glyph ids and advances of every word of a page, from one call per page
 * into the font (the page font maps each code point of a word to one glyph).
 */
export function measureWordGlyphs(
  page: QCFPageModel,
  measure: GlyphMeasure,
): Map<number, WordGlyphs> {
  const words = page.lines.flatMap(line => line.words);
  const text = words.map(word => word.code).join('');
  const ids = measure.glyphIds(text);
  const ems = measure.advancesEm(ids);
  const out = new Map<number, WordGlyphs>();
  let offset = 0;
  for (const word of words) {
    const count = word.code.length;
    out.set(word.id, {
      ids: ids.slice(offset, offset + count),
      ems: ems.slice(offset, offset + count),
    });
    offset += count;
  }
  return out;
}

/** A word's natural width in em. */
export function wordAdvanceEm(glyphs: WordGlyphs | undefined): number {
  if (!glyphs) return 0;
  let sum = 0;
  for (const em of glyphs.ems) sum += em;
  return sum;
}

export interface PositionedGlyph {
  id: number;
  pos: {x: number; y: number};
}

export interface GlyphRun {
  /** The word colour; null for the line's own text style. */
  color: string | null;
  glyphs: PositionedGlyph[];
}

/**
 * The glyphs of one word at its place on the line. The line reads right to
 * left, so its last glyph is leftmost; the extra glyphs of a word are
 * zero-width marks drawn over the first (matches SkParagraph's RTL shaping
 * of the same code points).
 */
export function positionWordGlyphs(
  glyphs: WordGlyphs,
  left: number,
  baseline: number,
  fontSize: number,
): PositionedGlyph[] {
  const out: PositionedGlyph[] = new Array(glyphs.ids.length);
  let x = left;
  for (let k = glyphs.ids.length - 1; k >= 0; k--) {
    out[k] = {id: glyphs.ids[k], pos: {x, y: baseline}};
    x += glyphs.ems[k] * fontSize;
  }
  return out;
}

/**
 * The glyph runs of a line: words in the line's text style together, and one
 * run per colour for words drawn in their own colour. A word whose colour is
 * transparent (hidden while memorising) is left out.
 */
export function lineGlyphRuns(
  line: QCFPlacedLine,
  glyphs: ReadonlyMap<number, WordGlyphs>,
  wordColors: ReadonlyMap<number, string>,
  isHidden: (color: string) => boolean,
): GlyphRun[] {
  const runs = new Map<string | null, GlyphRun>();
  for (const placed of line.words) {
    const wordGlyphs = glyphs.get(placed.word.id);
    if (!wordGlyphs) continue;
    const color = wordColors.get(placed.word.id) ?? null;
    if (color !== null && isHidden(color)) continue;
    let run = runs.get(color);
    if (!run) {
      run = {color, glyphs: []};
      runs.set(color, run);
    }
    run.glyphs.push(
      ...positionWordGlyphs(wordGlyphs, placed.x, line.baseline, line.fontSize),
    );
  }
  return [...runs.values()];
}

export interface HighlightShape {
  style: 'band' | 'underline' | 'caret';
  color: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

// Bands sit inside the line's slot, just off its edges, and reach a little
// past the words' ends so the first and last letters are not flush with them.
const BAND_INSET = 0.04;
const BAND_SIDE_PAD_EM = 0.06;
// The caret of an added mark, as shares of the font size (as SkiaLine).
export const CARET_HALF_WIDTH = 0.1;
export const CARET_HEIGHT = 0.28;

/**
 * The highlight shapes of one line, in paint order: bands behind its words
 * (a whole-line band for a basmala being recited), dotted underlines under
 * words, and carets in the gap before a word (added marks). Coordinates are
 * content coordinates.
 */
export function lineHighlightShapes(
  line: QCFPlacedLine,
  highlights: QCFLineHighlights | undefined,
  lineLeft: number,
  lineWidth: number,
  contentWidth: number,
): HighlightShape[] {
  if (!highlights) return [];
  const inset = line.height * BAND_INSET;
  const top = line.top + inset;
  const height = line.height - 2 * inset;
  const pad = BAND_SIDE_PAD_EM * line.fontSize;
  const shapes: HighlightShape[] = [];
  for (const color of highlights.wholeLine) {
    shapes.push({
      style: 'band',
      color,
      x: lineLeft,
      y: top,
      width: lineWidth,
      height,
    });
  }
  for (const run of highlights.runs) {
    const first = line.words[run.firstWord];
    const last = line.words[run.lastWord];
    if (!first || !last) continue;
    const style = run.style ?? 'band';
    if (style === 'caret') {
      // In the gap before the word; a line's first word has none, so just
      // past its start (right edge: the line reads right to left).
      const start = first.x + first.width;
      const before = line.words[run.firstWord - 1];
      const x =
        before !== undefined
          ? (start + before.x) / 2
          : start + line.fontSize * CARET_HALF_WIDTH * 1.5;
      shapes.push({
        style,
        color: run.color,
        x: Math.min(x, contentWidth - line.fontSize * CARET_HALF_WIDTH),
        y: top,
        width: 0,
        height,
      });
      continue;
    }
    // Reading order runs right to left: the first word is the rightmost.
    const left = last.x - pad;
    const right = first.x + first.width + pad;
    shapes.push({
      style,
      color: run.color,
      x: left,
      y: top,
      width: right - left,
      height,
    });
  }
  return shapes;
}
