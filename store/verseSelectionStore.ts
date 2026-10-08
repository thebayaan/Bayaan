import {create} from 'zustand';
import type {RewayahId} from '@/services/rewayah/RewayahIdentity'; // @ai

interface VerseSelectionState {
  selectedVerseKey: string | null;
  selectedSurahNumber: number | null;
  selectedAyahNumber: number | null;
  // @ai-start
  /**
   * Numbering of the selected key (decision 3): a verse row of a rewayah
   * selects its own verse ('1:6' of 'warsh'); a Hafs verse row selects in
   * 'hafs'. A key means nothing without its numbering, so a row matches the
   * selection only in its own rewayah. Null when nothing is selected.
   */
  selectedRewayah: RewayahId | null;
  // @ai-end
  selectVerse: (
    verseKey: string,
    surahNumber: number,
    ayahNumber: number,
    rewayah?: RewayahId, // @ai — numbering of the three above; default 'hafs'
  ) => void;
  clearSelection: () => void;
}

export const useVerseSelectionStore = create<VerseSelectionState>()(set => ({
  selectedVerseKey: null,
  selectedSurahNumber: null,
  selectedAyahNumber: null,
  selectedRewayah: null, // @ai

  selectVerse: (verseKey, surahNumber, ayahNumber, rewayah = 'hafs') =>
    set({
      selectedVerseKey: verseKey,
      selectedSurahNumber: surahNumber,
      selectedAyahNumber: ayahNumber,
      selectedRewayah: rewayah, // @ai
    }),

  clearSelection: () =>
    set({
      selectedVerseKey: null,
      selectedSurahNumber: null,
      selectedAyahNumber: null,
      selectedRewayah: null, // @ai
    }),
}));
