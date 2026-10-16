import {TextStyle} from 'react-native';

/**
 * Bayaan brand typography for the TV UI.
 *
 * Brand text uses the Manrope family (mirrors the mobile theme in
 * `styles/theme.ts` and `app/_layout.tsx`), scaled up for 10-foot legibility.
 * Any Quran / Arabic text must use the Digital Khatt font (`quranFontFamily`)
 * rendered via SkiaVerseText, never Manrope or a system font.
 *
 * NOTE: the Manrope `.ttf` assets must be registered in the TV app bootstrap
 * via expo-font for `fontFamily` to take effect. Until then text falls back to
 * the platform system font (the explicit `fontWeight` keeps weights correct on
 * fallback); there is no crash. See the cross-file notes for this task.
 */

/** Manrope brand font-family names (must match the registered font assets). */
export const fonts = {
  regular: 'Manrope-Regular',
  medium: 'Manrope-Medium',
  semiBold: 'Manrope-SemiBold',
  bold: 'Manrope-Bold',
  extraBold: 'Manrope-ExtraBold',
  light: 'Manrope-Light',
  extraLight: 'Manrope-ExtraLight',
} as const;

/**
 * Surah-name calligraphy (the mobile app's `surah_names.ttf`). Each surah's
 * name is a single private-use glyph; see `utils/surahGlyphMap.ts` and
 * `components/brand/SurahGlyph.tsx`. Decorative artwork only: it is not Quran
 * text, which stays on Digital Khatt.
 */
export const surahNameFontFamily = 'SurahNames';

/**
 * Digital Khatt family name for Quran / Arabic text. Loaded into a Skia font
 * provider (matches the mobile mushaf pipeline), never used as a system font.
 */
export const quranFontFamily = 'DigitalKhatt';

/**
 * Quran text in the listening room. The TV app has no Skia, so it can't run
 * the Digital Khatt pipeline; until Skia is proven on tvOS and Vega it uses
 * the KFGQPC Uthmanic Hafs font, the font `data/quran.json`'s text is encoded
 * for, as plain text. Vega can't register it and falls back to the system
 * Arabic font (see `theme/calligraphy`).
 */
export const quranTextFontFamily = 'UthmanicHafs';

type TypographyStyle = {
  fontFamily: string;
  fontSize: number;
  fontWeight: TextStyle['fontWeight'];
  textTransform?: TextStyle['textTransform'];
  letterSpacing?: number;
};

export const typography: Record<string, TypographyStyle> = {
  titleXL: {
    fontFamily: fonts.bold,
    fontSize: 64,
    fontWeight: '700',
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 48,
    fontWeight: '700',
  },
  heading: {
    fontFamily: fonts.semiBold,
    fontSize: 32,
    fontWeight: '600',
  },
  body: {
    fontFamily: fonts.regular,
    fontSize: 20,
    fontWeight: '400',
  },
  caption: {
    fontFamily: fonts.regular,
    fontSize: 16,
    fontWeight: '400',
  },
  label: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1.6,
  },
} as const;
