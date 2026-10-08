import {create} from 'zustand';
// @ai-start
import {parseAnchorKey} from '@/services/mushaf/RewayahVerseUnits';
import type {RewayahId} from '@/services/rewayah/RewayahIdentity';

/**
 * One selected verse unit: a verse of the selection's rewayah in its own
 * numbering (decision 3 of Release 1), with what downstream storage needs.
 */
export interface SelectedVerseUnit {
  /** 'S:A' in the numbering of the selection's rewayah. */
  readonly key: string;
  /**
   * Storage anchor, Hafs-keyed: the Hafs location of the unit's first slot,
   * 'S:A' (starts at Hafs word 1) or 'S:A:W' (later part of a split Hafs
   * verse). What bookmarks / notes / highlights store in verse_key.
   */
  readonly anchor: string;
  /** Hafs verse keys holding the unit's words, in order. */
  readonly hafsKeys: readonly string[];
}

/** The unit of Hafs verse `key`: a Hafs unit is its Hafs verse. */
function hafsUnit(key: string): SelectedVerseUnit {
  return {key, anchor: key, hafsKeys: [key]};
}
// @ai-end

interface MushafVerseSelectionState {
  /** First selected key (selectedVerseKeys[0]), or null. */
  selectedVerseKey: string | null;
  /**
   * Selected verse keys in reading order, in the numbering of
   * selectedRewayah (@ai): rewayah verse units from the mushaf gestures,
   * Hafs verse keys from the Hafs-keyed actions below.
   */
  selectedVerseKeys: string[];
  selectedPageNumber: number | null;
  // @ai-start
  /**
   * Numbering of selectedVerseKeys (a unit key means nothing without its
   * rewayah); null when nothing is selected. Painters show a selection only
   * in its own rewayah, or map a Hafs selection to the shown rewayah's units.
   */
  selectedRewayah: RewayahId | null;
  /** The selected units with their storage anchors, parallel to the keys. */
  selectedUnits: readonly SelectedVerseUnit[];
  /** Select verse units of `rewayah` (mushaf long-press / drag-select). */
  selectUnits: (
    rewayah: RewayahId,
    units: readonly SelectedVerseUnit[],
    pageNumber: number,
  ) => void;
  /**
   * The shown text now is `rewayah`: drop a selection of another rewayah's
   * verse units (CONTRACT 4.7). A Hafs selection names the same verses in
   * every rewayah and is kept.
   */
  keepSelectionFor: (rewayah: RewayahId) => void;
  // @ai-end
  /** Select a HAFS verse (Hafs-keyed callers: QCF, routes, navigation). */
  selectVerse: (verseKey: string, pageNumber: number) => void;
  /** Select consecutive HAFS verses (Hafs-keyed callers). */
  selectVerseRange: (verseKeys: string[], pageNumber: number) => void;
  clearSelection: () => void;
}

export const useMushafVerseSelectionStore = create<MushafVerseSelectionState>(
  (set, get) => ({
    selectedVerseKey: null,
    selectedVerseKeys: [],
    selectedPageNumber: null,
    selectedRewayah: null, // @ai
    selectedUnits: [], // @ai
    // @ai-start
    selectUnits: (rewayah, units, pageNumber) =>
      set({
        selectedVerseKey: units[0]?.key ?? null,
        selectedVerseKeys: units.map(u => u.key),
        selectedPageNumber: pageNumber,
        selectedRewayah: units.length > 0 ? rewayah : null,
        selectedUnits: units,
      }),
    keepSelectionFor: rewayah => {
      const current = get().selectedRewayah;
      if (current && current !== 'hafs' && current !== rewayah) {
        get().clearSelection();
      }
    },
    // @ai-end
    selectVerse: (verseKey, pageNumber) =>
      set({
        selectedVerseKey: verseKey,
        selectedVerseKeys: [verseKey],
        selectedPageNumber: pageNumber,
        selectedRewayah: 'hafs', // @ai
        selectedUnits: [hafsUnit(verseKey)], // @ai
      }),
    selectVerseRange: (verseKeys, pageNumber) =>
      set({
        selectedVerseKey: verseKeys[0] ?? null,
        selectedVerseKeys: verseKeys,
        selectedPageNumber: pageNumber,
        selectedRewayah: verseKeys.length > 0 ? 'hafs' : null, // @ai
        selectedUnits: verseKeys.map(hafsUnit), // @ai
      }),
    clearSelection: () =>
      set({
        selectedVerseKey: null,
        selectedVerseKeys: [],
        selectedPageNumber: null,
        selectedRewayah: null, // @ai
        selectedUnits: [], // @ai
      }),
  }),
);

// @ai-start
/**
 * The 'verse-actions' sheet payload for a mushaf selection (verse-units
 * contract 4.1): `rewayah` + `unitKeys` name the selected verses in the
 * shown rewayah's own numbering; the Hafs fields keep their HAFS meaning
 * (the first unit's anchor verse, and every Hafs verse of the units when
 * there is more than one) so a reader that ignores `unitKeys` stays
 * Hafs-consistent instead of mislabelling. For Hafs, unitKeys are the Hafs
 * keys and the Hafs fields are exactly the previous payload.
 */
export interface MushafVerseActionsPayload {
  verseKey: string;
  surahNumber: number;
  ayahNumber: number;
  verseKeys?: string[];
  source: 'mushaf';
  rewayah: RewayahId;
  unitKeys: string[];
}

export function verseActionsPayloadForUnits(
  rewayah: RewayahId,
  units: readonly SelectedVerseUnit[],
): MushafVerseActionsPayload | null {
  const first = units[0];
  // The anchor's Hafs verse: 'S:A' of 'S:A' or 'S:A:W'.
  const anchor = first ? parseAnchorKey(first.anchor) : null;
  if (!anchor) return null;
  const hafsKeys: string[] = [];
  const seen = new Set<string>();
  for (const unit of units) {
    for (const key of unit.hafsKeys) {
      if (!seen.has(key)) {
        seen.add(key);
        hafsKeys.push(key);
      }
    }
  }
  return {
    verseKey: `${anchor.surah}:${anchor.ayah}`,
    surahNumber: anchor.surah,
    ayahNumber: anchor.ayah,
    verseKeys: hafsKeys.length > 1 ? hafsKeys : undefined,
    source: 'mushaf',
    rewayah,
    unitKeys: units.map(u => u.key),
  };
}
// @ai-end
