// @ai-generated
// Line layout of a Mushaf 1440 page: where each word glyph of the 1441H print
// goes on screen. Pure (no Skia): the renderer measures word advances with
// the page font and draws the glyphs at the positions computed here, and
// hit-testing reads the same positions.
//
// How the print is reproduced:
//  - The KFGQPC page fonts carry the print's justification in the glyphs
//    themselves (kashida-stretched words): every full line of a page has
//    nearly the same natural width (1441H V4 glyphs: 16.09 em median, within
//    about 1% on a page). So each page is drawn at the font size that makes
//    its widest ordinary full line (the widest within REFERENCE_TOLERANCE of
//    the page's median one) exactly the line width, and every other full
//    line spreads its spare width (a fraction of a pixel per gap) over its
//    word gaps: both edges of every full line are flush, and words are never
//    set tighter than the font draws them but on the rare wider line.
//  - Short lines the print centres (the two opening pages, the last line of
//    some surahs) keep their natural word spacing and are centred.
//  - A full line far wider than the page's other lines (rare) is squeezed by
//    at most MAX_SQUEEZE of the line width through its gaps, then its glyphs
//    shrink just enough to fit.
//  - The line width and side margins match the DigitalKhatt pages, so
//    switching fonts keeps the text block in the same place.
//  - Each line's baseline centres the typical ink of a line (from 0.45 em
//    below to 1.19 em above the baseline, measured over all 604 V4 page
//    fonts) in its slot of the page's line grid.

import {MARGIN, PAGE_WIDTH} from './QuranTextService';
import type {QCFLine, QCFPageModel, QCFWord} from './QCFDataService';

/** Line width as a share of the content width (DigitalKhatt's margins). */
export const QCF_LINE_WIDTH_RATIO = 1 - (2 * MARGIN) / PAGE_WIDTH;

/** Median natural width of a full 1441H line, in em (pages without one). */
export const QCF_DEFAULT_LINE_EM = 16.09;

// A page's own reference is kept within these bounds (a page with one or two
// full lines cannot set an outlandish size).
const MIN_LINE_EM = 15.5;
const MAX_LINE_EM = 16.8;

/**
 * Full lines this much wider than a page's median one are not its reference
 * (over all 604 pages: 171 of 8790 full lines are then squeezed at all, 10 of
 * them past MAX_SQUEEZE).
 */
const REFERENCE_TOLERANCE = 0.015;

/** Most a full line is squeezed through its gaps, as a share of its width. */
export const QCF_MAX_SQUEEZE = 0.02;

/** Typical ink of a line around its baseline, in em. */
export const QCF_INK_ABOVE_EM = 1.19;
export const QCF_INK_BELOW_EM = 0.45;

export interface QCFPlacedWord {
  word: QCFWord;
  /** Left edge of the word's advance box, in content coordinates. */
  x: number;
  width: number;
}

export interface QCFPlacedLine {
  /** Index of the line in the page model. */
  lineIndex: number;
  line: QCFLine;
  /** Top of the line's slot in the page grid. */
  top: number;
  height: number;
  baseline: number;
  /** Size the line's glyphs are drawn at (the page's size unless squeezed). */
  fontSize: number;
  /** Space between two words of the line (0 on a centred line). */
  gap: number;
  /** Right to left: the first word read is the first entry. */
  words: QCFPlacedWord[];
}

export interface QCFPageLayout {
  pageNumber: number;
  /** Font size of the page's glyphs. */
  fontSize: number;
  /** Left edge and width of a full line, in content coordinates. */
  lineLeft: number;
  lineWidth: number;
  lines: QCFPlacedLine[];
}

