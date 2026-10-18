/**
 * Vega has no expo-font; it serves packaged fonts by file name. That works for
 * Manrope (tv-vega/scripts/sync-fonts.js), but the calligraphy font's own
 * family name is 'icomoon', so until a device run shows how Vega resolves it
 * its private-use glyphs could render as empty boxes. Surah glyphs fall back
 * to the transliterated name there.
 */
export const surahGlyphsAvailable = false;

/** Same for the Quran text font: Vega uses the system Arabic font instead. */
export const quranTextFontAvailable = false;
