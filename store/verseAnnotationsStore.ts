import {create} from 'zustand';
import {verseAnnotationService} from '@/services/verse-annotations/VerseAnnotationService';
import type {HighlightColor, VerseNote} from '@/types/verse-annotations';
// @ai-start
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import type {
  RewayahVerseUnits,
  VerseUnit,
} from '@/services/mushaf/RewayahVerseUnits';
import type {RewayahId} from '@/services/rewayah/RewayahIdentity';
import {
  annotationAnchor,
  deriveUnitAnnotations,
  noteRowKey,
  type AnnotationAnchor,
  type StoredHighlightRow,
  type StoredVerseRow,
  type UnitAnnotations,
} from '@/services/verse-annotations/unitAnnotations';
// @ai-end

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

  // @ai-start
  /**
   * The rows behind the three fields above, with the rewayah each was saved
   * in (decision 3: rewayah verse units). Keys are stored verse_keys (Hafs
   * anchors); the fields above stay keyed by verse_key alone for consumers
   * that still read Hafs keys. A shown rewayah's unit keys come from
   * selectUnitAnnotations() / useUnitAnnotations().
   */
  bookmarkRows: Record<string, StoredVerseRow>;
  /** Noted anchors, keyed by noteRowKey (rewayah + verse_key). */
  noteRows: Record<string, StoredVerseRow>;
  highlightRows: Record<string, StoredHighlightRow>;
  // @ai-end

  loadAnnotationsForSurah: (surahNumber: number) => Promise<void>;
  loadAnnotationsForSurahs: (surahNumbers: number[]) => Promise<void>;

  // Optimistic mutations, keyed by the stored verse_key. `rewayahId` is the
  // rewayah the row was saved in; pass the one given to the database service
  // (default: the mushaf's, as the service stamps it). @ai
  addBookmark: (verseKey: string, rewayahId?: RewayahId) => void;
  removeBookmark: (verseKey: string) => void;
  addNote: (verseKey: string, rewayahId?: RewayahId) => void;
  removeNote: (verseKey: string) => void;
  setHighlight: (
    verseKey: string,
    color: HighlightColor,
    rewayahId?: RewayahId,
  ) => void;
  removeHighlight: (verseKey: string) => void;

  // @ai-start
  // Rewayah verse units (decision 3): persist, then update the store. Rows
  // store each unit's Hafs anchor and rewayah (annotationAnchor), never a
  // rewayah verse number. `units` are the units of the selected verses'
  // rewayah (useRewayahVerseUnits); a unit of other data throws before
  // anything is written.
  /**
   * Bookmark: one row per unit not bookmarked yet. Unbookmark: delete every
   * row that marks the units in that rewayah, legacy rows included.
   */
  setUnitsBookmarked: (
    units: RewayahVerseUnits,
    selected: readonly VerseUnit[],
    bookmarked: boolean,
  ) => Promise<void>;
  /**
   * Colour each unit (one row at its anchor), or with null remove every
   * highlight row that marks the units, legacy rows included.
   */
  setUnitsHighlight: (
    units: RewayahVerseUnits,
    selected: readonly VerseUnit[],
    color: HighlightColor | null,
  ) => Promise<void>;
  /**
   * One note on consecutive units: verse_key = the first unit's anchor,
   * verse_keys = every unit's anchor when there are several.
   */
  addUnitsNote: (
    units: RewayahVerseUnits,
    selected: readonly VerseUnit[],
    content: string,
  ) => Promise<VerseNote>;
  // @ai-end

  // Query helpers
  isBookmarked: (verseKey: string) => boolean;
  hasNote: (verseKey: string) => boolean;
  getHighlightColor: (verseKey: string) => HighlightColor | null;
}

// @ai-start
/** The rewayah a row without an explicit one is saved in (as the DB does). */
function defaultRowRewayah(): RewayahId {
  return useMushafSettingsStore.getState().rewayah;
}

/** Distinct units in reading order, each checked against `units`. */
function anchorsOf(
  units: RewayahVerseUnits,
  selected: readonly VerseUnit[],
): {unit: VerseUnit; anchor: AnnotationAnchor}[] {
  const picked = new Map<number, VerseUnit>();
  for (const unit of selected) picked.set(units.indexOf(unit), unit);
  return [...picked.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, unit]) => ({unit, anchor: annotationAnchor(units, unit)}));
}

