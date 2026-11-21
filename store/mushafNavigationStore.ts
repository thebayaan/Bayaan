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
   * carries out a request made with `navigateToVerse`. With none open (the
   * verse sheet was opened from the audio player), a request did nothing
   * and then replayed the next time a reader opened: ask `isReaderOpen`
   * first and open the reader's route instead.
   */
  readerCount: number;
  /** A reader mounted; returns what to call when it unmounts. */
  readerOpened: () => () => void;
  // @ai-end
  navigateToVerse: (verseKey: string, page: number) => void;
  // A link to the open reader: its page, and its verse to select, if any. @ai
  navigateToPage: (page: number, surahId?: number, verseKey?: string) => void;
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
  // @ai-end
  navigateToVerse: (verseKey, page) =>
    set(s => ({
      targetPage: page,
      targetVerseKey: verseKey,
      targetSurahId: null, // @ai
      requestId: s.requestId + 1,
    })),
  // @ai-start
  navigateToPage: (page, surahId, verseKey) =>
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
