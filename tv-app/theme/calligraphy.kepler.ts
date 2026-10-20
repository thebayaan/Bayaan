/**
 * Vega serves packaged fonts by file name (tv-vega/scripts/sync-fonts.js).
 * The calligraphy and Quran fonts are packaged as SurahNames.ttf and
 * UthmanicHafs.ttf, copies whose family names match their file names, so
 * both resolve on Vega as they do on tvOS and Android TV.
 */
export const surahGlyphsAvailable = true;

/** Whether the Uthmanic Hafs Quran text font is registered on this platform. */
export const quranTextFontAvailable = true;
