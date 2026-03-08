/**
 * Shared color themes for cycling hero cards.
 * All heroes share the same theme per session via SESSION_SEED.
 */

/** Module-level seed — set once on first import, stable for the session */
export const SESSION_SEED = Date.now();

export interface HeroColorTheme {
  key: string;
  /** Dark mode background gradient [start, end] */
  bg: [string, string];
  /** Light mode background gradient [start, end] */
  bgLight: [string, string];
  /** Primary accent */
  accent: string;
  /** Lighter accent for prominent elements (dark mode text) */
  accentLight: string;
  /** Dimmer accent for secondary elements */
  accentDim: string;
  /** Darker accent for light mode text */
  accentDark: string;
}

export const HERO_THEMES: HeroColorTheme[] = [
  {
    key: 'purple',
    bg: ['#1a1520', '#2a1f35'],
    bgLight: ['#f5f0ff', '#ede5ff'],
    accent: '#a78bfa',
    accentLight: '#c4b5fd',
    accentDim: '#8b5cf6',
    accentDark: '#6d28d9',
  },
  {
    key: 'gold',
    bg: ['#1a1510', '#2a2018'],
    bgLight: ['#fdf8f0', '#faf0e0'],
    accent: '#d4a574',
    accentLight: '#e8c49a',
    accentDim: '#c09060',
    accentDark: '#92400e',
  },
  {
    key: 'teal',
    bg: ['#0a1a1a', '#0f2b2b'],
    bgLight: ['#f0fdfa', '#e6faf5'],
    accent: '#5eead4',
    accentLight: '#99f6e4',
    accentDim: '#2dd4bf',
    accentDark: '#0f766e',
  },
  {
    key: 'rose',
    bg: ['#1c1015', '#2e1a25'],
    bgLight: ['#fff1f2', '#ffe4e6'],
    accent: '#fda4af',
    accentLight: '#fecdd3',
    accentDim: '#fb7185',
    accentDark: '#be123c',
  },
  {
    key: 'indigo',
    bg: ['#0f172a', '#1e293b'],
    bgLight: ['#eef2ff', '#e0e7ff'],
    accent: '#a5b4fc',
    accentLight: '#c7d2fe',
    accentDim: '#818cf8',
    accentDark: '#4338ca',
  },
  {
    key: 'emerald',
    bg: ['#0a1f15', '#14532d'],
    bgLight: ['#f0fdf4', '#dcfce7'],
    accent: '#86efac',
    accentLight: '#bbf7d0',
    accentDim: '#4ade80',
    accentDark: '#15803d',
  },
];

/** Pick a theme deterministically from the session seed */
export function pickHeroTheme(seed: number = SESSION_SEED): HeroColorTheme {
  const index = Math.abs(seed) % HERO_THEMES.length;
  return HERO_THEMES[index];
}
