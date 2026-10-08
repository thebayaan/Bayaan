// @ai-generated
/**
 * Verses in the mushaf search overlay (MushafSearchView, BookmarkChips) in
 * the numbering of the rewayah on screen (decision 3 of Release 1).
 *
 * - "N:M" typed in the search is verse N:M of the rewayah on screen: Warsh
 *   "2:285" is Warsh's last verse of al-Baqarah (Hafs 2:286), and Warsh
 *   "2:286" does not exist.
 * - A bookmark chip is labelled with the verse(s) of the rewayah on screen
 *   that the bookmark marks (the storage rule of the verse-units contract,
 *   section 3) and opens that verse, in the mushaf as it is: the chips never
 *   switch the rewayah.
 * - Search history keeps the verse's storage anchor (Hafs-keyed) with the
 *   rewayah, never a rewayah verse number (contract 4.4).
 *
 * For Hafs on screen nothing here needs verse units: the targets, labels and
 * history entries are exactly the Hafs ones of before.
 *
 * Pure: the caller passes the units of the rewayah on screen
 * (useRewayahVerseUnits) and pages with getPageForVerse(target.pageVerseKey).
 */
import {SURAHS} from '@/data/surahData';
import {
  formatUnitRangeLabel,
  parseAnchorKey,
  unitsForStoredVerse,
  type RewayahVerseUnits,
  type VerseUnit,
} from '@/services/mushaf/RewayahVerseUnits';
import {
  getShortLabel,
  type RewayahId,
} from '@/services/rewayah/RewayahIdentity';
import {
  formatHafsReference,
  unitForRouteAnchor,
} from '@/services/verse-annotations/unitAnnotations';

/** The rewayah on screen and its verse units. */
export interface ShownVerses {
  readonly rewayah: RewayahId;
  /**
   * Its units when ready. Null while they load or when they were refused:
   * then no verse of a non-Hafs rewayah can be named (never a Hafs verse
   * under the rewayah's numbering). Not needed for Hafs.
   */
  readonly units: RewayahVerseUnits | null;
}

/** Where a search result, history entry or bookmark chip leads. */
export interface VerseTarget {
  /** Verse to select, in `rewayah`'s numbering (a Hafs key for Hafs). */
  readonly verseKey: string;
  /** The rewayah on screen (the numbering of verseKey). */
  readonly rewayah: RewayahId;
  /** Hafs verse holding the verse's first word: its page is the verse's. */
  readonly pageVerseKey: string;
  /** Storage anchor of the verse ("S:A" or "S:A:W"), for search history. */
  readonly anchor: string;
}

function hafsTarget(hafsKey: string): VerseTarget {
  return {
    verseKey: hafsKey,
    rewayah: 'hafs',
    pageVerseKey: hafsKey,
    anchor: hafsKey,
  };
}

function unitTarget(units: RewayahVerseUnits, unit: VerseUnit): VerseTarget {
  const anchor = units.hafsAnchor(unit);
  return {
    verseKey: unit.key,
    rewayah: units.rewayah,
    pageVerseKey: anchor.hafsKey,
    anchor: anchor.key,
  };
}

/** The shown units, when they are the ready units of the shown rewayah. */
function readyUnits(shown: ShownVerses): RewayahVerseUnits | null {
  return shown.units && shown.units.rewayah === shown.rewayah
    ? shown.units
    : null;
}

/**
 * Verse `surah`:`ayah` typed in the search, in the numbering of the rewayah
 * on screen; null when that rewayah has no such verse (or, for a non-Hafs
 * rewayah, while its verses are not ready). Hafs: validated against the Hafs
 * verse counts, as before.
 */
export function verseQueryTarget(
  surah: number,
  ayah: number,
  shown: ShownVerses,
): VerseTarget | null {
  if (!Number.isInteger(surah) || !Number.isInteger(ayah)) return null;
  if (surah < 1 || surah > 114 || ayah < 1) return null;
  if (shown.rewayah === 'hafs') {
    return ayah <= SURAHS[surah - 1].verses_count
      ? hafsTarget(`${surah}:${ayah}`)
      : null;
  }
  const units = readyUnits(shown);
  const unit = units?.unitByRef(surah, ayah) ?? null;
  return units && unit ? unitTarget(units, unit) : null;
}

/**
 * The verse of the rewayah on screen at a stored anchor ("S:A" or "S:A:W",
 * a Hafs location): the verse holding that word, or the first verse after
 * it when the word is the unnumbered Fatiha basmala of the Madani / Basri
 * counts. Hafs: the anchor's Hafs verse. Null for an invalid anchor and,
 * for a non-Hafs rewayah, while its verses are not ready.
 */
