// @ai-generated
/**
 * Justified spaces on a DigitalKhatt line.
 *
 * JustService gives every space of a line its justified width
 * (JustResultByLine.simpleSpacing / ayaSpacing, in font units at FONTSIZE,
 * where the font's own space is SPACEWIDTH units). SkParagraph ignores
 * letterSpacing and wordSpacing on Arabic runs, so a space widened with
 * letterSpacing keeps its natural width and the line ends short at its left
 * (RTL) end by every unit the spaces were meant to add.
 *
 * A space's width is set through its font size instead: the space's advance
 * scales with the size. A forced strut keeps the larger size from moving the
 * line box or the baseline, and highlight rects are clamped to the words'
 * band, since a larger space's rect spans that size's ascent and descent.
 *
 * A space set at its own size is shaped apart from its neighbours, so a
 * DigitalKhatt adjustment that spans two words and the space between them
 * (it widens a few gaps, e.g. before a hamza below) no longer applies, while
 * JustService measured the line with it. The drawn line is therefore measured
 * once more and any residue spread evenly over its spaces (spaceFitExtra); a
 * line at the words' spacing (a shrunk line) is scaled instead (fitWordSize),
 * which keeps its spaces in the words' runs.
 */

import type {SkStrutStyle} from '@shopify/react-native-skia';
import type {JustResultByLine} from '@/services/mushaf/JustificationService';
import {FONTSIZE, SPACEWIDTH} from '@/services/mushaf/QuranTextService';

/** Narrowest spacing drawn (font units at FONTSIZE): a font size must stay
 *  positive, so an overshoot never takes a space to or below zero. */
const MIN_SPACING = 1;

/**
 * Whether a line is drawn at its natural width, centred: an ayah line the
 * layout centres (is_centered) that has no width of its own in
 * QuranTextService's line-width table (lineWidthRatio 1). Such lines close a
 * surah on a short line (e.g. 586:1); justifying them would stretch them
 * across the page.
 */
export function isNaturalWidthLine(lineInfo: {
  lineType: number;
  lineWidthRatio: number;
  isCentered?: boolean;
}): boolean {
  return (
    lineInfo.lineType === 0 &&
    lineInfo.isCentered === true &&
    lineInfo.lineWidthRatio === 1
  );
}

/** The justification of a line drawn at its natural width: no kashida, the
 *  font's own spaces, and only a shrink JustService needed to fit the page. */
export function naturalJustification(
  justification: JustResultByLine,
): JustResultByLine {
  return {
    ...justification,
    fontFeatures: new Map(),
    simpleSpacing: SPACEWIDTH,
    ayaSpacing: SPACEWIDTH,
    fontSizeRatio: Math.min(1, justification.fontSizeRatio),
  };
}

/** Residue (px) under which a drawn line counts as fitted. */
export const LINE_FIT_TOLERANCE = 0.25;

/** Font size at which a space is `spacing` wide (font units at FONTSIZE)
 *  plus `extraWidth` px, on a line whose words are set at `fontSize`. */
export function justifiedSpaceFontSize(
  fontSize: number,
  spacing: number,
  extraWidth = 0,
): number {
  const size =
    (fontSize * spacing) / SPACEWIDTH + (extraWidth * FONTSIZE) / SPACEWIDTH;
  return Math.max(size, (fontSize * MIN_SPACING) / SPACEWIDTH);
}

/**
 * Words' font size that makes a line drawn `drawnWidth` wide at `fontSize`
 * fill `targetWidth`, for a line at the words' spacing (its spaces share the
 * words' runs, so the whole line scales); `fontSize` when it already fits.
 */
export function fitWordSize(
  fontSize: number,
  targetWidth: number,
  drawnWidth: number,
): number {
  if (
    drawnWidth <= 0 ||
    Math.abs(targetWidth - drawnWidth) <= LINE_FIT_TOLERANCE
  )
    return fontSize;
  return (fontSize * targetWidth) / drawnWidth;
}

/**
 * A line's fit pass result: the words' font size and the px added to every
 * space. Cached per line for the session (by everything that sets the drawn
 * width: the line text, its justification, font, size and line width), so a
 * line is measured and rebuilt at most once; later builds of it (a colour,
 * tajweed or highlight change, a page revisit) build once with the fit.
 */
export interface LineFit {
  wordSize: number;
  spaceExtra: number;
}

/** Lines kept (about 130 pages of 15 lines). */
const LINE_FIT_LIMIT = 2000;
const lineFits = new Map<string, LineFit>();

/** Cached fit of the line `key` names (see lineFitKey), most recent first. */
export function getLineFit(key: string): LineFit | undefined {
  const fit = lineFits.get(key);
  if (fit) {
    lineFits.delete(key);
    lineFits.set(key, fit);
  }
  return fit;
}

