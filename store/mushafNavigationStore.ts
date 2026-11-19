import {create} from 'zustand';

interface MushafNavigationState {
  targetPage: number | null;
  targetVerseKey: string | null;
  // The surah a link asked for: the header names it on a page that two
  // surahs share, as at mount. @ai
  targetSurahId: number | null;
  requestId: number;
  // @ai-start
  // Turn the open reader to `page`, select `verseKey` there, if any, and name
  // `surahId` in the header, if any (Similar Verses, a recitation mark, a
  // link to the open reader).
  navigateTo: (request: {
    page: number;
    verseKey?: string;
    surahId?: number;
  }) => void;
  // @ai-end
  clear: () => void;
}

export const useMushafNavigationStore = create<MushafNavigationState>(set => ({
  targetPage: null,
  targetVerseKey: null,
  targetSurahId: null, // @ai
  requestId: 0,
  // @ai-start
  navigateTo: ({page, verseKey, surahId}) =>
    set(s => ({
      targetPage: page,
      targetVerseKey: verseKey ?? null,
      targetSurahId: surahId ?? null,
      requestId: s.requestId + 1,
    })),
  // @ai-end
  clear: () =>
    set({targetPage: null, targetVerseKey: null, targetSurahId: null}), // @ai
}));
