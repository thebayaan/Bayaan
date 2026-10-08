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
 */

import type {SkStrutStyle} from '@shopify/react-native-skia';
import {SPACEWIDTH} from '@/services/mushaf/QuranTextService';

/** Narrowest spacing drawn (font units at FONTSIZE): a font size must stay
 *  positive, so an overshoot never takes a space to or below zero. */
const MIN_SPACING = 1;

/** Font size at which a space is `spacing` wide (font units at FONTSIZE),
 *  on a line whose words are set at `fontSize`. */
export function justifiedSpaceFontSize(
  fontSize: number,
  spacing: number,
): number {
  return (fontSize * Math.max(spacing, MIN_SPACING)) / SPACEWIDTH;
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
