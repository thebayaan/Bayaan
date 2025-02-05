import {
  lightColors,
  darkColors,
  primaryColors,
  PrimaryColor,
} from '@/styles/colorSchemes';
import {Dimensions, ColorSchemeName} from 'react-native';

const {width} = Dimensions.get('window');
const scale = (size: number) => (width / 375) * size;

export type ThemeMode = 'light' | 'dark' | 'system';
export type {PrimaryColor} from '@/styles/colorSchemes';

export const createTheme = (
  colorScheme: ColorSchemeName | ThemeMode,
  primaryColor: PrimaryColor,
) => ({
  colors: {
    ...(colorScheme === 'dark' ? darkColors : lightColors),
    primary: primaryColors[primaryColor],
  },
  isDarkMode: colorScheme === 'dark',
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
});

export type Theme = ReturnType<typeof createTheme>;
