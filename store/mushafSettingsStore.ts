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

  // Actions
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
}

export const useMushafSettingsStore = create<MushafSettingsState>()(
  persist(
    set => ({
      // Default values
      showTranslation: true,
      showTransliteration: false,
      showTajweed: true,
      arabicFontSize: getActualFontSize(5), // Default: middle of scale
      translationFontSize: getActualFontSize(4),
      transliterationFontSize: getActualFontSize(3),
      arabicFontFamily: 'Uthmani', // Default font
      uthmaniFont: 'v2', // Default to V2
      mushafRenderer: 'dk_v2' as MushafRenderer, // Default to DK V2
      pageLayout: 'book' as MushafPageLayout, // Default to book page view
      lastReadPage: null,

      // Actions
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
    }),
    {
      name: 'mushaf-settings',
      storage: createJSONStorage(() => AsyncStorage),
      version: 3,
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
        return state as unknown as MushafSettingsState;
      },
    },
  ),
);
