import {TextStyle} from 'react-native';

type TypographyStyle = {
  fontSize: number;
  fontWeight: TextStyle['fontWeight'];
  textTransform?: TextStyle['textTransform'];
  letterSpacing?: number;
};

export const typography: Record<string, TypographyStyle> = {
  titleXL: {
    fontSize: 64,
    fontWeight: '700',
  },
  title: {
    fontSize: 48,
    fontWeight: '700',
  },
  heading: {
    fontSize: 32,
    fontWeight: '600',
  },
  body: {
    fontSize: 20,
    fontWeight: '400',
  },
  caption: {
    fontSize: 16,
    fontWeight: '400',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1.6,
  },
} as const;
