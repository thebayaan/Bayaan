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

interface MushafSettingsState {
  // Display settings
  showTranslation: boolean;
  showTransliteration: boolean;
  showTajweed: boolean;

  // Font sizes (actual values in points)
  arabicFontSize: number;
  translationFontSize: number;
  transliterationFontSize: number;

  // Font family
  arabicFontFamily: 'Uthmani' | 'Indopak';

  // Actions
  toggleTranslation: () => void;
  toggleTransliteration: () => void;
  toggleTajweed: () => void;
  setArabicFontSize: (size: number) => void;
  setTranslationFontSize: (size: number) => void;
  setTransliterationFontSize: (size: number) => void;
  setArabicFontFamily: (font: 'Uthmani' | 'Indopak') => void;
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
      setArabicFontFamily: (font: 'Uthmani' | 'Indopak') =>
        set({arabicFontFamily: font}),
    }),
    {
      name: 'mushaf-settings',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      migrate: (persistedState: unknown, version: number) => {
        const state = persistedState as Record<string, unknown>;
        if (version === 0) {
          // Migrate 'QPC' -> 'Uthmani'
          if (state.arabicFontFamily === 'QPC') {
            state.arabicFontFamily = 'Uthmani';
          }
        }
        return state as unknown as MushafSettingsState;
      },
    },
  ),
);
