import {Dimensions} from 'react-native';
import {
  lightColors,
  darkColors,
  PrimaryColor,
  primaryColors,
} from '@/styles/colorSchemes';

const {width} = Dimensions.get('window');
const scale = (size: number) => (width / 375) * size;

export type ThemeMode = 'light' | 'dark' | 'system';

export const createTheme = (
  colorScheme: 'light' | 'dark',
  primaryColor: PrimaryColor,
) => ({
  colors: {
    ...(colorScheme === 'light' ? lightColors : darkColors),
    primary: primaryColors[primaryColor],
  },
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
    arabicSize: scale(20),
    mediumSize: scale(14),
    smallSize: scale(12),
    captionSize: scale(10),
  },
  spacing: {
    unit: scale(7),
  },
});

export type Theme = ReturnType<typeof createTheme>;
