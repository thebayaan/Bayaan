import {
  lightColors,
  darkColors,
  primaryColors,
  PrimaryColor,
} from '@/styles/colorSchemes';
import {Dimensions, ColorSchemeName, Appearance} from 'react-native';
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
