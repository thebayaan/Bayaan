// @ai-generated
/**
 * Bookmarks, notes and highlights of rewayah verse units (decision 3).
 *
 * Storage stays Hafs-keyed (verse-units contract, section 3). A row keeps
 *   verse_key    = the unit's Hafs anchor: "S:A", or "S:A:W" for a unit that
 *                  starts inside Hafs verse S:A (the later part of a split
 *                  Hafs verse: Warsh 1:7 is stored as "1:7:5"),
 *   surah_number / ayah_number = the anchor's Hafs surah and ayah,
 *   rewayah_id   = the unit's rewayah.
 * There is no schema change and no migration: every existing row is a valid
 * anchor, and the two parts of a split Hafs verse get two distinct keys, so
 * UNIQUE(verse_key) keeps them apart.
 *
 * This module turns rows back into units. It is pure (no data-service or
 * store import):
 *  - annotationAnchor(): what a row stores for a unit;
 *  - deriveUnitAnnotations(): the unit keys a SHOWN rewayah marks (mushaf
 *    tints, player dots, the verse-actions toggles) and the rows behind each
 *    unit, so un-marking a unit deletes every row that marks it;
 *  - describeSavedVerse(): how a collection row is labelled and previewed in
 *    the rewayah it was saved in (its own numbering and its own text);
 *  - savedVerseRouteParams(): the /mushaf route params that open a row at
 *    exactly its verse.
 */
import {
  formatUnitRangeLabel,
  parseAnchorKey,
  unitsForStoredVerse,
  type RewayahVerseUnits,
  type VerseUnit,
} from '@/services/mushaf/RewayahVerseUnits';
import type {RewayahId} from '@/services/rewayah/RewayahIdentity';
import type {HighlightColor} from '@/types/verse-annotations';

// ── Rows ────────────────────────────────────────────────────────────────────

/** What a stored row identifies a verse by. */
export interface StoredVerseRow {
  /** verse_key: a Hafs anchor, "S:A" or "S:A:W". */
  readonly verseKey: string;
  /** rewayah_id the row was saved in; null / undefined count as Hafs. */
  readonly rewayahId?: RewayahId | null;
}

export interface StoredHighlightRow extends StoredVerseRow {
  readonly color: HighlightColor;
}

/** The rows a shown rewayah's marks are derived from. */
export interface AnnotationRows {
  /** Bookmark rows by verse_key (bookmarks.verse_key is UNIQUE). */
  readonly bookmarks: Readonly<Record<string, StoredVerseRow>>;
  /** Noted anchors, one entry per (rewayah, verse_key): see noteRowKey. */
  readonly notes: Readonly<Record<string, StoredVerseRow>>;
  /** Highlight rows by verse_key (highlights.verse_key is UNIQUE). */
  readonly highlights: Readonly<Record<string, StoredHighlightRow>>;
}

/** Key of a noted anchor in AnnotationRows.notes (notes are not unique). */
export function noteRowKey(row: StoredVerseRow): string {
  return `${row.rewayahId ?? 'hafs'}|${row.verseKey}`;
}

/** The columns a row stores for a unit (contract section 3). */
export interface AnnotationAnchor {
  readonly verseKey: string;
  readonly surahNumber: number;
  readonly ayahNumber: number;
  readonly rewayahId: RewayahId;
}

/**
 * What a bookmarks / notes / highlights row stores for `unit`: its Hafs
 * anchor and its rewayah. Never a rewayah verse number. Throws when the unit
 * is not a unit of `units` (another rewayah or another data version).
 */
export function annotationAnchor(
  units: RewayahVerseUnits,
  unit: VerseUnit,
): AnnotationAnchor {
  const anchor = units.hafsAnchor(unit);
  return {
    verseKey: anchor.key,
    surahNumber: anchor.surah,
    ayahNumber: anchor.ayah,
    rewayahId: unit.rewayah,
  };
}

// ── Marks of a shown rewayah ────────────────────────────────────────────────

/** Bookmarks, notes and highlights in the units of one shown rewayah. */
export interface UnitAnnotations {
  /** The shown rewayah; every key below is in its numbering. */
  readonly rewayah: RewayahId;
  readonly bookmarkedUnitKeys: ReadonlySet<string>;
  readonly notedUnitKeys: ReadonlySet<string>;
  /** Highlight colour per unit key. */
  readonly highlightColors: Readonly<Record<string, HighlightColor>>;
  /** verse_keys of every bookmark row marking the unit (all are removed). */
  bookmarkRowKeys(unitKey: string): readonly string[];
  /** verse_keys of every highlight row marking the unit (all are removed). */
  highlightRowKeys(unitKey: string): readonly string[];
}

