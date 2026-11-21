import {create} from 'zustand';
import {persist} from 'zustand/middleware';
import {persistStorage} from '@/utils/storage'; // @ai
// @ai-start
import {
  defaultShowEnglishReadingAids,
  defaultShowTransliteration,
} from '@/i18n/language';
// @ai-end
import {
  perLanguageReadingAids,
  type ReadingAidsByLanguage,
  type WithPersistedReadingAids,
} from '@/store/readingAidsByLanguage';

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

/**
 * The English reading aids: the adhkar's translation and transliteration.
 * Their fields hold this session's UI language's values; each language
 * keeps its own (store/readingAidsByLanguage).
 */
const ADHKAR_READING_AIDS = ['showTranslation', 'showTransliteration'] as const;
type AdhkarReadingAid = (typeof ADHKAR_READING_AIDS)[number];
const readingAids = perLanguageReadingAids(ADHKAR_READING_AIDS);

interface AdhkarSettingsState {
  // Visibility settings (reading aids: ADHKAR_READING_AIDS)
  showTranslation: boolean;
  showTransliteration: boolean;
  /** The reading aids the other UI languages saved. */
  readingAidsInOtherLanguages: ReadingAidsByLanguage<AdhkarReadingAid>;

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

/** The saved settings: the reading aids under each UI language's code. */
type PersistedAdhkarSettings = WithPersistedReadingAids<
  AdhkarSettingsState,
  AdhkarReadingAid
>;

export const useAdhkarSettingsStore = create<AdhkarSettingsState>()(
  persist(
    set => ({
      // Default values
      showTranslation: defaultShowEnglishReadingAids, // @ai
      showTransliteration: defaultShowTransliteration, // @ai
      readingAidsInOtherLanguages: {},
      arabicFontSize: getActualFontSize(5), // Default: larger Arabic text
      translationFontSize: getActualFontSize(3),
      transliterationFontSize: getActualFontSize(2),

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
      storage: persistStorage(), // @ai
      version: 1,
      partialize: (state): PersistedAdhkarSettings =>
        readingAids.toPersisted(state),
      // The reading aids load from what this session's UI language saved.
      merge: (persisted, current) => readingAids.merge(persisted, current),
      migrate: (persistedState: unknown, version: number) => {
        const state: Record<string, unknown> =
          typeof persistedState === 'object' && persistedState !== null
            ? (persistedState as Record<string, unknown>)
            : {};
        if (version < 1) {
          // One value of each served every UI language. Each language
          // keeps its own now: the saved values become English's, and in
          // Arabic both start off.
          readingAids.moveSingleValuesToEnglish(state);
        }
        return state as unknown as PersistedAdhkarSettings;
      },
    },
  ),
);
