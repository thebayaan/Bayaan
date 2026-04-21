import {create} from 'zustand';

interface MushafNavigationState {
  targetPage: number | null;
  targetVerseKey: string | null;
  requestId: number;
  navigateToVerse: (verseKey: string, page: number) => void;
  clear: () => void;
}

export const useMushafNavigationStore = create<MushafNavigationState>(set => ({
  targetPage: null,
  targetVerseKey: null,
  requestId: 0,
  navigateToVerse: (verseKey, page) =>
    set(s => ({
      targetPage: page,
      targetVerseKey: verseKey,
      requestId: s.requestId + 1,
    })),
  clear: () => set({targetPage: null, targetVerseKey: null}),
}));
