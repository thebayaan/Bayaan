import {create} from 'zustand';

interface MushafNavigationState {
  targetPage: number | null;
  targetVerseKey: string | null;
  // The surah a link asked for: the header names it on a page that two
  // surahs share, as at mount. @ai
  targetSurahId: number | null;
  requestId: number;
  // @ai-start
  /**
   * How many mushaf readers (MushafViewer) are mounted. Only a reader
   * carries out a request made with `navigateTo`. With none open (the
   * verse sheet was opened from the audio player), a request did nothing
   * and then replayed the next time a reader opened: ask `isReaderOpen`
   * first and open the reader's route instead.
   */
  readerCount: number;
  /** A reader mounted; returns what to call when it unmounts. */
  readerOpened: () => () => void;
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
  readerCount: 0,
  readerOpened: () => {
    set(s => ({readerCount: s.readerCount + 1}));
    let closed = false;
    return () => {
      if (closed) return;
      closed = true;
      set(s => ({readerCount: Math.max(0, s.readerCount - 1)}));
    };
  },
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

// @ai-start
/** Whether a mushaf reader is mounted to carry out a navigation request. */
export function isReaderOpen(): boolean {
  return useMushafNavigationStore.getState().readerCount > 0;
}
// @ai-end