export function anchorTarget(
  anchor: string,
  shown: ShownVerses,
): VerseTarget | null {
  const loc = parseAnchorKey(anchor);
  if (!loc) return null;
  if (shown.rewayah === 'hafs') {
    const hafsKey = `${loc.surah}:${loc.ayah}`;
    return loc.ayah <= SURAHS[loc.surah - 1].verses_count
      ? hafsTarget(hafsKey)
      : null;
  }
  const units = readyUnits(shown);
  const unit = units ? unitForRouteAnchor(anchor, units) : null;
  return units && unit ? unitTarget(units, unit) : null;
}

/** A verse search result's texts, in the numbering of the rewayah on screen. */
export function verseResultTexts(
  target: VerseTarget,
  surahName: string,
): {primary: string; secondary: string} {
  const [, ayah] = target.verseKey.split(':');
  const primary = `${surahName} ${target.verseKey}`;
  // Hafs: exactly as before. Another rewayah says whose numbering it is.
  return target.rewayah === 'hafs'
    ? {primary, secondary: `Verse ${ayah}`}
    : {primary, secondary: `Verse ${ayah} · ${getShortLabel(target.rewayah)}`};
}

/**
 * Search-history label of a verse result: the result's label, plus the
 * rewayah for a non-Hafs one (history outlives the rewayah on screen).
 */
export function verseHistoryLabel(
  target: VerseTarget,
  primary: string,
): string {
  return target.rewayah === 'hafs'
    ? primary
    : `${primary} · ${getShortLabel(target.rewayah)}`;
}

/**
 * The label of a search-history entry with `shown` on screen. A verse entry
 * in Hafs numbers (searched with Hafs on screen, or saved before verse
 * units) says so when another rewayah is on screen ("Al-Fatihah 1:7 ·
 * Hafs"): it opens that Hafs verse. Every other entry reads as it was saved
 * (a non-Hafs verse entry already names its rewayah).
 */
export function historyEntryLabel(
  entry: {type: string; label: string; verse?: number; anchor?: string},
  shown: RewayahId,
): string {
  return entry.type === 'verse' &&
    entry.verse !== undefined &&
    !entry.anchor &&
    shown !== 'hafs'
    ? `${entry.label} · ${getShortLabel('hafs')}`
    : entry.label;
}

/** What a bookmark chip shows and opens. */
export interface BookmarkChipView {
  /**
   * Verse label after the surah name, in the numbering of the rewayah on
   * screen: "2:255", "1:6-7", "Hafs 1:1" (the unnumbered Fatiha basmala of
   * the Madani / Basri counts); null while the verses are not ready.
   */
  readonly label: string | null;
  /** The verse to open; null: open the page of `pageVerseKey`. */
  readonly target: VerseTarget | null;
  /** Hafs verse whose page holds the bookmark. */
  readonly pageVerseKey: string;
}

/**
 * A bookmark row as a chip of the mushaf search, in the rewayah on screen.
 * Hafs on screen: the row's Hafs reference and Hafs verse, exactly as
 * before (a row's surah_number / ayah_number are its anchor's Hafs verse).
 * Another rewayah: the units the row marks (contract section 3: exactly the
 * saved verse for a row of that rewayah, every part of the Hafs verse for a
 * Hafs row; a row of a third rewayah, loading nothing, from its anchored
 * word to the end of that Hafs verse), labelled first-last, opening the
 * first one.
 */
export function bookmarkChipView(
  row: {
    verseKey: string;
    surahNumber: number;
    ayahNumber: number;
    rewayahId?: RewayahId | null;
  },
  shown: ShownVerses,
): BookmarkChipView {
  const pageVerseKey = `${row.surahNumber}:${row.ayahNumber}`;
  if (shown.rewayah === 'hafs') {
    return {
      label: pageVerseKey,
      target: hafsTarget(pageVerseKey),
      pageVerseKey,
    };
  }
  const units = readyUnits(shown);
  if (!units) return {label: null, target: null, pageVerseKey};
  const marked = unitsForStoredVerse(units, {
    verseKey: row.verseKey,
    rewayahId: row.rewayahId ?? 'hafs',
  }).units;
  if (marked.length > 0) {
    return {
      label: formatUnitRangeLabel(marked[0], marked[marked.length - 1]),
      target: unitTarget(units, marked[0]),
      pageVerseKey,
    };
  }
  // No verse of the rewayah on screen holds it (the unnumbered Fatiha
  // basmala): its Hafs reference, opening the verse after it.
  return {
    label: parseAnchorKey(row.verseKey)
      ? formatHafsReference(pageVerseKey)
      : null,
    target: anchorTarget(row.verseKey, shown),
    pageVerseKey,
  };
}
