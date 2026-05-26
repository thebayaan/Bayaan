import {create} from 'zustand';
import {persist, createJSONStorage} from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {getReadingThemeById} from '@/constants/readingThemes';
import {
  migratePersistedId,
  type RewayahId,
} from '@/services/rewayah/RewayahIdentity';

// Re-exported for backward compat with existing imports across the app.
// RewayahIdentity is the canonical source; do not redefine the union here.
export type {RewayahId};

// Constants for font sizing
export const DISPLAY_MIN = 1;
export const DISPLAY_MAX = 10;
export const ACTUAL_MIN_FONT_SIZE = 10;
export const ACTUAL_FONT_STEP = 4;

// Calculate actual font size from display value (1-10)
export const getActualFontSize = (displayValue: number): number => {
  return ACTUAL_MIN_FONT_SIZE + (displayValue - 1) * ACTUAL_FONT_STEP;
};

// Calculate display value (1-10) from actual font size
export const getDisplayValue = (actualFontSize: number): number => {
  return Math.round(
    1 + (actualFontSize - ACTUAL_MIN_FONT_SIZE) / ACTUAL_FONT_STEP,
  );
};

export type MushafRenderer = 'dk_v1' | 'dk_v2' | 'dk_indopak' | 'qcf_v2';
export type MushafPageLayout = 'fullscreen' | 'book';
export type MushafViewMode = 'mushaf' | 'list';
export type MushafScrollDirection = 'horizontal' | 'vertical';
export type MushafArabicTextWeight = 'normal' | 'medium' | 'bold';
export type MushafAllahNameHighlightColor =
  | 'gold'
  | 'emerald'
  | 'blue'
  | 'rose';
export interface RecentRead {
  surahId: number;
  page: number;
  timestamp: number;
}

interface MushafSettingsState {
  // Display settings
  showTranslation: boolean;
  showTransliteration: boolean;
  showTajweed: boolean;
  showThemes: boolean;

  // Word-by-word settings
  showWBW: boolean;
  wbwShowTranslation: boolean;
  wbwShowTransliteration: boolean;

  // Mushaf page layout
  pageLayout: MushafPageLayout;

  // Font sizes (actual values in points)
  arabicFontSize: number;
  translationFontSize: number;
  transliterationFontSize: number;
  arabicTextWeight: MushafArabicTextWeight;
  showAllahNameHighlight: boolean;
  allahNameHighlightColor: MushafAllahNameHighlightColor;

  // Font family (legacy — kept for backward compatibility)
  arabicFontFamily: 'Uthmani';
  uthmaniFont: 'v1' | 'v2';

  // Mushaf renderer selection
  mushafRenderer: MushafRenderer;

  // View mode (mushaf pages vs list view)
  viewMode: MushafViewMode;

  // Scroll direction (horizontal paging vs vertical continuous scroll)
  scrollDirection: MushafScrollDirection;

  // Recently read positions (last 10, chain-based — not deduplicated by surahId)
  recentPages: RecentRead[];

  // Active translation (bundled or downloaded remote)
  selectedTranslationId: string;

  // Reading theme (mushaf-only, does not affect global app theme)
  lightThemeId: string;
  darkThemeId: string;

  // Rewayah (qiraat transmission) selection
  rewayah: RewayahId;
  showRewayahDiffs: boolean;

  // Actions
  toggleTranslation: () => void;
  toggleTransliteration: () => void;
  toggleTajweed: () => void;
  toggleThemes: () => void;
  toggleWBW: () => void;
  toggleWBWTranslation: () => void;
  toggleWBWTransliteration: () => void;
  toggleAllahNameHighlight: () => void;
  setArabicFontSize: (size: number) => void;
  setTranslationFontSize: (size: number) => void;
  setTransliterationFontSize: (size: number) => void;
  setArabicTextWeight: (weight: MushafArabicTextWeight) => void;
  setAllahNameHighlightColor: (color: MushafAllahNameHighlightColor) => void;
  setArabicFontFamily: (font: 'Uthmani') => void;
  setUthmaniFont: (font: 'v1' | 'v2') => void;
  setMushafRenderer: (renderer: MushafRenderer) => void;
  setPageLayout: (layout: MushafPageLayout) => void;
  setViewMode: (mode: MushafViewMode) => void;
  setScrollDirection: (direction: MushafScrollDirection) => void;
  updateActiveChain: (surahId: number, page: number) => void;
  startNewChain: (surahId: number, page: number) => void;
  resumeChain: (index: number) => void;
  clearRecentPages: () => void;
  setSelectedTranslationId: (id: string) => void;
  setReadingTheme: (themeId: string) => void;
  setRewayah: (rewayah: RewayahId) => void;
  toggleRewayahDiffs: () => void;
}

