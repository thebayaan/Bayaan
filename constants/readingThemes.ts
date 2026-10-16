/**
 * Reading themes define the color palette for the entire app.
 * "System" follows device appearance with default colors.
 * Selecting a specific theme forces light/dark mode and applies custom colors.
 */

// The bare i18next singleton (initialised by '@/i18n' at app start) keeps this
// module free of native dependencies; it is loaded by Jest suites via stores.
// @ai-start
import i18n from 'i18next';
// @ai-end

export interface ReadingThemeColors {
  background: string;
  backgroundSecondary: string;
  text: string;
  textSecondary: string;
  card: string;
}

export interface ReadingTheme {
  id: string;
  name: string;
  mode: 'light' | 'dark';
  colors: ReadingThemeColors;
}

// @ai-start
export const LIGHT_READING_THEMES: ReadingTheme[] = [
  {
    id: 'default',
    get name() {
      return i18n.t('content:readingThemes.default');
    },
    mode: 'light',
    colors: {
      background: '#f4f3ec',
      backgroundSecondary: '#edebe3',
      text: '#06151C',
      textSecondary: '#052c39',
      card: '#dcdeda',
    },
  },
  {
    id: 'parchment',
    get name() {
      return i18n.t('content:readingThemes.parchment');
    },
    mode: 'light',
    colors: {
      background: '#f5e6c8',
      backgroundSecondary: '#eddcba',
      text: '#2c1810',
      textSecondary: '#5a3a28',
      card: '#e5d4b2',
    },
  },
  {
    id: 'white',
    get name() {
      return i18n.t('content:readingThemes.white');
    },
    mode: 'light',
    colors: {
      background: '#ffffff',
      backgroundSecondary: '#f5f5f5',
      text: '#1a1a1a',
      textSecondary: '#666666',
      card: '#eeeeee',
    },
  },
  {
    id: 'sage',
    get name() {
      return i18n.t('content:readingThemes.sage');
    },
    mode: 'light',
    colors: {
      background: '#e8ebe4',
      backgroundSecondary: '#dfe3db',
      text: '#1c2b1e',
      textSecondary: '#4a5c4e',
      card: '#d5d9d0',
    },
  },
  {
    id: 'rose',
    get name() {
      return i18n.t('content:readingThemes.rose');
    },
    mode: 'light',
    colors: {
      background: '#f5ece8',
      backgroundSecondary: '#ede2dd',
      text: '#241a18',
      textSecondary: '#6b4f47',
      card: '#e3d8d3',
    },
  },
  {
    id: 'cool',
    get name() {
      return i18n.t('content:readingThemes.cool');
    },
    mode: 'light',
    colors: {
      background: '#eef0f2',
      backgroundSecondary: '#e4e7ea',
      text: '#1a1d21',
      textSecondary: '#5a5f66',
      card: '#d9dce0',
    },
  },
  {
    id: 'sand',
    get name() {
      return i18n.t('content:readingThemes.sand');
    },
    mode: 'light',
    colors: {
      background: '#f0d59a',
      backgroundSecondary: '#e8c888',
      text: '#1a0800',
      textSecondary: '#5c3418',
      card: '#e0c07a',
    },
  },
];
// @ai-end

// Order matches LIGHT_READING_THEMES positionally:
// Cream↔Navy, Parchment↔Sepia, White↔Black, Sage↔Sage, Rose↔Charcoal, Cool↔Indigo, Sand↔Amber
// @ai-start
export const DARK_READING_THEMES: ReadingTheme[] = [
  {
    id: 'dark-default',
    get name() {
      return i18n.t('content:readingThemes.darkDefault');
    },
    mode: 'dark',
    colors: {
      background: '#050b10',
      backgroundSecondary: '#06151C',
      text: '#ffffff',
      textSecondary: '#B0B0B0',
      card: '#050b10',
    },
  },
  {
    id: 'dark-sepia',
    get name() {
      return i18n.t('content:readingThemes.darkSepia');
    },
    mode: 'dark',
    colors: {
      background: '#140f0a',
      backgroundSecondary: '#1c1610',
      text: '#d4c4a8',
      textSecondary: '#8a7a60',
      card: '#140f0a',
    },
  },
  {
    id: 'oled',
    get name() {
      return i18n.t('content:readingThemes.oled');
    },
    mode: 'dark',
    colors: {
      background: '#000000',
      backgroundSecondary: '#0a0a0a',
      text: '#e8e8e8',
      textSecondary: '#808080',
      card: '#000000',
    },
  },
  {
    id: 'dark-sage',
    get name() {
      return i18n.t('content:readingThemes.darkSage');
    },
    mode: 'dark',
    colors: {
      background: '#141a16',
      backgroundSecondary: '#1a221c',
      text: '#c0ccc2',
      textSecondary: '#6e7e70',
      card: '#141a16',
    },
  },
  {
    id: 'charcoal',
    get name() {
      return i18n.t('content:readingThemes.charcoal');
    },
    mode: 'dark',
    colors: {
      background: '#1a1a1a',
      backgroundSecondary: '#222222',
      text: '#e0e0e0',
      textSecondary: '#888888',
      card: '#1a1a1a',
    },
  },
  {
    id: 'indigo',
    get name() {
      return i18n.t('content:readingThemes.indigo');
    },
    mode: 'dark',
    colors: {
      background: '#0e0c18',
      backgroundSecondary: '#141120',
      text: '#d8d4e8',
      textSecondary: '#7a74a0',
      card: '#0e0c18',
    },
  },
  {
    id: 'dark-amber',
    get name() {
      return i18n.t('content:readingThemes.darkAmber');
    },
    mode: 'dark',
    colors: {
      background: '#150e04',
      backgroundSecondary: '#1e1508',
      text: '#e8d4a8',
      textSecondary: '#8a6e48',
      card: '#150e04',
    },
  },
];
// @ai-end

export const ALL_READING_THEMES = [
  ...LIGHT_READING_THEMES,
  ...DARK_READING_THEMES,
];

export function getReadingThemeById(id: string): ReadingTheme | undefined {
  return ALL_READING_THEMES.find(t => t.id === id);
}