type RowsState = Pick<
  VerseAnnotationsState,
  'bookmarkRows' | 'noteRows' | 'highlightRows'
>;

const unitAnnotationsCache = new WeakMap<
  RewayahVerseUnits,
  {rows: RowsState; result: UnitAnnotations}
>();

/**
 * The bookmarks, notes and highlights of the store in the units of a shown
 * rewayah (`units`): unit-key sets, highlight colours by unit key, and the
 * rows marking each unit. Rows of other rewayat use the inexact mapping, so
 * nothing is loaded. Memoized per units object and rows.
 */
export function selectUnitAnnotations(
  state: RowsState,
  units: RewayahVerseUnits,
): UnitAnnotations {
  const cached = unitAnnotationsCache.get(units);
  if (
    cached &&
    cached.rows.bookmarkRows === state.bookmarkRows &&
    cached.rows.noteRows === state.noteRows &&
    cached.rows.highlightRows === state.highlightRows
  ) {
    return cached.result;
  }
  const result = deriveUnitAnnotations(units, {
    bookmarks: state.bookmarkRows,
    notes: state.noteRows,
    highlights: state.highlightRows,
  });
  unitAnnotationsCache.set(units, {
    rows: {
      bookmarkRows: state.bookmarkRows,
      noteRows: state.noteRows,
      highlightRows: state.highlightRows,
    },
    result,
  });
  return result;
}
// @ai-end

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
    // @ai-start
    bookmarkRows: {},
    noteRows: {},
    highlightRows: {},
    // @ai-end

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
          // @ai-start
          const bookmarkRows = {...get().bookmarkRows};
          const noteRows = {...get().noteRows};
          const highlightRows = {...get().highlightRows};
          // @ai-end
          for (const {bookmarks, notes, highlights} of results) {
            bookmarks.forEach(b => {
              bookmarkedVerseKeys.add(b.verseKey);
              // @ai-start
              bookmarkRows[b.verseKey] = {
                verseKey: b.verseKey,
                rewayahId: b.rewayahId,
              };
              // @ai-end
            });
            notes.forEach(n => {
              notedVerseKeys.add(n.verseKey);
              // @ai-start
              const row = {verseKey: n.verseKey, rewayahId: n.rewayahId};
              noteRows[noteRowKey(row)] = row;
              // @ai-end
            });
            highlights.forEach(h => {
              highlightsRecord[h.verseKey] = h.color;
              // @ai-start
              highlightRows[h.verseKey] = {
                verseKey: h.verseKey,
                rewayahId: h.rewayahId,
                color: h.color,
              };
              // @ai-end
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
            // @ai-start
            bookmarkRows,
            noteRows,
            highlightRows,
            // @ai-end
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
    addBookmark: (verseKey: string, rewayahId?: RewayahId) => {
      const newSet = new Set(get().bookmarkedVerseKeys);
      newSet.add(verseKey);
      // @ai-start
      // bookmarks.verse_key is UNIQUE and the insert is OR IGNORE: a row
      // already at this key stays as it is (with its own rewayah).
      const rows = get().bookmarkRows;
      const bookmarkRows = rows[verseKey]
        ? rows
        : {
            ...rows,
            [verseKey]: {verseKey, rewayahId: rewayahId ?? defaultRowRewayah()},
          };
      set({bookmarkedVerseKeys: newSet, bookmarkRows});
      // @ai-end
    },

    removeBookmark: (verseKey: string) => {
      const newSet = new Set(get().bookmarkedVerseKeys);
      newSet.delete(verseKey);
      // @ai-start
      const bookmarkRows = {...get().bookmarkRows};
      delete bookmarkRows[verseKey];
      set({bookmarkedVerseKeys: newSet, bookmarkRows});
      // @ai-end
    },

    addNote: (verseKey: string, rewayahId?: RewayahId) => {
      const newSet = new Set(get().notedVerseKeys);
      newSet.add(verseKey);
      // @ai-start
      const row = {verseKey, rewayahId: rewayahId ?? defaultRowRewayah()};
      const noteRows = {...get().noteRows, [noteRowKey(row)]: row};
      set({notedVerseKeys: newSet, noteRows});
      // @ai-end
    },

    removeNote: (verseKey: string) => {
      const newSet = new Set(get().notedVerseKeys);
      newSet.delete(verseKey);
      // @ai-start
      // Called once no note holds verseKey any more, in any rewayah.
      const noteRows = {...get().noteRows};
      for (const [key, row] of Object.entries(noteRows)) {
        if (row.verseKey === verseKey) delete noteRows[key];
      }
      set({notedVerseKeys: newSet, noteRows});
      // @ai-end
    },

    setHighlight: (
      verseKey: string,
      color: HighlightColor,
      rewayahId?: RewayahId, // @ai
    ) => {
      // @ai-start
      // highlights.verse_key is UNIQUE: an upsert recolours the row and
      // restamps its rewayah, so the row record is replaced the same way.
      const highlightRows = {
        ...get().highlightRows,
        [verseKey]: {
          verseKey,
          rewayahId: rewayahId ?? defaultRowRewayah(),
          color,
        },
      };
      set({
        highlights: {...get().highlights, [verseKey]: color},
        highlightRows,
      });
      // @ai-end
    },

    removeHighlight: (verseKey: string) => {
      const newHighlights = {...get().highlights};
      delete newHighlights[verseKey];
      // @ai-start
      const highlightRows = {...get().highlightRows};
      delete highlightRows[verseKey];
      set({highlights: newHighlights, highlightRows});
      // @ai-end
    },

    // @ai-start
    setUnitsBookmarked: async (units, selected, bookmarked) => {
      const picked = anchorsOf(units, selected);
      if (picked.length === 0) return;
      // Every row that can mark these units is in the store once their
      // surahs are loaded (rows are loaded per anchor surah = unit surah).
      await get().loadAnnotationsForSurahs(picked.map(p => p.unit.surah));
      const marks = selectUnitAnnotations(get(), units);
      if (bookmarked) {
        for (const {unit, anchor} of picked) {
          if (marks.bookmarkedUnitKeys.has(unit.key)) continue;
          // bookmarks.verse_key is UNIQUE (INSERT OR IGNORE): an existing
          // row at this anchor already marks the unit.
          if (get().bookmarkRows[anchor.verseKey]) continue;
          await verseAnnotationService.addBookmark(
            anchor.verseKey,
            anchor.surahNumber,
            anchor.ayahNumber,
            anchor.rewayahId,
          );
          get().addBookmark(anchor.verseKey, anchor.rewayahId);
        }
        return;
      }
      const rowKeys = new Set<string>();
      for (const {unit} of picked) {
        marks.bookmarkRowKeys(unit.key).forEach(key => rowKeys.add(key));
      }
      for (const key of rowKeys) {
        await verseAnnotationService.removeBookmark(key);
        get().removeBookmark(key);
      }
    },

    setUnitsHighlight: async (units, selected, color) => {
      const picked = anchorsOf(units, selected);
      if (picked.length === 0) return;
      await get().loadAnnotationsForSurahs(picked.map(p => p.unit.surah));
      if (color) {
        for (const {anchor} of picked) {
          await verseAnnotationService.upsertHighlight(
            anchor.verseKey,
            anchor.surahNumber,
            anchor.ayahNumber,
            color,
            anchor.rewayahId,
          );
          get().setHighlight(anchor.verseKey, color, anchor.rewayahId);
        }
        return;
      }
      const marks = selectUnitAnnotations(get(), units);
      const rowKeys = new Set<string>();
      for (const {unit} of picked) {
        marks.highlightRowKeys(unit.key).forEach(key => rowKeys.add(key));
      }
      for (const key of rowKeys) {
        await verseAnnotationService.removeHighlight(key);
        get().removeHighlight(key);
      }
    },

    addUnitsNote: async (units, selected, content) => {
      const picked = anchorsOf(units, selected);
      if (picked.length === 0) {
        throw new Error('[VerseAnnotationsStore] a note needs a verse');
      }
      const first = picked[0].anchor;
      const note = await verseAnnotationService.addNote(
        first.verseKey,
        first.surahNumber,
        first.ayahNumber,
        content,
        picked.length > 1 ? picked.map(p => p.anchor.verseKey) : undefined,
        first.rewayahId,
      );
      for (const {anchor} of picked) {
        get().addNote(anchor.verseKey, anchor.rewayahId);
      }
      return note;
    },
    // @ai-end

    // Query helpers (O(1))
    isBookmarked: (verseKey: string) => get().bookmarkedVerseKeys.has(verseKey),

    hasNote: (verseKey: string) => get().notedVerseKeys.has(verseKey),

    getHighlightColor: (verseKey: string) => get().highlights[verseKey] ?? null,
  }),
);
