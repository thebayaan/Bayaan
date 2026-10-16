/**
 * Vega has no expo-font and the calligraphy font is not bundled into the Vega
 * package, so its private-use glyphs would render as empty boxes. Surah glyphs
 * fall back to the transliterated name there.
 */
export const surahGlyphsAvailable = false;

/** Same for the Quran text font: Vega uses the system Arabic font instead. */
export const quranTextFontAvailable = false;
