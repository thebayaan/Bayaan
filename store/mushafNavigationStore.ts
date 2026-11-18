import {create} from 'zustand';

interface MushafNavigationState {
  targetPage: number | null;
  targetVerseKey: string | null;
  // The surah a link asked for: the header names it on a page that two
  // surahs share, as at mount. @ai
  targetSurahId: number | null;
  requestId: number;
  navigateToVerse: (verseKey: string, page: number) => void;
  // A page with no verse to select (a link to the open reader). @ai
  navigateToPage: (page: number, surahId?: number) => void;
  clear: () => void;
}

export const useMushafNavigationStore = create<MushafNavigationState>(set => ({
  targetPage: null,
  targetVerseKey: null,
  targetSurahId: null, // @ai
  requestId: 0,
  navigateToVerse: (verseKey, page) =>
    set(s => ({
      targetPage: page,
      targetVerseKey: verseKey,
      targetSurahId: null, // @ai
      requestId: s.requestId + 1,
    })),
  // @ai-start
  navigateToPage: (page, surahId) =>
    set(s => ({
      targetPage: page,
      targetVerseKey: null,
      targetSurahId: surahId ?? null,
      requestId: s.requestId + 1,
    })),
  // @ai-end
  clear: () =>
    set({targetPage: null, targetVerseKey: null, targetSurahId: null}), // @ai
}));
