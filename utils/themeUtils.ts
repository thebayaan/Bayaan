import {
  lightColors,
  darkColors,
  primaryColors,
  PrimaryColor,
} from '@/styles/colorSchemes';
import {Dimensions} from 'react-native';

const {width} = Dimensions.get('window');
const scale = (size: number) => (width / 375) * size;

export type ThemeMode = 'light' | 'dark' | 'system';
export type {PrimaryColor} from '@/styles/colorSchemes';

export const createTheme = (
  colorScheme: 'light' | 'dark',
  primaryColor: PrimaryColor,
) => ({
  colors: {
    ...(colorScheme === 'light' ? lightColors : darkColors),
    primary: primaryColors[primaryColor],
  },
  fonts: {
    regular: 'AvenirNextLTPro-Regular',
    bold: 'AvenirNextLTPro-Bold',
    heading: 'AvenirNextLTPro-Bold',
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
