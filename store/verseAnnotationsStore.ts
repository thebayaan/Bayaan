import {create} from 'zustand';
import {verseAnnotationService} from '@/services/verse-annotations/VerseAnnotationService';
import type {HighlightColor} from '@/types/verse-annotations';

interface VerseAnnotationsState {
  loadedSurah: number | null;
  bookmarkedVerseKeys: Set<string>;
  notedVerseKeys: Set<string>;
  highlights: Record<string, HighlightColor>;
  loading: boolean;

  loadAnnotationsForSurah: (surahNumber: number) => Promise<void>;

  // Optimistic mutations
  addBookmark: (verseKey: string) => void;
  removeBookmark: (verseKey: string) => void;
  addNote: (verseKey: string) => void;
  removeNote: (verseKey: string) => void;
  setHighlight: (verseKey: string, color: HighlightColor) => void;
  removeHighlight: (verseKey: string) => void;

  // Query helpers
  isBookmarked: (verseKey: string) => boolean;
  hasNote: (verseKey: string) => boolean;
  getHighlightColor: (verseKey: string) => HighlightColor | null;
}

export const useVerseAnnotationsStore = create<VerseAnnotationsState>()(
  (set, get) => ({
    loadedSurah: null,
    bookmarkedVerseKeys: new Set<string>(),
    notedVerseKeys: new Set<string>(),
    highlights: {},
    loading: false,

    loadAnnotationsForSurah: async (surahNumber: number) => {
      const state = get();
      if (state.loading || state.loadedSurah === surahNumber) return;

      set({loading: true});

      try {
        const {bookmarks, notes, highlights} =
          await verseAnnotationService.getAnnotationsForSurah(surahNumber);

        const bookmarkedVerseKeys = new Set(bookmarks.map(b => b.verseKey));
        const notedVerseKeys = new Set(notes.map(n => n.verseKey));
        const highlightsRecord: Record<string, HighlightColor> = {};
        highlights.forEach(h => {
          highlightsRecord[h.verseKey] = h.color;
        });

        set({
          loadedSurah: surahNumber,
          bookmarkedVerseKeys,
          notedVerseKeys,
          highlights: highlightsRecord,
          loading: false,
        });
      } catch (error) {
        console.error(
          '[VerseAnnotationsStore] Failed to load annotations:',
          error,
        );
        set({loading: false});
      }
    },

    // Optimistic mutations
    addBookmark: (verseKey: string) => {
      const newSet = new Set(get().bookmarkedVerseKeys);
      newSet.add(verseKey);
      set({bookmarkedVerseKeys: newSet});
    },

    removeBookmark: (verseKey: string) => {
      const newSet = new Set(get().bookmarkedVerseKeys);
      newSet.delete(verseKey);
      set({bookmarkedVerseKeys: newSet});
    },

    addNote: (verseKey: string) => {
      const newSet = new Set(get().notedVerseKeys);
      newSet.add(verseKey);
      set({notedVerseKeys: newSet});
    },

    removeNote: (verseKey: string) => {
      const newSet = new Set(get().notedVerseKeys);
      newSet.delete(verseKey);
      set({notedVerseKeys: newSet});
    },

    setHighlight: (verseKey: string, color: HighlightColor) => {
      set({highlights: {...get().highlights, [verseKey]: color}});
    },

    removeHighlight: (verseKey: string) => {
      const newHighlights = {...get().highlights};
      delete newHighlights[verseKey];
      set({highlights: newHighlights});
    },

    // Query helpers (O(1))
    isBookmarked: (verseKey: string) => get().bookmarkedVerseKeys.has(verseKey),

    hasNote: (verseKey: string) => get().notedVerseKeys.has(verseKey),

    getHighlightColor: (verseKey: string) => get().highlights[verseKey] ?? null,
  }),
);
