import {Dimensions} from 'react-native';
import {
  lightColors,
  darkColors,
  PrimaryColor,
  primaryColors,
} from '@/styles/colorSchemes';
import {PHONE_SCALE_CAP} from '@/utils/responsive';

const {width} = Dimensions.get('window');
// Clamp scaling base so tablets do not inflate typography/spacing.
// Phones pass through unchanged (width <= PHONE_SCALE_CAP).
const scaleBase = Math.min(width, PHONE_SCALE_CAP);
const scale = (size: number) => (scaleBase / 375) * size;

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
