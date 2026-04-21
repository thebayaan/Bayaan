import {create} from 'zustand';
import type {AyahTimestamp, AyahTrackingState} from '@/types/timestamps';
import {timestampService} from '@/services/timestamps/TimestampService';
import {RECITERS} from '@/data/reciterData';

interface TimestampState {
  currentAyah: AyahTrackingState | null;
  currentSurahTimestamps: AyahTimestamp[] | null;
  currentTimestampKey: string | null;
  isLocked: boolean;

  // Follow Along registry
  supportedRewayatIds: Set<string>;
  supportedReciterIds: Set<string>;
  registryLoaded: boolean;
  followAlongEnabled: boolean;

  setCurrentAyah: (state: AyahTrackingState) => void;
  setIsLocked: (isLocked: boolean) => void;
  clearCurrentAyah: () => void;
  loadTimestampsForSurah: (
    rewayatId: string,
    surahNumber: number,
  ) => Promise<void>;
  clearCurrentTimestamps: () => void;
  loadFollowAlongRegistry: () => void;
  toggleFollowAlong: () => void;
}

export const useTimestampStore = create<TimestampState>()((set, get) => ({
  currentAyah: null,
  currentSurahTimestamps: null,
  currentTimestampKey: null,
  isLocked: true,

  // Follow Along registry defaults
  supportedRewayatIds: new Set<string>(),
  supportedReciterIds: new Set<string>(),
  registryLoaded: false,
  followAlongEnabled: true,

  setIsLocked: isLocked => set({isLocked}),

  setCurrentAyah: ayahState => set({currentAyah: ayahState}),

  clearCurrentAyah: () => set({currentAyah: null}),

  loadTimestampsForSurah: async (rewayatId, surahNumber) => {
    const key = `${rewayatId}-${surahNumber}`;
    if (get().currentTimestampKey === key) return;

    const timestamps = await timestampService.getTimestampsForSurah(
      rewayatId,
      surahNumber,
    );
    set({
      currentSurahTimestamps: timestamps,
      currentTimestampKey: key,
      currentAyah: null,
    });
  },

  clearCurrentTimestamps: () =>
    set({
      currentSurahTimestamps: null,
      currentTimestampKey: null,
      currentAyah: null,
    }),

  loadFollowAlongRegistry: () => {
    const rewayatIds = new Set<string>();
    const reciterIds = new Set<string>();

    for (const reciter of RECITERS) {
      for (const rewayat of reciter.rewayat) {
        if (rewayat.mp3quran_read_id || rewayat.qdc_reciter_id) {
          rewayatIds.add(rewayat.id);
          reciterIds.add(reciter.id);
        }
      }
    }

    console.log(
      `[FollowAlong] Registry loaded: ${rewayatIds.size} rewayat, ${reciterIds.size} reciters`,
    );

    set({
      supportedRewayatIds: rewayatIds,
      supportedReciterIds: reciterIds,
      registryLoaded: true,
    });
  },

  toggleFollowAlong: () =>
    set(state => ({followAlongEnabled: !state.followAlongEnabled})),
}));
