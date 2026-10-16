// @ai-generated
/**
 * Rows of the mushaf's verse-list modes for a non-Hafs text (decision 3 of
 * Release 1).
 *
 * ContinuousListView (the vertical list) and ReadingPageView (one mushaf
 * page as a list) show one row per verse of the shown rewayah, in its OWN
 * numbering, each drawn from exactly its own slots: the player's verse rows
 * (buildVerseUnitRows, VerseItem's `unitRow`). Never a Hafs verse under the
 * rewayah's name. In Warsh, Hafs 1:7 is two rows (Warsh 1:6, up to its
 * inline marker ۝٦, and Warsh 1:7), Warsh 2:1 is one row holding Hafs 2:1
 * and 2:2, and the Fatiha basmala of the Madani / Basri counts is a row
 * without a number. Translations stay Hafs-aligned (verse-units contract
 * 4.6, list rule: a Hafs verse's translation under the first row holding
 * it, the shared-translation note under every row dividing it).
 *
 * Rows are found from the slots: a page lists every verse with a word on it
 * (a verse continuing from the previous page included, as the Hafs rows
 * did), and a Hafs key or stored anchor lands on the row holding that slot.
 * Only the units and the shared layout are read (the slot ids of the 15-line
 * layout are those of every words DB), never the words on screen, so rows
 * cannot mix two rewayat during a switch.
 *
 * Hafs keeps its Hafs verse rows exactly as before: the views never call
 * this module for Hafs.
 */
import {
  digitalKhattDataService,
  type DKLine,
} from '@/services/mushaf/DigitalKhattDataService';
import {
  parseAnchorKey,
  type RewayahVerseUnits,
} from '@/services/mushaf/RewayahVerseUnits';
import {
  enhancedVersesBySurah,
  type EnhancedVerse,
} from '@/utils/enhancedVerseData';
import {
  buildVerseUnitRows,
  UNNUMBERED_BASMALA_ROW_KEY,
  type VerseUnitRow,
} from '@/components/player/v2/PlayerContent/QuranView/verseUnitRows';

const surahData = require('@/data/surahData.json') as Array<{
  id: number;
  bismillah_pre: boolean;
}>;

export const MUSHAF_TOTAL_PAGES = 604;
const MUSHAF_PAGES: readonly number[] = Array.from(
  {length: MUSHAF_TOTAL_PAGES},
  (_, i) => i + 1,
);

/** Layout lines of a page (DigitalKhattDataService.getPageLines). */
export type PageLinesSource = (pageNumber: number) => readonly DKLine[];

const activePageLines: PageLinesSource = page =>
  digitalKhattDataService.getPageLines(page);

/** A row of a verse list: a surah header or a verse row of the rewayah. */
export type UnitListItem =
  | {type: 'surah_header'; surahNumber: number; showBismillah: boolean}
  | {type: 'verse'; verse: VerseUnitRow; surahNumber: number};

// ── Rows ────────────────────────────────────────────────────────────────────

interface SurahRows {
  readonly rows: readonly VerseUnitRow[];
  readonly byKey: ReadonlyMap<string, VerseUnitRow>;
}

interface RowCache {
  /**
   * The translation arrays the rows were built with: rebuilding the
   * translation (rebuildEnhancedVerses) replaces every surah's array, and
   * the rows are then built again with the new text.
   */
  readonly content: EnhancedVerse[] | undefined;
  readonly bySurah: Map<number, SurahRows>;
}

const rowCaches = new WeakMap<RewayahVerseUnits, RowCache>();

function rowCacheOf(units: RewayahVerseUnits): RowCache {
  const content = enhancedVersesBySurah[1];
  let cache = rowCaches.get(units);
  if (!cache || cache.content !== content) {
    cache = {content, bySurah: new Map()};
    rowCaches.set(units, cache);
  }
  return cache;
}

/**
 * The verse rows of `surah` in the rewayah of `units` (buildVerseUnitRows),
 * with the selected translation of every Hafs verse they hold. Built once
 * per units object, surah and translation.
 */
