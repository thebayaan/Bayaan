import {DefaultTheme} from '@react-navigation/native';

export const lightColors = {
  ...DefaultTheme.colors,
  background: '#f4f3ec',
  backgroundSecondary: '#edebe3',
  text: '#06151C',
  secondary: '#f0f0f0',
  accent: '#5645a1',
  textSecondary: '#052c39',
  light: '#f4f4f4',
  border: '#a4a4a4',
  shadow: '#000000',
  error: '#DC2626',
  card: '#e4e2d8',
  tertiary: '#5645a1',
};

export const darkColors = {
  ...DefaultTheme.colors,
  background: '#06151C',
  backgroundSecondary: '#0d1f29',
  text: '#e8e8e8',
  secondary: '#1c1a1e',
  accent: '#00623a',
  textSecondary: '#B0B0B0',
  light: '#242326',
  border: '#332f38',
  shadow: '#000000',
  error: '#EF4444',
  card: '#050b10',
  tertiary: '#ba5b37',
};

export const primaryColors = {
  // Core colors (most commonly used)
  Blue: '#2196F3',
  Green: '#4CAF50',
  Red: '#F44336',
  Orange: '#FF9800',
  Purple: '#673AB7',

  // Cool tones
  DeepBlue: '#1565C0',
  Teal: '#009688',
  Cyan: '#00BCD4',
  Indigo: '#3F51B5',

  // Warm tones
  DeepOrange: '#FF5722',
  Rose: '#E91E63',
  Amber: '#FFC107',
  Brown: '#795548',

  // Vibrant accents
  Pink: '#FF4081',
  Lime: '#CDDC39',
  DeepPurple: '#7E57C2',

  // Neutral
  Slate: '#607D8B',
  Steel: '#455A64',
};

export type ColorScheme = typeof lightColors & {primary: string};
export type PrimaryColor = keyof typeof primaryColors;