const NO_KEYS: readonly string[] = Object.freeze([]);

function push(map: Map<string, string[]>, key: string, value: string) {
  const list = map.get(key);
  if (!list) map.set(key, [value]);
  else if (!list.includes(value)) list.push(value);
}

/**
 * The units of `display` one stored row marks (contract section 3, see
 * deriveUnitAnnotations). `savedUnits`: the units of the row's rewayah when
 * it is a third rewayah whose units are at hand (exact), else none (no load).
 */
export function unitsMarkedBy(
  display: RewayahVerseUnits,
  row: StoredVerseRow,
  savedUnits: RewayahVerseUnits | null = null,
): readonly VerseUnit[] {
  const saved: RewayahId = row.rewayahId ?? 'hafs';
  return unitsForStoredVerse(
    display,
    {verseKey: row.verseKey, rewayahId: saved},
    saved === display.rewayah || saved === 'hafs' ? null : savedUnits,
  ).units;
}

/**
 * The units of `display` each row marks (contract section 3):
 *  - a row saved in the shown rewayah marks the unit its anchor names;
 *  - a Hafs row (and a legacy row without rewayah) marks every shown unit
 *    holding words of that Hafs verse (Hafs 1:7 in Warsh: 1:6 and 1:7);
 *  - a row of another rewayah marks, without loading anything, the shown
 *    units holding the anchored Hafs verse from the anchored word on, or,
 *    when `savedUnitsOf` returns that rewayah's units, exactly the shown
 *    units holding a word of the saved verse.
 * For Hafs shown and rows of existing data ("S:A" keys) the unit keys are
 * exactly the rows' verse keys, as the store's Hafs-keyed sets have them.
 *
 * A unit marked by several highlight rows takes the colour of, in order: the
 * row saved in the shown rewayah at the unit's own anchor (what marking the
 * unit writes, so the latest choice wins), another row of the shown rewayah,
 * a Hafs row, a row of another rewayah; ties go to the earlier anchor.
 */
export function deriveUnitAnnotations(
  display: RewayahVerseUnits,
  rows: AnnotationRows,
  savedUnitsOf: (rewayah: RewayahId) => RewayahVerseUnits | null = () => null,
): UnitAnnotations {
  const unitsOf = (row: StoredVerseRow): readonly VerseUnit[] => {
    const saved: RewayahId = row.rewayahId ?? 'hafs';
    return unitsMarkedBy(
      display,
      row,
      saved === display.rewayah || saved === 'hafs'
        ? null
        : savedUnitsOf(saved),
    );
  };

  const bookmarked = new Set<string>();
  const bookmarkRows = new Map<string, string[]>();
  for (const row of Object.values(rows.bookmarks)) {
    for (const unit of unitsOf(row)) {
      bookmarked.add(unit.key);
      push(bookmarkRows, unit.key, row.verseKey);
    }
  }

  const noted = new Set<string>();
  for (const row of Object.values(rows.notes)) {
    for (const unit of unitsOf(row)) noted.add(unit.key);
  }

  const highlightRows = new Map<string, string[]>();
  const best = new Map<
    string,
    {rank: number; order: number; key: string; color: HighlightColor}
  >();
  for (const row of Object.values(rows.highlights)) {
    const saved: RewayahId = row.rewayahId ?? 'hafs';
    const order =
      display.wordIdForAnchor(row.verseKey) ?? Number.MAX_SAFE_INTEGER;
    for (const unit of unitsOf(row)) {
      push(highlightRows, unit.key, row.verseKey);
      let rank = 0;
      if (saved === display.rewayah) {
        rank = display.hafsAnchor(unit).key === row.verseKey ? 3 : 2;
      } else if (saved === 'hafs') {
        rank = 1;
      }
      const current = best.get(unit.key);
      if (
        !current ||
        rank > current.rank ||
        (rank === current.rank &&
          (order < current.order ||
            (order === current.order && row.verseKey < current.key)))
      ) {
        best.set(unit.key, {rank, order, key: row.verseKey, color: row.color});
      }
    }
  }
  const highlightColors: Record<string, HighlightColor> = {};
  for (const [unitKey, pick] of best) highlightColors[unitKey] = pick.color;

  return {
    rewayah: display.rewayah,
    bookmarkedUnitKeys: bookmarked,
    notedUnitKeys: noted,
    highlightColors,
    bookmarkRowKeys: unitKey => bookmarkRows.get(unitKey) ?? NO_KEYS,
    highlightRowKeys: unitKey => highlightRows.get(unitKey) ?? NO_KEYS,
  };
}