export const useMushafSettingsStore = create<MushafSettingsState>()(
  persist(
    set => ({
      // Default values
      showTranslation: true,
      showTransliteration: false,
      showTajweed: false,
      showThemes: false,
      showWBW: false,
      wbwShowTranslation: true,
      wbwShowTransliteration: false,
      arabicFontSize: getActualFontSize(5), // Default: middle of scale
      translationFontSize: getActualFontSize(3),
      transliterationFontSize: getActualFontSize(3),
      arabicTextWeight: 'normal' as MushafArabicTextWeight,
      showAllahNameHighlight: false,
      allahNameHighlightColor: 'gold' as MushafAllahNameHighlightColor,
      arabicFontFamily: 'Uthmani', // Default font
      uthmaniFont: 'v1', // Default to V1
      mushafRenderer: 'dk_v1' as MushafRenderer, // Default to DK V1 (Madani 1405)
      viewMode: 'mushaf' as MushafViewMode,
      scrollDirection: 'horizontal' as MushafScrollDirection,
      pageLayout: 'book' as MushafPageLayout, // Default to book page view
      recentPages: [],
      selectedTranslationId: 'saheeh',
      lightThemeId: 'default',
      darkThemeId: 'dark-default',
      rewayah: 'hafs' as RewayahId,
      showRewayahDiffs: true,

      // Actions
      toggleTranslation: () =>
        set(state => ({showTranslation: !state.showTranslation})),
      toggleTransliteration: () =>
        set(state => ({showTransliteration: !state.showTransliteration})),
      toggleTajweed: () =>
        set(state =>
          state.mushafRenderer === 'qcf_v2'
            ? state
            : {showTajweed: !state.showTajweed},
        ),
      toggleThemes: () => set(state => ({showThemes: !state.showThemes})),
      toggleWBW: () => set(state => ({showWBW: !state.showWBW})),
      toggleWBWTranslation: () =>
        set(state => ({wbwShowTranslation: !state.wbwShowTranslation})),
      toggleWBWTransliteration: () =>
        set(state => ({wbwShowTransliteration: !state.wbwShowTransliteration})),
      toggleAllahNameHighlight: () =>
        set(state => ({showAllahNameHighlight: !state.showAllahNameHighlight})),
      setArabicFontSize: (size: number) => set({arabicFontSize: size}),
      setTranslationFontSize: (size: number) =>
        set({translationFontSize: size}),
      setTransliterationFontSize: (size: number) =>
        set({transliterationFontSize: size}),
      setArabicTextWeight: (weight: MushafArabicTextWeight) =>
        set({arabicTextWeight: weight}),
      setAllahNameHighlightColor: (color: MushafAllahNameHighlightColor) =>
        set({allahNameHighlightColor: color}),
      setArabicFontFamily: (font: 'Uthmani') => set({arabicFontFamily: font}),
      setUthmaniFont: (font: 'v1' | 'v2') => set({uthmaniFont: font}),
      setMushafRenderer: (renderer: MushafRenderer) =>
        set(state => ({
          mushafRenderer: renderer,
          arabicFontFamily: 'Uthmani',
          showTajweed:
            renderer === 'qcf_v2' ? false : state.showTajweed,
          rewayah: renderer === 'qcf_v2' ? 'hafs' : state.rewayah,
          showRewayahDiffs:
            renderer === 'qcf_v2' ? false : state.showRewayahDiffs,
          uthmaniFont:
            renderer === 'dk_v1'
              ? 'v1'
              : renderer === 'dk_indopak'
                ? 'v2'
                : 'v2',
        })),
      setPageLayout: (layout: MushafPageLayout) => set({pageLayout: layout}),
      setViewMode: (mode: MushafViewMode) => set({viewMode: mode}),
      setScrollDirection: (direction: MushafScrollDirection) =>
        set({scrollDirection: direction}),
      updateActiveChain: (surahId: number, page: number) =>
        set(state => {
          const updated = [...state.recentPages];
          if (updated.length === 0) {
            updated.push({surahId, page, timestamp: Date.now()});
          } else {
            updated[0] = {surahId, page, timestamp: Date.now()};
          }
          return {recentPages: updated};
        }),
      startNewChain: (surahId: number, page: number) =>
        set(state => ({
          recentPages: [
            {surahId, page, timestamp: Date.now()},
            ...state.recentPages,
          ].slice(0, 10),
        })),
      resumeChain: (index: number) =>
        set(state => {
          if (index <= 0 || index >= state.recentPages.length) return state;
          const updated = [...state.recentPages];
          const [entry] = updated.splice(index, 1);
          updated.unshift({...entry, timestamp: Date.now()});
          return {recentPages: updated};
        }),
      clearRecentPages: () => set({recentPages: []}),
      setSelectedTranslationId: (id: string) =>
        set({selectedTranslationId: id}),
      setReadingTheme: (themeId: string) =>
        set(state => {
          const rt = getReadingThemeById(themeId);
          if (!rt) return state;
          return rt.mode === 'light'
            ? {lightThemeId: themeId}
            : {darkThemeId: themeId};
        }),
      setRewayah: (rewayah: RewayahId) =>
        set(state =>
          state.mushafRenderer === 'qcf_v2' ? state : {rewayah},
        ),
      toggleRewayahDiffs: () =>
        set(state =>
          state.mushafRenderer === 'qcf_v2'
            ? state
            : {showRewayahDiffs: !state.showRewayahDiffs},
        ),
    }),
    {
      name: 'mushaf-settings',
      storage: createJSONStorage(() => AsyncStorage),
      version: 16,
      migrate: (persistedState: unknown, version: number) => {
        const state = persistedState as Record<string, unknown>;
        if (version === 0) {
          // Migrate 'QPC' -> 'Uthmani'
          if (state.arabicFontFamily === 'QPC') {
            state.arabicFontFamily = 'Uthmani';
          }
        }
        if (version < 2) {
          state.uthmaniFont = 'v2';
        }
        if (version < 3) {
          // Derive mushafRenderer from legacy fields
          if (state.uthmaniFont === 'v1') {
            state.mushafRenderer = 'dk_v1';
          } else {
            state.mushafRenderer = 'dk_v2';
          }
          // Migrate any old Indopak users to Uthmani
          if (state.arabicFontFamily === 'Indopak') {
            state.arabicFontFamily = 'Uthmani';
          }
        }
        if (version < 4) {
          state.recentPages = [];
        }
        if (version < 5) {
          // lastScreenWasMushaf & lastReadPage moved to MMKV — drop stale keys
          delete state.lastScreenWasMushaf;
          delete state.lastReadPage;
        }
        if (version < 6) {
          state.selectedTranslationId = 'saheeh';
        }
        if (version < 7) {
          state.viewMode = 'mushaf';
        }
        if (version < 8) {
          state.showWBW = false;
          state.wbwShowTranslation = true;
          state.wbwShowTransliteration = false;
        }
        if (version < 9) {
          // Migrate viewMode: 'reading' → 'list', add scrollDirection
          if (state.viewMode === 'reading') {
            state.viewMode = 'list';
          }
          state.scrollDirection = 'horizontal';
        }
        if (version < 10) {
          state.showThemes = false;
        }
        if (version < 11) {
          state.lightThemeId = 'default';
          state.darkThemeId = 'dark-default';
        }
        if (version < 12) {
          state.rewayah = 'hafs';
          state.showRewayahDiffs = true;
        }
        if (
          version < 13 ||
          !['normal', 'medium', 'bold'].includes(
            state.arabicTextWeight as string,
          )
        ) {
          state.arabicTextWeight = 'normal';
        }
        if (version < 14) {
          state.showAllahNameHighlight = false;
          state.allahNameHighlightColor = 'gold';
        }
        if (version < 15) {
          state.rewayah = migratePersistedId(
            typeof state.rewayah === 'string' ? state.rewayah : 'hafs',
          );
        }
        if (version < 16 && state.mushafRenderer === 'qcf_v2') {
          state.showTajweed = false;
          state.rewayah = 'hafs';
          state.showRewayahDiffs = false;
        }
        return state as unknown as MushafSettingsState;
      },
    },
  ),
);
