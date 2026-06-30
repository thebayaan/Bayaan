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
 * Digital Khatt family name for Quran / Arabic text. Loaded into a Skia font
 * provider (matches the mobile mushaf pipeline), never used as a system font.
 */
export const quranFontFamily = 'DigitalKhatt';

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
