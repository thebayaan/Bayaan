import {create} from 'zustand';
import {persist, createJSONStorage} from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

export type MushafRenderer = 'dk_v1' | 'dk_v2';
export type MushafPageLayout = 'fullscreen' | 'book';

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

  // Mushaf page layout
  pageLayout: MushafPageLayout;

  // Font sizes (actual values in points)
  arabicFontSize: number;
  translationFontSize: number;
  transliterationFontSize: number;

  // Font family (legacy — kept for backward compatibility)
  arabicFontFamily: 'Uthmani';
  uthmaniFont: 'v1' | 'v2';

  // Mushaf renderer selection
  mushafRenderer: MushafRenderer;

  // Last read page tracking
  lastReadPage: number | null;

  // Recently read surahs (last 10, deduplicated by surahId)
  recentPages: RecentRead[];

  // Session restore
  lastScreenWasMushaf: boolean;

  // Actions
  setLastScreenWasMushaf: (value: boolean) => void;
  toggleTranslation: () => void;
  toggleTransliteration: () => void;
  toggleTajweed: () => void;
  setArabicFontSize: (size: number) => void;
  setTranslationFontSize: (size: number) => void;
  setTransliterationFontSize: (size: number) => void;
  setArabicFontFamily: (font: 'Uthmani') => void;
  setUthmaniFont: (font: 'v1' | 'v2') => void;
  setMushafRenderer: (renderer: MushafRenderer) => void;
  setPageLayout: (layout: MushafPageLayout) => void;
  setLastReadPage: (page: number) => void;
  addRecentRead: (surahId: number, page: number) => void;
}

export const useMushafSettingsStore = create<MushafSettingsState>()(
  persist(
    set => ({
      // Default values
      showTranslation: true,
      showTransliteration: false,
      showTajweed: false,
      arabicFontSize: getActualFontSize(5), // Default: middle of scale
      translationFontSize: getActualFontSize(3),
      transliterationFontSize: getActualFontSize(3),
      arabicFontFamily: 'Uthmani', // Default font
      uthmaniFont: 'v1', // Default to V1
      mushafRenderer: 'dk_v1' as MushafRenderer, // Default to DK V1 (Madani 1405)
      pageLayout: 'book' as MushafPageLayout, // Default to book page view
      lastReadPage: null,
      recentPages: [],
      lastScreenWasMushaf: false,

      // Actions
      setLastScreenWasMushaf: (value: boolean) =>
        set({lastScreenWasMushaf: value}),
      toggleTranslation: () =>
        set(state => ({showTranslation: !state.showTranslation})),
      toggleTransliteration: () =>
        set(state => ({showTransliteration: !state.showTransliteration})),
      toggleTajweed: () => set(state => ({showTajweed: !state.showTajweed})),
      setArabicFontSize: (size: number) => set({arabicFontSize: size}),
      setTranslationFontSize: (size: number) =>
        set({translationFontSize: size}),
      setTransliterationFontSize: (size: number) =>
        set({transliterationFontSize: size}),
      setArabicFontFamily: (font: 'Uthmani') => set({arabicFontFamily: font}),
      setUthmaniFont: (font: 'v1' | 'v2') => set({uthmaniFont: font}),
      setMushafRenderer: (renderer: MushafRenderer) =>
        set({
          mushafRenderer: renderer,
          arabicFontFamily: 'Uthmani',
          uthmaniFont: renderer === 'dk_v1' ? 'v1' : 'v2',
        }),
      setPageLayout: (layout: MushafPageLayout) => set({pageLayout: layout}),
      setLastReadPage: (page: number) => set({lastReadPage: page}),
      addRecentRead: (surahId: number, page: number) =>
        set(state => {
          const filtered = state.recentPages.filter(r => r.surahId !== surahId);
          return {
            recentPages: [
              {surahId, page, timestamp: Date.now()},
              ...filtered,
            ].slice(0, 10),
          };
        }),
    }),
    {
      name: 'mushaf-settings',
      storage: createJSONStorage(() => AsyncStorage),
      version: 4,
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
        return state as unknown as MushafSettingsState;
      },
    },
  ),
);
