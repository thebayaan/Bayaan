// How a surah's drawn artwork (see brand/SurahArtwork) fills its slot.

import {surahGlyphsAvailable} from '../theme/calligraphy';

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