export interface QCFPageGeometry {
  contentWidth: number;
  /** Top of each line's slot, one per line of the page model. */
  lineTops: readonly number[];
  lineHeight: number;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** The baseline of a line slot that centres a line's typical ink in it. */
export function qcfBaseline(
  top: number,
  height: number,
  fontSize: number,
): number {
  return (
    top + height / 2 + ((QCF_INK_ABOVE_EM - QCF_INK_BELOW_EM) / 2) * fontSize
  );
}

/**
 * Lays out a page. `advanceEm` is a word's natural width in em (the sum of
 * its glyph advances over the font's units per em).
 */
export function layoutQCFPage(
  page: QCFPageModel,
  advanceEm: (word: QCFWord) => number,
  geometry: QCFPageGeometry,
): QCFPageLayout {
  const {contentWidth, lineTops, lineHeight} = geometry;
  const lineWidth = contentWidth * QCF_LINE_WIDTH_RATIO;
  const lineLeft = (contentWidth - lineWidth) / 2;

  const wordEms = page.lines.map(line => line.words.map(advanceEm));
  const lineEms = wordEms.map(ems => ems.reduce((sum, em) => sum + em, 0));
  const fullLineEms: number[] = [];
  page.lines.forEach((line, index) => {
    if (line.kind === 'ayah' && !line.centered && line.words.length > 0) {
      fullLineEms.push(lineEms[index]);
    }
  });
  let reference = QCF_DEFAULT_LINE_EM;
  if (fullLineEms.length > 0) {
    const limit = median(fullLineEms) * (1 + REFERENCE_TOLERANCE);
    const widest = Math.max(...fullLineEms.filter(em => em <= limit));
    reference = Math.min(MAX_LINE_EM, Math.max(MIN_LINE_EM, widest));
  }
  const fontSize = lineWidth / reference;

  const lines = page.lines.map((line, lineIndex): QCFPlacedLine => {
    const top = lineTops[lineIndex] ?? lineIndex * lineHeight;
    const ems = wordEms[lineIndex];
    const count = ems.length;
    let size = fontSize;
    let gap = 0;
    let right: number;
    const natural = lineEms[lineIndex] * fontSize;
    if (count === 0) {
      right = lineLeft + lineWidth;
    } else if (line.centered || count === 1 || line.kind !== 'ayah') {
      // A centred line, kept centred even if it were wider than the line.
      const width = Math.min(natural, lineWidth);
      if (natural > lineWidth) size = (fontSize * lineWidth) / natural;
      right = lineLeft + (lineWidth + width) / 2;
    } else {
      const extra = lineWidth - natural;
      const squeeze = -QCF_MAX_SQUEEZE * lineWidth;
      if (extra < squeeze) {
        size = (fontSize * lineWidth * (1 + QCF_MAX_SQUEEZE)) / natural;
        gap = squeeze / (count - 1);
      } else {
        gap = extra / (count - 1);
      }
      right = lineLeft + lineWidth;
    }
    const words: QCFPlacedWord[] = line.words.map((word, wordIndex) => {
      const width = ems[wordIndex] * size;
      const placed = {word, x: right - width, width};
      right -= width + gap;
      return placed;
    });
    return {
      lineIndex,
      line,
      top,
      height: lineHeight,
      baseline: qcfBaseline(top, lineHeight, size),
      fontSize: size,
      gap,
      words,
    };
  });

  return {
    pageNumber: page.pageNumber,
    fontSize,
    lineLeft,
    lineWidth,
    lines,
  };
}

/** Where a touch lands among a page's words. */
export interface QCFWordHit {
  lineIndex: number;
  /** Index of the word in its line (reading order). */
  wordIndex: number;
  word: QCFWord;
}

/**
 * The word under a point in content coordinates: the line whose slot holds
 * `y`, then the word nearest `x` on it (a touch in a gap goes to the closer
 * word). Null off the text: outside every slot, on a title or basmala line,
 * or beyond a line's ends by more than half a gap's worth of slack.
 */
export function qcfWordAt(
  layout: QCFPageLayout,
  x: number,
  y: number,
): QCFWordHit | null {
  const placed = layout.lines.find(
    line => y >= line.top && y < line.top + line.height,
  );
  if (!placed || placed.words.length === 0) return null;
  const slack = Math.max(placed.gap, placed.fontSize * 0.25);
  let bestIndex = -1;
  let bestDistance = Infinity;
  for (let index = 0; index < placed.words.length; index++) {
    const {x: left, width} = placed.words[index];
    const distance =
      x < left ? left - x : x > left + width ? x - left - width : 0;
    if (distance < bestDistance) {
      bestIndex = index;
      bestDistance = distance;
    }
  }
  if (bestIndex < 0 || bestDistance > slack) return null;
  return {
    lineIndex: placed.lineIndex,
    wordIndex: bestIndex,
    word: placed.words[bestIndex].word,
  };
}
