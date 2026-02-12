import {create} from 'zustand';

interface MushafVerseSelectionState {
  selectedVerseKey: string | null;
  selectedVerseKeys: string[];
  selectedPageNumber: number | null;
  selectVerse: (verseKey: string, pageNumber: number) => void;
  selectVerseRange: (verseKeys: string[], pageNumber: number) => void;
  clearSelection: () => void;
}

export const useMushafVerseSelectionStore = create<MushafVerseSelectionState>(
  set => ({
    selectedVerseKey: null,
    selectedVerseKeys: [],
    selectedPageNumber: null,
    selectVerse: (verseKey, pageNumber) =>
      set({
        selectedVerseKey: verseKey,
        selectedVerseKeys: [verseKey],
        selectedPageNumber: pageNumber,
      }),
    selectVerseRange: (verseKeys, pageNumber) =>
      set({
        selectedVerseKey: verseKeys[0] ?? null,
        selectedVerseKeys: verseKeys,
        selectedPageNumber: pageNumber,
      }),
    clearSelection: () =>
      set({
        selectedVerseKey: null,
        selectedVerseKeys: [],
        selectedPageNumber: null,
      }),
  }),
);
