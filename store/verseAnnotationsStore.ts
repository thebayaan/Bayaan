// @ai-generated
import {create} from 'zustand';
import {verseAnnotationService} from '@/services/verse-annotations/VerseAnnotationService';
import type {HighlightColor} from '@/types/verse-annotations';

interface VerseAnnotationsState {
  scopeRevision: number;
  // Accumulate multi-surah pages and mounted neighbours within one scope.
  loadedSurahs: Set<number>;
  bookmarkedVerseKeys: Set<string>;
  notedVerseKeys: Set<string>;
  highlights: Record<string, HighlightColor>;
  loading: boolean;

  loadAnnotationsForSurah: (surahNumber: number) => Promise<void>;
  loadAnnotationsForSurahs: (surahNumbers: number[]) => Promise<void>;
  clearActiveView: () => void;

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

// Serialize loads instead of dropping concurrent page/per-surah requests.
let inFlightLoad: Promise<void> | null = null;

export const useVerseAnnotationsStore = create<VerseAnnotationsState>()(
  (set, get) => ({
    scopeRevision: 0,
    loadedSurahs: new Set<number>(),
    bookmarkedVerseKeys: new Set<string>(),
    notedVerseKeys: new Set<string>(),
    highlights: {},
    loading: false,

    loadAnnotationsForSurah: async (surahNumber: number) => {
      await get().loadAnnotationsForSurahs([surahNumber]);
    },

    loadAnnotationsForSurahs: async (surahNumbers: number[]) => {
      const scopeRevision = get().scopeRevision;
      const wanted = [...new Set(surahNumbers)].sort((a, b) => a - b);
      if (wanted.length === 0) return;
      if (wanted.every(n => get().loadedSurahs.has(n))) return;

      // Recheck the subset after waiting: a wider page load may already have
      // supplied it. A queued old-account request must not read the new scope.
      while (inFlightLoad) {
        await inFlightLoad;
        if (get().scopeRevision !== scopeRevision) return;
      }
      const missing = wanted.filter(n => !get().loadedSurahs.has(n));
      if (missing.length === 0) return;

      const load = (async () => {
        set({loading: true});
        try {
          const results = await Promise.all(
            missing.map(n => verseAnnotationService.getAnnotationsForSurah(n)),
          );
          if (get().scopeRevision !== scopeRevision) return;

          // Merge at completion time, preserving siblings and optimistic edits.
          const bookmarkedVerseKeys = new Set(get().bookmarkedVerseKeys);
          const notedVerseKeys = new Set(get().notedVerseKeys);
          const highlightsRecord: Record<string, HighlightColor> = {
            ...get().highlights,
          };
          for (const {bookmarks, notes, highlights} of results) {
            bookmarks.forEach(b => bookmarkedVerseKeys.add(b.verseKey));
            notes.forEach(n => notedVerseKeys.add(n.verseKey));
            highlights.forEach(h => {
              highlightsRecord[h.verseKey] = h.color;
            });
          }
          const loadedSurahs = new Set(get().loadedSurahs);
          missing.forEach(n => loadedSurahs.add(n));
          set({
            loadedSurahs,
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
          if (get().scopeRevision === scopeRevision) set({loading: false});
        }
      })();

      inFlightLoad = load;
      try {
        await load;
      } finally {
        if (inFlightLoad === load) inFlightLoad = null;
      }
    },

    clearActiveView: () =>
      set(state => ({
        scopeRevision: state.scopeRevision + 1,
        loadedSurahs: new Set<number>(),
        bookmarkedVerseKeys: new Set<string>(),
        notedVerseKeys: new Set<string>(),
        highlights: {},
        loading: false,
      })),

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