export function setLineFit(key: string, fit: LineFit): void {
  lineFits.set(key, fit);
  if (lineFits.size > LINE_FIT_LIMIT) {
    const oldest = lineFits.keys().next().value;
    if (oldest !== undefined) lineFits.delete(oldest);
  }
}

/** Drops every cached fit (tests). */
export function clearLineFits(): void {
  lineFits.clear();
}

/**
 * Key of a line's fit: everything that sets its drawn width. `features` is
 * the justification's per-character font features (index -> features).
 */
export function lineFitKey(
  lineText: string,
  fontFamily: string,
  fontSize: number,
  lineWidth: number,
  justification: {
    simpleSpacing: number;
    ayaSpacing: number;
    fontSizeRatio: number;
    fontFeatures: ReadonlyMap<
      number,
      ReadonlyArray<{name: string; value: number}>
    >;
  },
): string {
  let features = '';
  for (const [index, list] of justification.fontFeatures) {
    features += `${index}:`;
    for (const f of list) features += `${f.name}=${f.value},`;
    features += ';';
  }
  return [
    fontFamily,
    fontSize,
    lineWidth,
    justification.fontSizeRatio,
    justification.simpleSpacing,
    justification.ayaSpacing,
    features,
    lineText,
  ].join('|');
}

/**
 * Width (px) to add to each of a line's `spaceCount` spaces so a line drawn
 * `drawnWidth` wide fills `targetWidth`; 0 when it already fits.
 */
export function spaceFitExtra(
  targetWidth: number,
  drawnWidth: number,
  spaceCount: number,
): number {
  const residue = targetWidth - drawnWidth;
  if (spaceCount <= 0 || Math.abs(residue) <= LINE_FIT_TOLERANCE) return 0;
  return residue / spaceCount;
}

/** Strut that pins a line's box and baseline to its words' size, whatever
 *  size its spaces are set at. */
export function justifiedLineStrut(
  fontFamily: string,
  fontSize: number,
): SkStrutStyle {
  return {
    strutEnabled: true,
    forceStrutHeight: true,
    fontFamilies: [fontFamily],
    fontSize,
  };
}

export interface LineBand {
  top: number;
  bottom: number;
}

/** Band from the top of the highest to the bottom of the lowest of `rects`
 *  (a word's rects: one per style run); null when there are none. */
export function rectsBand(
  rects: ReadonlyArray<{y: number; height: number}>,
): LineBand | null {
  if (rects.length === 0) return null;
  let top = Infinity;
  let bottom = -Infinity;
  for (const r of rects) {
    top = Math.min(top, r.y);
    bottom = Math.max(bottom, r.y + r.height);
  }
  return {top, bottom};
}

/** Band of the shortest of `rects`: a word's rect is never taller than a
 *  justified space's. Null when there are none. */
export function shortestRectBand(
  rects: ReadonlyArray<{y: number; height: number}>,
): LineBand | null {
  let best: {y: number; height: number} | null = null;
  for (const r of rects) if (!best || r.height < best.height) best = r;
  return best ? {top: best.y, bottom: best.y + best.height} : null;
}

/**
 * Merges rects that touch or overlap side by side within `gap` px into one
 * (the clamped rects of one highlight on one line share a band). A justified
 * line shapes each space apart, so a highlight's range comes back as one rect
 * per word and space; drawn one by one, their rounded corners seam the band.
 */
export function mergeTouchingRects<
  T extends {x: number; y: number; width: number; height: number},
>(rects: ReadonlyArray<T>, gap = 0.5): T[] {
  const sorted = [...rects].sort((a, b) => a.x - b.x);
  const merged: T[] = [];
  for (const r of sorted) {
    const last = merged[merged.length - 1];
    if (last && r.x <= last.x + last.width + gap) {
      const top = Math.min(last.y, r.y);
      const right = Math.max(last.x + last.width, r.x + r.width);
      const bottom = Math.max(last.y + last.height, r.y + r.height);
      merged[merged.length - 1] = {
        ...last,
        y: top,
        width: right - last.x,
        height: bottom - top,
      };
    } else {
      merged.push(r);
    }
  }
  return merged;
}

/** Clamps a rect to the words' band (top and bottom of a word's rect). */
export function clampRectToBand<T extends {y: number; height: number}>(
  rect: T,
  band: LineBand | null,
): T {
  if (!band) return rect;
  const top = Math.max(rect.y, band.top);
  const bottom = Math.min(rect.y + rect.height, band.bottom);
  if (bottom <= top) return rect;
  return {...rect, y: top, height: bottom - top};
}
