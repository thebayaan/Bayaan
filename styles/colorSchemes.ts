import {DefaultTheme} from '@react-navigation/native';

export const lightColors = {
  ...DefaultTheme.colors,
  background: '#f9f9f9',
  backgroundSecondary: '#f4f2f8',
  text: '#1a1a1a',
  secondary: '#f0f0f0',
  accent: '#5645a1',
  textSecondary: '#6e6e6e',
  light: '#d2d2d2',
  border: '#a4a4a4',
  shadow: '#000000',
  error: '#b00020',
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
  light: '#5b595d',
  border: '#332f38',
  shadow: '#000000',
  error: '#d9c8fe',
  card: '#1c1b1d',
  tertiary: '#ba5b37',
};

export const primaryColors = {
  Purple: '#5645a1',
  Blue: '#30aec6',
  Green: '#253d0f',
  Red: '#5c0700',
  Yellow: '#f5ec00',
  Orange: '#ad3d00',
  Pink: '#d257fe',
};

export type ColorScheme = typeof lightColors & {primary: string};
export type PrimaryColor = keyof typeof primaryColors;
