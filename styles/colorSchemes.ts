import {DefaultTheme} from '@react-navigation/native';

export const lightColors = {
  ...DefaultTheme.colors,
  background: '#ffffff',
  backgroundSecondary: '#f4f4f4',
  text: '#1a1a1a',
  secondary: '#f0f0f0',
  accent: '#5645a1',
  textSecondary: '#6e6e6e',
  light: '#f4f4f4',
  border: '#a4a4a4',
  shadow: '#000000',
  error: '#DC2626',
  card: '#ececec',
  tertiary: '#5645a1',
};

export const darkColors = {
  ...DefaultTheme.colors,
  background: '#121212',
  backgroundSecondary: '#1c1a1e',
  text: '#e8e8e8',
  secondary: '#1c1a1e',
  accent: '#00623a',
  textSecondary: '#B0B0B0',
  light: '#242326',
  border: '#332f38',
  shadow: '#000000',
  error: '#EF4444',
  card: '#1c1b1d',
  tertiary: '#ba5b37',
};

export const primaryColors = {
  // Core colors (most commonly used)
  Purple: '#5645a1',
  Blue: '#1976d2',
  Green: '#2e7d32',
  Red: '#d32f2f',
  Orange: '#f57c00',

  // Cool tones
  DeepBlue: '#0d47a1',
  Teal: '#00796b',
  Cyan: '#0097a7',
  Indigo: '#283593',

  // Warm tones
  DeepOrange: '#e64a19',
  Rose: '#c2185b',
  Amber: '#ffa000',
  Brown: '#5d4037',

  // Vibrant accents
  Pink: '#d81b60',
  Lime: '#689f38',
  DeepPurple: '#4527a0',

  // Neutral
  Slate: '#455a64',
  Steel: '#37474f',
};

export type ColorScheme = typeof lightColors & {primary: string};
export type PrimaryColor = keyof typeof primaryColors;
