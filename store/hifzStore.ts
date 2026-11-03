import {create} from 'zustand';
import {persist} from 'zustand/middleware';
import {persistStorage} from '@/utils/storage';
import type {HifzProfile} from '@/services/hifz/plan';

const STORAGE_KEY = 'hifz-store';

/** How the reader did on one look-alike pair in the trainer. */
export interface PairResult {
  lastAt: number;
  clean: number;
  missed: number;
  /** The last drill went into the look-alike. */
  lastMissed: boolean;
}

export const DEFAULT_HIFZ_PROFILE: HifzProfile = {
  memorizedSurahs: [],
  sabaq: null,
  newAyatPerDay: 5,
  manzilPagesPerDay: 4,
  dailyGoalAyat: 20,
};

export interface HifzState extends HifzProfile {
  pairResults: Record<string, PairResult>;
  setMemorizedSurahs: (surahs: number[]) => void;
  toggleSurah: (surah: number) => void;
  setSabaq: (sabaq: {surah: number; ayah: number} | null) => void;
  setAmounts: (
    patch: Partial<
      Pick<HifzProfile, 'newAyatPerDay' | 'manzilPagesPerDay' | 'dailyGoalAyat'>
    >,
  ) => void;
  recordPair: (key: string, clean: boolean, at: number) => void;
}

/** The reader's hifz plan and trainer results; on the phone only. */
export const useHifzStore = create<HifzState>()(
  persist(
    set => ({
      ...DEFAULT_HIFZ_PROFILE,
      pairResults: {},
      setMemorizedSurahs: surahs =>
        set({memorizedSurahs: [...new Set(surahs)].sort((a, b) => a - b)}),
      toggleSurah: surah =>
        set(state => ({
          memorizedSurahs: state.memorizedSurahs.includes(surah)
            ? state.memorizedSurahs.filter(s => s !== surah)
            : [...state.memorizedSurahs, surah].sort((a, b) => a - b),
        })),
      setSabaq: sabaq => set({sabaq}),
      setAmounts: patch => set(patch),
      recordPair: (key, clean, at) =>
        set(state => {
          const previous = state.pairResults[key] ?? {
            lastAt: at,
            clean: 0,
            missed: 0,
            lastMissed: false,
          };
          return {
            pairResults: {
              ...state.pairResults,
              [key]: {
                lastAt: at,
                clean: previous.clean + (clean ? 1 : 0),
                missed: previous.missed + (clean ? 0 : 1),
                lastMissed: !clean,
              },
            },
          };
        }),
    }),
    {
      name: STORAGE_KEY,
      storage: persistStorage(),
      partialize: state => ({
        memorizedSurahs: state.memorizedSurahs,
        sabaq: state.sabaq,
        newAyatPerDay: state.newAyatPerDay,
        manzilPagesPerDay: state.manzilPagesPerDay,
        dailyGoalAyat: state.dailyGoalAyat,
        pairResults: state.pairResults,
      }),
    },
  ),
);
