// How a surah's drawn artwork (see brand/SurahArtwork) fills its slot.

import {surahGlyphsAvailable} from '../theme/calligraphy';
import {
  SURAH_GLYPH_ASCENT,
  SURAH_GLYPH_DESCENT,
  SURAH_GLYPH_METRICS,
} from '../theme/surahGlyphMetrics';

/** Slots at least this wide (design px) also carry the surah's name. */
const NAMED_MIN_WIDTH = 150;

/**
 * Whether a slot `width` design pixels wide has room for the transliterated
 * name under the calligraphy (tiles, not thumbnails). Where the calligraphy
 * font is missing (Vega) the glyph already is the name, so it is never
 * repeated.
 */
export function showsSurahName(
  width: number,
  glyphs: boolean = surahGlyphsAvailable,
): boolean {
  return glyphs && width >= NAMED_MIN_WIDTH;
}

/**
 * The name's size under a glyph of `glyphSize` (design px): the ratio Vega's
 * name-for-glyph fallback uses, kept between legible and not shouting.
 */
export function surahNameSize(glyphSize: number): number {
  return Math.min(40, Math.max(18, Math.round(glyphSize * 0.4)));
}

/** A Text's line box per em of font size, for the calligraphy (see below). */
const GLYPH_LINE_HEIGHT = 1.6;

export type SurahGlyphBox = {
  /** The calligraphy's font size, after shrinking to `fitWidth`. */
  fontSize: number;
  lineHeight: number;
  /** The ink's size: the box the glyph takes in layout. */
  width: number;
  height: number;
  /** Where the Text sits inside that box so its ink fills it exactly. */
  textLeft: number;
  textTop: number;
  textWidth: number;
};

/**
 * Lays out a surah's calligraphy by its ink, in design px. Each glyph in the
 * font starts with a blank margin about a sixth of its width and the longest
 * run to 2.7 em, so a Text laid out by its advance sits right of centre and
 * spills out of a card. Instead the glyph takes exactly its ink box, shrunk
 * so the ink is at most `fitWidth` wide, and the Text is offset inside it.
 * The font's ascender plus descender is 1 em, and both platforms centre a
 * single line in a taller lineHeight, which puts the baseline at
 * (lineHeight - 1 em) / 2 + ascender from the Text's top.
 */
export function surahGlyphBox(
  surahNumber: number,
  size: number,
  fitWidth?: number,
): SurahGlyphBox {
  const metrics =
    SURAH_GLYPH_METRICS[Math.min(114, Math.max(1, surahNumber)) - 1];
  const [advance, inkLeft, inkRight, inkBottom, inkTop] = metrics;
  const inkWidth = inkRight - inkLeft;
  const fontSize =
    fitWidth === undefined || fitWidth <= 0
      ? size
      : Math.min(size, fitWidth / inkWidth);
  const lineHeight = fontSize * GLYPH_LINE_HEIGHT;
  const baseline =
    (lineHeight - fontSize * (SURAH_GLYPH_ASCENT + SURAH_GLYPH_DESCENT)) / 2 +
    fontSize * SURAH_GLYPH_ASCENT;
  return {
    fontSize,
    lineHeight,
    width: inkWidth * fontSize,
    height: (inkTop - inkBottom) * fontSize,
    textLeft: -inkLeft * fontSize,
    textTop: inkTop * fontSize - baseline,
    // A little over the advance, so rounding never wraps or clips the glyph.
    textWidth: advance * fontSize + 4,
  };
}
