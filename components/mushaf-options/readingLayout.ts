// @ai-generated
import {
  DARK_READING_THEMES,
  LIGHT_READING_THEMES,
  type ReadingTheme,
} from '@/constants/readingThemes';
import type {
  MushafPageLayout,
  MushafScrollDirection,
  MushafViewMode,
  RewayahId,
} from '@/store/mushafSettingsStore';
import type {ThemeMode} from '@/utils/themeUtils';

/**
 * The five reading layouts the Layout tiles offer. Each is a pair of store
 * values: the Mushaf view has Single page, Book and Scroll, the List view
 * has Pages and Continuous.
 */
export type ReadingLayout =
  | 'single'
  | 'book'
  | 'scroll'
  | 'pages'
  | 'continuous';

export const MUSHAF_LAYOUTS: readonly ReadingLayout[] = [
  'single',
  'book',
  'scroll',
];
export const LIST_LAYOUTS: readonly ReadingLayout[] = ['pages', 'continuous'];

/** The layout the store's view, direction and page design describe. */
export function readingLayoutOf(
  viewMode: MushafViewMode,
  scrollDirection: MushafScrollDirection,
  pageLayout: MushafPageLayout,
): ReadingLayout {
  if (viewMode === 'list') {
    return scrollDirection === 'vertical' ? 'continuous' : 'pages';
  }
  if (scrollDirection === 'vertical') return 'scroll';
  return pageLayout === 'book' ? 'book' : 'single';
}

export interface LayoutSettings {
  scrollDirection: MushafScrollDirection;
  /** Only the Mushaf view's swipe layouts set the page design. */
  pageLayout?: MushafPageLayout;
}

/** The store values a layout tile writes. */
export function layoutSettingsFor(layout: ReadingLayout): LayoutSettings {
  switch (layout) {
    case 'single':
      return {scrollDirection: 'horizontal', pageLayout: 'fullscreen'};
    case 'book':
      return {scrollDirection: 'horizontal', pageLayout: 'book'};
    case 'pages':
      return {scrollDirection: 'horizontal'};
    case 'scroll':
    case 'continuous':
      return {scrollDirection: 'vertical'};
  }
}

/** Whether a layout turns pages sideways (the page behind slides in sideways). */
export function isSwipeLayout(layout: ReadingLayout): boolean {
  return layout === 'single' || layout === 'book' || layout === 'pages';
}

/** Light or dark: what `system` resolves to on this device. */
export type EffectiveMode = 'light' | 'dark';

export function effectiveModeOf(
  mode: ThemeMode,
  systemScheme: string | null | undefined,
): EffectiveMode {
  if (mode !== 'system') return mode;
  return systemScheme === 'dark' ? 'dark' : 'light';
}

export function readingThemesFor(mode: EffectiveMode): ReadingTheme[] {
  return mode === 'dark' ? DARK_READING_THEMES : LIGHT_READING_THEMES;
}

/** Light, Dark, Auto, then Light again: the order the mode chip cycles. */
export function nextThemeMode(mode: ThemeMode): ThemeMode {
  if (mode === 'light') return 'dark';
  if (mode === 'dark') return 'system';
  return 'light';
}

/**
 * The reading theme to pick when the light or dark mode flips: the one at
 * the same position in the other mode's list (as the reading-theme screen
 * pairs them). Null when the effective mode stays the same.
 */
export function pairedThemeId(
  fromMode: EffectiveMode,
  toMode: EffectiveMode,
  lightThemeId: string,
  darkThemeId: string,
): string | null {
  if (fromMode === toMode) return null;
  const from = readingThemesFor(fromMode);
  const to = readingThemesFor(toMode);
  const currentId = fromMode === 'dark' ? darkThemeId : lightThemeId;
  const index = from.findIndex(option => option.id === currentId);
  return to[Math.min(Math.max(index, 0), to.length - 1)].id;
}

/** The folded cards. One is open at a time. */
export type OptionsCard = 'text' | 'verse' | 'highlights' | 'words';

/** Taps a card's header: opens it and closes the others, or closes it. */
export function toggleCard(
  open: OptionsCard | null,
  card: OptionsCard,
): OptionsCard | null {
  return open === card ? null : card;
}

/**
 * The rewayat with bundled text, grouped by the qari they were transmitted
 * from, in the order the Rewayah screen lists them.
 */
export const REWAYAH_GROUPS: readonly {
  qari: 'asim' | 'nafi' | 'ibnKathir' | 'abuAmr';
  rewayat: readonly RewayahId[];
}[] = [
  {qari: 'asim', rewayat: ['hafs', 'shubah']},
  {qari: 'nafi', rewayat: ['warsh', 'qalun']},
  {qari: 'ibnKathir', rewayat: ['al-bazzi', 'qunbul']},
  {qari: 'abuAmr', rewayat: ['al-duri-abi-amr', 'al-susi']},
];

/**
 * The tajweed legend: one row per color in constants/tajweedColors.ts, by
 * the rule key whose color it shows.
 */
export const TAJWEED_LEGEND: readonly {
  key:
    | 'necessary'
    | 'obligatory'
    | 'permissible'
    | 'normal'
    | 'ghunnah'
    | 'qalqalah'
    | 'tafkhim'
    | 'silent';
  rule: string;
}[] = [
  {key: 'necessary', rule: 'madda_necessary'},
  {key: 'obligatory', rule: 'madda_obligatory_mottasel'},
  {key: 'permissible', rule: 'madda_permissible'},
  {key: 'normal', rule: 'madda_normal'},
  {key: 'ghunnah', rule: 'ghunnah'},
  {key: 'qalqalah', rule: 'qalaqah'},
  {key: 'tafkhim', rule: 'tafkhim'},
  {key: 'silent', rule: 'slnt'},
];
