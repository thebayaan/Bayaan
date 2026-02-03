import {create} from 'zustand';
import {persist, createJSONStorage} from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Constants for font sizing (same as mushafSettingsStore for consistency)
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

interface AdhkarSettingsState {
  // Visibility settings
  showTranslation: boolean;
  showTransliteration: boolean;

  // Font sizes (actual values in points)
  arabicFontSize: number;
  translationFontSize: number;
  transliterationFontSize: number;

  // Actions
  toggleTranslation: () => void;
  toggleTransliteration: () => void;
  setArabicFontSize: (size: number) => void;
  setTranslationFontSize: (size: number) => void;
  setTransliterationFontSize: (size: number) => void;
}

export const useAdhkarSettingsStore = create<AdhkarSettingsState>()(
  persist(
    set => ({
      // Default values
      showTranslation: true,
      showTransliteration: true,
      arabicFontSize: getActualFontSize(7), // Default: larger Arabic text
      translationFontSize: getActualFontSize(4),
      transliterationFontSize: getActualFontSize(4),

      // Actions
      toggleTranslation: () =>
        set(state => ({showTranslation: !state.showTranslation})),
      toggleTransliteration: () =>
        set(state => ({showTransliteration: !state.showTransliteration})),
      setArabicFontSize: (size: number) => set({arabicFontSize: size}),
      setTranslationFontSize: (size: number) =>
        set({translationFontSize: size}),
      setTransliterationFontSize: (size: number) =>
        set({transliterationFontSize: size}),
    }),
    {
      name: 'adhkar-settings',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
