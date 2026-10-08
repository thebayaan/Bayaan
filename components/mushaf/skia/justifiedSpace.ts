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
import {FONTSIZE, SPACEWIDTH} from '@/services/mushaf/QuranTextService';

/** Narrowest spacing drawn (font units at FONTSIZE): a font size must stay
 *  positive, so an overshoot never takes a space to or below zero. */
const MIN_SPACING = 1;

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