// ── Collection rows in their own rewayah ────────────────────────────────────

/** Where the rewayah's verse units stand (useRewayahVerseUnits / service). */
export interface VerseUnitsSource {
  readonly units: RewayahVerseUnits | null;
  readonly status: 'ready' | 'loading' | 'idle' | 'error' | 'unavailable';
}

/**
 * How a saved row reads in the rewayah it was saved in:
 *  - 'hafs': saved in Hafs (or a legacy row without rewayah): Hafs numbering
 *    and text, shown exactly as before;
 *  - 'loading': the rewayah's verse units are loading (show no number);
 *  - 'units': its verses in the rewayah's own numbering, with their text;
 *  - 'unnumbered': no rewayah verse names it (units refused or unavailable,
 *    or the anchor is the unnumbered Fatiha basmala of the Madani / Basri
 *    counts): show its Hafs reference, prefixed (formatHafsReference).
 */
export type SavedVerseDescription =
  | {readonly kind: 'hafs'}
  | {readonly kind: 'loading'}
  | {
      readonly kind: 'units';
      readonly units: readonly VerseUnit[];
      /** "1:6", "2:255-257" or "2:286 - 3:2" (rewayah numbering). */
      readonly label: string;
      /** The units' own texts (each ends with its verse marker). */
      readonly text: string;
    }
  | {
      readonly kind: 'unnumbered';
      /** Hafs verses of the stored anchors, in order. */
      readonly hafsKeys: readonly string[];
      /** "Hafs 1:1" ('' when no stored key is a valid anchor). */
      readonly hafsLabel: string;
    };

const HAFS_DESCRIPTION: SavedVerseDescription = Object.freeze({
  kind: 'hafs',
});
const LOADING_DESCRIPTION: SavedVerseDescription = Object.freeze({
  kind: 'loading',
});

/**
 * Wording of a Hafs reference shown on purpose in a rewayah context
 * (contract 4.3): "Hafs 2:255". The one place to change it.
 */
export function formatHafsReference(reference: string): string {
  return `Hafs ${reference}`;
}

/** What describeSavedVerse reads from a bookmarks / notes row. */
export interface SavedVerseRef {
  readonly verseKey: string;
  /** Every anchor of a note on several verses (notes.verse_keys). */
  readonly verseKeys?: readonly string[] | null;
  readonly rewayahId?: RewayahId | null;
}

/** True when a saved row is read in Hafs numbering (Hafs or legacy row). */
export function isHafsSaved(row: {rewayahId?: RewayahId | null}): boolean {
  return !row.rewayahId || row.rewayahId === 'hafs';
}

function unnumbered(keys: readonly string[]): SavedVerseDescription {
  const locations = keys
    .map(parseAnchorKey)
    .filter((loc): loc is NonNullable<typeof loc> => loc !== null);
  const hafsKeys = [...new Set(locations.map(l => `${l.surah}:${l.ayah}`))];
  const hafsLabel =
    locations.length > 0
      ? formatHafsReference(
          formatUnitRangeLabel(locations[0], locations[locations.length - 1]),
        )
      : '';
  return {kind: 'unnumbered', hafsKeys, hafsLabel};
}

/**
 * Label and text of a saved row in the rewayah it was saved in (the exact
 * mapping of contract section 3: the row's rewayah is the displayed one).
 * `source` holds that rewayah's units. Each anchor names one unit
 * (unitForAnchor); a note's anchors give its units in reading order, without
 * repeats. A legacy row keyed by a Hafs verse names the rewayah verse holding
 * the start of that Hafs verse (Warsh "2:2" -> Warsh 2:1); an anchor on the
 * unnumbered Fatiha basmala names none.
 */
export function describeSavedVerse(
  row: SavedVerseRef,
  source: VerseUnitsSource,
): SavedVerseDescription {
  if (isHafsSaved(row)) return HAFS_DESCRIPTION;
  const keys =
    row.verseKeys && row.verseKeys.length > 0 ? row.verseKeys : [row.verseKey];
  const {units} = source;
  if (units && units.rewayah === row.rewayahId) {
    const picked = new Map<number, VerseUnit>();
    for (const key of keys) {
      const unit = units.unitForAnchor(key);
      if (unit) picked.set(unit.index, unit);
    }
    const list = [...picked.values()].sort((a, b) => a.index - b.index);
    if (list.length === 0) return unnumbered(keys);
    return {
      kind: 'units',
      units: list,
      label: formatUnitRangeLabel(list[0], list[list.length - 1]),
      text: list.map(unit => units.unitText(unit)).join(' '),
    };
  }
  if (source.status === 'error' || source.status === 'unavailable') {
    return unnumbered(keys);
  }
  return LOADING_DESCRIPTION;
}