export function unitRowsOfSurah(
  units: RewayahVerseUnits,
  surah: number,
): readonly VerseUnitRow[] {
  const cache = rowCacheOf(units);
  let entry = cache.bySurah.get(surah);
  if (!entry) {
    const hafsVerses = new Map(
      (enhancedVersesBySurah[surah] ?? []).map(v => [v.verse_key, v]),
    );
    const rows = buildVerseUnitRows(units, surah, hafsKey =>
      hafsVerses.get(hafsKey),
    );
    entry = {rows, byKey: new Map(rows.map(row => [row.verse_key, row]))};
    cache.bySurah.set(surah, entry);
  }
  return entry.rows;
}

/**
 * The row of a row key: a unit key 'S:A' (the rewayah's numbering) or the
 * unnumbered basmala row (the Fatiha's: the only unnumbered verse slots).
 */
export function unitRowByKey(
  units: RewayahVerseUnits,
  rowKey: string,
): VerseUnitRow | undefined {
  const surah =
    rowKey === UNNUMBERED_BASMALA_ROW_KEY
      ? 1
      : Number.parseInt(rowKey.split(':')[0], 10);
  if (!Number.isInteger(surah) || surah < 1) return undefined;
  unitRowsOfSurah(units, surah);
  return rowCacheOf(units).bySurah.get(surah)?.byKey.get(rowKey);
}

/**
 * Row key of a slot: the verse holding it, or the unnumbered basmala row;
 * null for a blank slot (nothing on screen) or a slot the units do not hold.
 */
function rowKeyOfSlot(units: RewayahVerseUnits, wordId: number): string | null {
  if (!units.slotText(wordId)) return null;
  const unit = units.unitForWordId(wordId);
  if (unit) return unit.key;
  return units.isUnnumberedWordId(wordId) ? UNNUMBERED_BASMALA_ROW_KEY : null;
}

/**
 * Row keys of a page in reading order: every verse with a word on the page
 * (also one continuing from the previous page) and the unnumbered basmala
 * where its words are. For the text on screen these are exactly the page's
 * verse units (MushafVerseMapService.getOrderedUnitKeysForPage) with the
 * basmala row added.
 */
export function pageRowKeys(
  units: RewayahVerseUnits,
  pageNumber: number,
  pageLines: PageLinesSource = activePageLines,
  limit = Number.POSITIVE_INFINITY,
): string[] {
  const keys: string[] = [];
  const seen = new Set<string>();
  for (const line of pageLines(pageNumber)) {
    if (line.line_type !== 'ayah') continue;
    for (let id = line.first_word_id; id <= line.last_word_id; id++) {
      const key = rowKeyOfSlot(units, id);
      if (key !== null && !seen.has(key)) {
        seen.add(key);
        keys.push(key);
        if (keys.length >= limit) return keys;
      }
    }
  }
  return keys;
}

function showBismillah(surah: number): boolean {
  return surahData.find(s => s.id === surah)?.bismillah_pre ?? false;
}

/**
 * The items of one page in ReadingPageView: its verse rows in reading order,
 * a surah header before the first row of every surah whose header line is
 * on the page (as getReadingPageItems does for Hafs).
 */
export function readingPageUnitItems(
  units: RewayahVerseUnits,
  pageNumber: number,
  pageLines: PageLinesSource = activePageLines,
): UnitListItem[] {
  const headers = new Set<number>();
  for (const line of pageLines(pageNumber)) {
    if (line.line_type === 'surah_name' && line.surah_number >= 1) {
      headers.add(line.surah_number);
    }
  }
  const items: UnitListItem[] = [];
  let lastSurah = 0;
  for (const key of pageRowKeys(units, pageNumber, pageLines)) {
    const row = unitRowByKey(units, key);
    if (!row) continue;
    const surah = row.surah_number;
    if (surah !== lastSurah && headers.has(surah)) {
      items.push({
        type: 'surah_header',
        surahNumber: surah,
        showBismillah: showBismillah(surah),
      });
    }
    lastSurah = surah;
    items.push({type: 'verse', verse: row, surahNumber: surah});
  }
  return items;
}

// ── The vertical list ───────────────────────────────────────────────────────

