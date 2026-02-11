import {create} from 'zustand';

interface MushafVerseSelectionState {
  selectedVerseKey: string | null;
  selectedPageNumber: number | null;
  selectVerse: (verseKey: string, pageNumber: number) => void;
  clearSelection: () => void;
}

export const useMushafVerseSelectionStore =
  create<MushafVerseSelectionState>(set => ({
    selectedVerseKey: null,
    selectedPageNumber: null,
    selectVerse: (verseKey, pageNumber) =>
      set({selectedVerseKey: verseKey, selectedPageNumber: pageNumber}),
    clearSelection: () =>
      set({selectedVerseKey: null, selectedPageNumber: null}),
  }));