/**
 * The verse label of a saved row: its rewayah verse(s) ("1:7", "2:5-7"),
 * `hafsLabel` (the row's Hafs "S:A", as shown before) for a Hafs row, the
 * prefixed Hafs reference ("Hafs 1:1") when no rewayah verse names it, and
 * null while the rewayah's verses load (no number rather than a Hafs one
 * next to a rewayah name).
 */
export function savedVerseLabel(
  description: SavedVerseDescription,
  hafsLabel: string,
): string | null {
  switch (description.kind) {
    case 'hafs':
      return hafsLabel;
    case 'units':
      return description.label;
    case 'unnumbered':
      return description.hafsLabel || null;
    default:
      return null;
  }
}

/**
 * Options-sheet subtitle of a saved row: "Ayah N" with N the ayah of its
 * first verse in the rewayah it was saved in (`hafsAyah`, as before, for a
 * Hafs row); the prefixed Hafs reference when no rewayah verse names it;
 * none while the rewayah's verses load.
 */
export function savedVerseSubtitle(
  description: SavedVerseDescription,
  hafsAyah: number,
): string | undefined {
  switch (description.kind) {
    case 'hafs':
      return `Ayah ${hafsAyah}`;
    case 'units':
      return `Ayah ${description.units[0].ayah}`;
    case 'unnumbered':
      return description.hafsLabel || undefined;
    default:
      return undefined;
  }
}

// ── Opening a saved verse ───────────────────────────────────────────────────

/**
 * Route params of /mushaf (app/mushaf.tsx) that open a saved verse (a type
 * literal, so that it is assignable to expo-router's params).
 */
export type SavedVerseRouteParams = {
  /** Hafs surah / ayah of the row (its anchor's Hafs verse), as before. */
  surah: string;
  ayah: string;
  page: string;
  /**
   * The row's storage anchor ("S:A" or "S:A:W"), for a row saved in a
   * non-Hafs rewayah only: the mushaf selects exactly the verse unit holding
   * that slot in the rewayah on screen (verse-units contract 4.4), so the two
   * parts of a split Hafs verse open as two different verses. Hafs rows keep
   * today's params (no anchor).
   */
  anchor?: string;
};

/**
 * The verse a stored anchor opens in a rewayah (`units`, its verse units):
 * the unit holding the anchored word, or, for the unnumbered Fatiha basmala
 * of the Madani / Basri counts, the first verse after it (contract section
 * 5). Null for a key that names no word of the data. The receiving side of
 * SavedVerseRouteParams.anchor.
 */
export function unitForRouteAnchor(
  anchor: string,
  units: RewayahVerseUnits,
): VerseUnit | null {
  const unit = units.unitForAnchor(anchor);
  if (unit) return unit;
  const wordId = units.wordIdForAnchor(anchor);
  return wordId === null ? null : units.unitAtOrAfterWordId(wordId);
}

/** A verse to select in the mushaf: its key, storage anchor, Hafs verses. */
export interface RouteAnchorSelection {
  /** "S:A" in the numbering of the rewayah on screen. */
  readonly key: string;
  /** Its storage anchor ("S:A" or "S:A:W"). */
  readonly anchor: string;
  readonly hafsKeys: readonly string[];
}

/**
 * What the mushaf selects for a /mushaf `anchor` param in the rewayah on
 * screen (`units`): the verse unitForRouteAnchor() names, in the shape of a
 * selected verse unit. Null when the anchor names no word of the data.
 */
export function routeAnchorSelection(
  anchor: string,
  units: RewayahVerseUnits,
): RouteAnchorSelection | null {
  const unit = unitForRouteAnchor(anchor, units);
  return unit
    ? {
        key: unit.key,
        anchor: units.hafsAnchor(unit).key,
        hafsKeys: unit.hafsKeys,
      }
    : null;
}

/**
 * Params that open a saved row on its page with its verse selected. For a
 * Hafs row (and a legacy row without rewayah) exactly today's params.
 */
export function savedVerseRouteParams(
  row: {
    verseKey: string;
    surahNumber: number;
    ayahNumber: number;
    rewayahId?: RewayahId | null;
  },
  page: number,
): SavedVerseRouteParams {
  const params: SavedVerseRouteParams = {
    surah: String(row.surahNumber),
    ayah: String(row.ayahNumber),
    page: String(page),
  };
  if (!isHafsSaved(row) && parseAnchorKey(row.verseKey)) {
    params.anchor = row.verseKey;
  }
  return params;
}