/** ContinuousListView's items and lookups for a non-Hafs text. */
export interface UnitListModel {
  readonly units: RewayahVerseUnits;
  /** Every surah: its header, then its verse rows in reading order. */
  readonly items: readonly UnitListItem[];
  /** Item index of a surah's header. */
  indexOfSurah(surah: number): number | undefined;
  /** Item index of a row (unit key, or the unnumbered basmala row key). */
  indexOfRow(rowKey: string): number | undefined;
  /**
   * Item index of the row holding the slot a Hafs reference names: a Hafs
   * key 'S:A' (its first slot, where a stored 'S:A' row opens) or a stored
   * anchor 'S:A:W'. For a Hafs key held by one of `preferRowKeys` (the
   * follow-along band), that row: playback scrolls by the Hafs verse being
   * recited, and a reciter of the rewayah may be on its second part.
   */
  indexForHafsReference(
    reference: string,
    preferRowKeys?: readonly string[],
  ): number | undefined;
  /** Item index of the row holding the first word of a page. */
  indexForPage(pageNumber: number): number | undefined;
  /** Page of a row's first word. */
  pageOfRow(rowKey: string): number | undefined;
}

/**
 * The vertical list of a non-Hafs text: every surah header, then the
 * surah's verse rows. pageOfRow reads the layout of `pageNumbers` (the 604
 * mushaf pages) once, lazily, and not before the layout is loaded.
 */
export function buildUnitListModel(
  units: RewayahVerseUnits,
  pageLines: PageLinesSource = activePageLines,
  pageNumbers: readonly number[] = MUSHAF_PAGES,
): UnitListModel {
  const items: UnitListItem[] = [];
  const surahIndex = new Map<number, number>();
  const rowIndex = new Map<string, number>();
  for (const surah of surahData) {
    surahIndex.set(surah.id, items.length);
    items.push({
      type: 'surah_header',
      surahNumber: surah.id,
      showBismillah: surah.bismillah_pre,
    });
    for (const row of unitRowsOfSurah(units, surah.id)) {
      rowIndex.set(row.verse_key, items.length);
      items.push({type: 'verse', verse: row, surahNumber: surah.id});
    }
  }

  let rowStartPage: Map<string, number> | null = null;
  const startPages = (): Map<string, number> | null => {
    if (rowStartPage) return rowStartPage;
    const start = new Map<string, number>();
    for (const page of pageNumbers) {
      for (const key of pageRowKeys(units, page, pageLines)) {
        if (!start.has(key)) start.set(key, page);
      }
    }
    // Layout not loaded yet: nothing to remember.
    if (start.size === 0) return null;
    rowStartPage = start;
    return start;
  };

  const basmalaIndex = (wordId: number | null): number | undefined =>
    wordId !== null && units.isUnnumberedWordId(wordId)
      ? rowIndex.get(UNNUMBERED_BASMALA_ROW_KEY)
      : undefined;

  return {
    units,
    items,
    indexOfSurah: surah => surahIndex.get(surah),
    indexOfRow: rowKey => rowIndex.get(rowKey),
    indexForHafsReference(reference, preferRowKeys) {
      const loc = parseAnchorKey(reference);
      if (!loc) return undefined;
      const hafsKey = `${loc.surah}:${loc.ayah}`;
      if (preferRowKeys && preferRowKeys.length > 0 && reference === hafsKey) {
        const preferred = units
          .unitsForHafsKey(hafsKey)
          .find(unit => preferRowKeys.includes(unit.key));
        if (preferred) return rowIndex.get(preferred.key);
      }
      const unit = units.unitForAnchor(reference);
      return unit
        ? rowIndex.get(unit.key)
        : basmalaIndex(units.wordIdForAnchor(reference));
    },
    indexForPage(pageNumber) {
      const [key] = pageRowKeys(units, pageNumber, pageLines, 1);
      return key === undefined ? undefined : rowIndex.get(key);
    },
    pageOfRow: rowKey => startPages()?.get(rowKey),
  };
}

/**
 * The theme (Hafs-aligned) a row's background follows: the Hafs verse its
 * first word is in, as the mushaf pages take a verse unit's theme.
 */
export function themeHafsKeyOfRow(row: VerseUnitRow): string | undefined {
  return row.anchor?.hafsKey ?? row.parts[0]?.hafsKey;
}
