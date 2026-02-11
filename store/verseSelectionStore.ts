import {create} from 'zustand';

interface VerseSelectionState {
  selectedVerseKey: string | null;
  selectedSurahNumber: number | null;
  selectedAyahNumber: number | null;
  selectVerse: (
    verseKey: string,
    surahNumber: number,
    ayahNumber: number,
  ) => void;
  clearSelection: () => void;
}

export const useVerseSelectionStore = create<VerseSelectionState>()(set => ({
  selectedVerseKey: null,
  selectedSurahNumber: null,
  selectedAyahNumber: null,

  selectVerse: (verseKey, surahNumber, ayahNumber) =>
    set({
      selectedVerseKey: verseKey,
      selectedSurahNumber: surahNumber,
      selectedAyahNumber: ayahNumber,
    }),

  clearSelection: () =>
    set({
      selectedVerseKey: null,
      selectedSurahNumber: null,
      selectedAyahNumber: null,
    }),
}));
