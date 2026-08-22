import {create} from 'zustand';
import {verseAnnotationService} from '@/services/verse-annotations/VerseAnnotationService';
import type {HighlightColor} from '@/types/verse-annotations';

interface VerseAnnotationsState {
  /**
   * Surahs whose annotations are currently in the store — ACCUMULATED, never
   * narrowed. Multi-surah loads exist because a single mushaf page can span
   * several surahs (the norm in Juz 'Amma); a per-surah cache would blind the
   * page renderer to bookmarks in the page's later surahs. @ai
   *
   * Accumulating (rather than keying the store on "the last loaded set") is
   * what makes concurrent loads safe: a narrow per-surah load can no longer
   * replace a wider page-level one and unpaint its siblings, and a neighbour
   * page still mounted by `windowSize` keeps its tint when the current page
   * changes.
   */
  loadedSurahs: Set<number>;
  bookmarkedVerseKeys: Set<string>;
  notedVerseKeys: Set<string>;
  highlights: Record<string, HighlightColor>;
  loading: boolean;

  loadAnnotationsForSurah: (surahNumber: number) => Promise<void>;
  loadAnnotationsForSurahs: (surahNumbers: number[]) => Promise<void>;

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

// @ai — serializes loads instead of dropping them. The old
// `if (loading) return` guard silently discarded the second caller's surah
// set when two surfaces raced (e.g. ContinuousMushafView's per-surah load vs
// main.tsx's page-level multi-surah load), leaving those surahs unloaded.
let inFlightLoad: Promise<void> | null = null;

export const useVerseAnnotationsStore = create<VerseAnnotationsState>()(
  (set, get) => ({
    loadedSurahs: new Set<number>(),
    bookmarkedVerseKeys: new Set<string>(),
    notedVerseKeys: new Set<string>(),
    highlights: {},
    loading: false,

    loadAnnotationsForSurah: async (surahNumber: number) => {
      // Already-loaded no-op. `loadedSurahs` accumulates, so this also covers
      // "this surah arrived as part of a wider page-level load". @ai
      if (get().loadedSurahs.has(surahNumber)) return;
      await get().loadAnnotationsForSurahs([surahNumber]);
    },

    loadAnnotationsForSurahs: async (surahNumbers: number[]) => {
      const wanted = [...new Set(surahNumbers)].sort((a, b) => a - b);
      if (wanted.length === 0) return;
      if (wanted.every(n => get().loadedSurahs.has(n))) return;

      // Wait out any in-flight load, THEN recompute what's still missing. The
      // recheck is subset-aware on purpose: the load we waited on may have
      // been a superset (e.g. we want [113] while [112,113,114] was in
      // flight). An exact-key recheck would compare '112,113,114' === '113',
      // decide it still had work to do, re-fetch 113 alone and REPLACE the
      // store — wiping 112/114's bookmarks. @ai
      while (inFlightLoad) {
        await inFlightLoad;
      }
      const missing = wanted.filter(n => !get().loadedSurahs.has(n));
      if (missing.length === 0) return;

      const load = (async () => {
        set({loading: true});

        try {
          const results = await Promise.all(
            missing.map(n => verseAnnotationService.getAnnotationsForSurah(n)),
          );

          // MERGE into whatever is in the store now (read at set-time, not a
          // stale snapshot) — never replace. This is what keeps a narrow load
          // from unpainting a wider one, and keeps still-mounted neighbour
          // pages tinted across a page change. @ai
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
          set({loading: false});
        }
      })();

      inFlightLoad = load;
      try {
        await load;
      } finally {
        if (inFlightLoad === load) inFlightLoad = null;
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
