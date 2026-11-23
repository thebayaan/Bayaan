import {
  lightColors,
  darkColors,
  primaryColors,
  PrimaryColor,
} from '@/styles/colorSchemes';
import {Dimensions, ColorSchemeName, Appearance} from 'react-native';
import Color from 'color';
import {PHONE_SCALE_CAP} from '@/utils/responsive';

const {width} = Dimensions.get('window');
// Clamp scaling base so tablets (iPad) do not inflate the theme typography.
// Phones always pass through unchanged because their width <= PHONE_SCALE_CAP.
const scaleBase = Math.min(width, PHONE_SCALE_CAP);
const scale = (size: number) => (scaleBase / 375) * size;

export type ThemeMode = 'light' | 'dark' | 'system';
export type {PrimaryColor} from '@/styles/colorSchemes';

export const createTheme = (
  colorScheme: ColorSchemeName | ThemeMode,
  primaryColor: PrimaryColor,
) => {
  // Handle system theme mode
  let effectiveColorScheme: 'light' | 'dark';
  if (colorScheme === 'system') {
    const systemTheme = Appearance.getColorScheme();
    // Convert system theme to our theme type
    effectiveColorScheme = systemTheme === 'dark' ? 'dark' : 'light';
  } else {
    effectiveColorScheme = colorScheme === 'dark' ? 'dark' : 'light';
  }

  return {
    colors: {
      ...(effectiveColorScheme === 'dark' ? darkColors : lightColors),
      primary: primaryColors[primaryColor],
    },
    isDarkMode: effectiveColorScheme === 'dark',
    fonts: {
      regular: 'Manrope-Regular',
      bold: 'Manrope-Bold',
      heading: 'Manrope-Bold',
      medium: 'Manrope-Medium',
      semiBold: 'Manrope-SemiBold',
      light: 'Manrope-Light',
      extraLight: 'Manrope-ExtraLight',
      extraBold: 'Manrope-ExtraBold',
    },
    typography: {
      headingSize: scale(30),
      subheadingSize: scale(18),
      bodySize: scale(16),
      mediumSize: scale(14),
      smallSize: scale(12),
      arabicSize: scale(20),
      captionSize: scale(10),
    },
    spacing: {
      unit: scale(7),
    },
  };
};

export type Theme = ReturnType<typeof createTheme>;

/** WCAG AA for text under 18pt (ipad-standards §12). */
const TEXT_CONTRAST = 4.5;
/** The accent moves toward the text colour in steps of 1/ACCENT_STEPS. */
const ACCENT_STEPS = 20;

/**
 * The opaque colour that `color` at `alpha` over the theme background makes:
 * a surface such as the 4% text fill of a card, for contrast checks.
 */
export function overBackground(
  theme: Theme,
  color: string,
  alpha: number,
): string {
  return Color(theme.colors.background).mix(Color(color), alpha).hex();
}

/**
 * The accent colour (theme.colors.primary) for text drawn in it: as it is
 * when it reaches `contrast` on every one of `backgrounds` (opaque colours,
 * the theme background by default), otherwise mixed toward the text colour
 * a step at a time until it does. Many accents are too light on the light
 * background (Blue, Amber, Lime) or too dark on the dark one (Purple,
 * Indigo) to read as text. Pass 3 for an icon.
 */
export function readableAccent(
  theme: Theme,
  backgrounds: readonly string[] = [theme.colors.background],
  contrast = TEXT_CONTRAST,
): string {
  const grounds = backgrounds.map(background => Color(background));
  const reads = (color: string) =>
    grounds.every(ground => Color(color).contrast(ground) >= contrast);
  if (reads(theme.colors.primary)) return theme.colors.primary;
  const accent = Color(theme.colors.primary);
  const text = Color(theme.colors.text);
  for (let step = 1; step < ACCENT_STEPS; step++) {
    const mixed = accent.mix(text, step / ACCENT_STEPS).hex();
    if (reads(mixed)) return mixed;
  }
  return theme.colors.text;
}
