import {digitalKhattDataService} from './DigitalKhattDataService';
import {getLineWordSpans} from './lineWordSpans';
// @ai-start
import {
  formatAnchorKey,
  parseAnchorKey,
  parseUnitKey,
  unitsForStoredVerse,
  type RewayahVerseUnits,
  type StoredVerseRef,
  type VerseUnit,
} from './RewayahVerseUnits';
import {rewayahVerseUnitsService} from './RewayahVerseUnitsService';
import {hafsVerseCount} from './RewayahVerseMapService';
import type {SelectedVerseUnit} from '@/store/mushafVerseSelectionStore';
// @ai-end
import type {RewayahId} from '@/services/rewayah/RewayahIdentity';

export interface VerseSegment {
  verseKey: string; // "2:255"
  surahNumber: number;
  ayahNumber: number;
  startCharIndex: number; // in line text
  endCharIndex: number; // in line text
  firstWordId: number;
  lastWordId: number;
}

// @ai-start
/** Key and numbers of one verse unit ('S:A' in its rewayah's numbering). */
export type VerseUnitRef = Pick<VerseUnit, 'key' | 'surah' | 'ayah'>;

/**
 * The verse units of the text the mushaf shows (decision 3 of Release 1):
 * the rewayah's OWN verses, in its own numbering, as runs of word slots
 * (RewayahVerseUnits.ts). Every mushaf gesture (tap, long-press, iOS
 * drag-select) and every verse overlay (selection, follow-along, bookmarks,
 * colour highlights, themes) works in these units. Keys are unit keys 'S:A'
 * of `rewayah`; storage stays Hafs-keyed through each unit's anchor.
 */
export interface ShownVerseUnits {
  /** Rewayah of the shown text: the numbering of every unit key here. */
  readonly rewayah: RewayahId;
  /** The units model; null for Hafs (identity, see HAFS_SHOWN_UNITS). */
  readonly units: RewayahVerseUnits | null;
  /** The unit holding a word slot; null for the unnumbered Fatiha basmala. */
  unitOfSlot(wordId: number, hafsVerseKey: string): VerseUnitRef | null;
  /** Key, storage anchor and Hafs verses of a unit key; null if no unit. */
  describe(unitKey: string): SelectedVerseUnit | null;
  /** Units holding words of these Hafs verses (h2r), reading order. */
  unitKeysForHafsKeys(hafsKeys: readonly string[]): string[];
  /** Unit key of verse `surah`:`ayah` in this rewayah's numbering, or null. */
  unitKeyByRef(surah: number, ayah: number): string | null;
  /** Units a stored bookmark / note / highlight row marks (storage rule). */
  unitKeysForStoredVerse(row: StoredVerseRef): string[];
  /**
   * Key of the unit holding the slot a Hafs anchor names ('S:A' or 'S:A:W',
   * e.g. a stored verse_key in this rewayah); null for none.
   */
  unitKeyForAnchor(anchorKey: string): string | null;
  /**
   * Reading-order position of the slot a Hafs anchor names (slots of
   * earlier verses and earlier words come first);
   * Number.MAX_SAFE_INTEGER when it names no slot. Breaks ties between
   * stored rows marking one unit the way the annotations do (the earlier
   * anchor wins).
   */
  anchorOrder(anchorKey: string): number;
}

/**
 * A Hafs verse key ('S:A' of an existing Hafs verse, written as the app
 * writes it: no leading zeros), parsed; else null. A malformed stored key
 * such as '02:255' names nothing, as with the Hafs verse segments before.
 */
function hafsVerseRef(key: string): {surah: number; ayah: number} | null {
  const ref = parseUnitKey(key);
  return ref &&
    ref.ayah <= hafsVerseCount(ref.surah) &&
    `${ref.surah}:${ref.ayah}` === key
    ? ref
    : null;
}

/**
 * A Hafs anchor ('S:A', or 'S:A:W' with W > 1) of an existing Hafs verse,
 * written in its canonical form (formatAnchorKey); else null.
 */
function hafsAnchorRef(
  anchorKey: string,
): {surah: number; ayah: number; word: number} | null {
  const loc = parseAnchorKey(anchorKey);
  if (!loc) return null;
  const hafsKey = `${loc.surah}:${loc.ayah}`;
  return formatAnchorKey(hafsKey, loc.word) === anchorKey &&
    hafsVerseRef(hafsKey)
    ? loc
    : null;
}

const hafsRefs = new Map<string, VerseUnitRef>();

/**
 * Hafs without building its units: a Hafs unit IS its Hafs verse (same key,
 * slots, anchor and Hafs key; invariant 6 of the verse-units contract), so
 * every answer comes from the slot's own Hafs verse key. The Hafs mushaf
 * therefore pays no units build and paints exactly what it painted before;
 * the all-DB test proves these answers equal to the units built from the
 * Hafs words DB.
 */
export const HAFS_SHOWN_UNITS: ShownVerseUnits = {
  rewayah: 'hafs',
  units: null,
  unitOfSlot(_wordId, hafsVerseKey) {
    let ref = hafsRefs.get(hafsVerseKey);
    if (!ref) {
      const parts = hafsVerseKey.split(':');
      ref = {
        key: hafsVerseKey,
        surah: parseInt(parts[0], 10),
        ayah: parseInt(parts[1], 10),
      };
      hafsRefs.set(hafsVerseKey, ref);
    }
    return ref;
  },
  describe(unitKey) {
    if (!hafsVerseRef(unitKey)) return null;
    return {key: unitKey, anchor: unitKey, hafsKeys: [unitKey]};
  },
  unitKeysForHafsKeys: hafsKeys => [
    ...new Set(hafsKeys.filter(key => hafsVerseRef(key) !== null)),
  ],
  unitKeyByRef(surah, ayah) {
    const key = `${surah}:${ayah}`;
    return hafsVerseRef(key) ? key : null;
  },
  unitKeysForStoredVerse(row) {
    // Shown in Hafs, every row marks the Hafs verse of its anchor (a Hafs
    // row, or another rewayah's verse starting in that Hafs verse).
    const key = HAFS_SHOWN_UNITS.unitKeyForAnchor(row.verseKey);
    return key ? [key] : [];
  },
  unitKeyForAnchor(anchorKey) {
    const loc = hafsAnchorRef(anchorKey);
    return loc ? `${loc.surah}:${loc.ayah}` : null;
  },
  anchorOrder(anchorKey) {
    // Slot ids follow (surah, ayah, word): this orders anchors as their
    // slot ids do (ayah and word have at most 3 digits).
    const loc = hafsAnchorRef(anchorKey);
    return loc
      ? loc.surah * 1_000_000 + loc.ayah * 1_000 + loc.word
      : Number.MAX_SAFE_INTEGER;
  },
};

/** ShownVerseUnits of a non-Hafs rewayah, answered by its units model. */
export function shownVerseUnitsOf(units: RewayahVerseUnits): ShownVerseUnits {
  return {
    rewayah: units.rewayah,
    units,
    unitOfSlot: wordId => units.unitForWordId(wordId),
    describe(unitKey) {
      const unit = units.unitByKey(unitKey);
      if (!unit) return null;
      return {
        key: unit.key,
        anchor: units.hafsAnchor(unit).key,
        hafsKeys: [...unit.hafsKeys],
      };
    },
    unitKeysForHafsKeys: hafsKeys =>
      units.unitsForHafsKeys(hafsKeys).map(u => u.key),
    unitKeyByRef: (surah, ayah) => units.unitByRef(surah, ayah)?.key ?? null,
    // Rows of other rewayat use the inexact mapping: no other rewayah's
    // units are built for a tint (verse-units contract, section 3).
    unitKeysForStoredVerse: row =>
      unitsForStoredVerse(units, row).units.map(u => u.key),
    unitKeyForAnchor: anchorKey => units.unitForAnchor(anchorKey)?.key ?? null,
    anchorOrder: anchorKey =>
      units.wordIdForAnchor(anchorKey) ?? Number.MAX_SAFE_INTEGER,
  };
}

const NO_SEGMENTS: readonly VerseSegment[] = Object.freeze([]);
// @ai-end

/**
 * Verse segments per mushaf line (verse highlights, playback/selection tints
 * and long-press hit-testing). Char ranges index into the exact string
 * DigitalKhattDataService.getLineText() renders; they come from the shared
 * span model (lineWordSpans.ts), so blank slots and multi-token slots never
 * shift a verse boundary.
 *
 * Two groupings of the same spans (@ai):
 *  - unit segments (getUnitSegments, getOrderedUnitKeysForPage,
 *    findUnitAtCharIndex, getUnitSegmentsForPage): one per VERSE UNIT of the
 *    shown text, keys in its rewayah's numbering. A segment ends where a
 *    unit ends, also at an inline verse marker in the middle of a line
 *    ('word ۝N' closes the unit; the next slot starts the next one). The
 *    unnumbered Fatiha basmala of the Madani / Basri counts has no segment.
 *    When the units of a non-Hafs text are refused (RewayahVerseUnitsService
 *    status 'error'), there are no unit segments at all: nothing is
 *    selectable or painted as a verse rather than a Hafs verse under the
 *    rewayah's name. Mushaf gestures and verse overlays use these.
 *  - Hafs verse segments (getVerseSegments, getOrderedVerseKeysForPage,
 *    findVerseAtCharIndex, getVerseSegmentsForPage): one per HAFS verse,
 *    unchanged, for Hafs-aligned callers (themes, playback page turns,
 *    reading-mode rows, player range defaults).
 * For Hafs both groupings are identical (proved on all 604 pages).
 *
 * Caches are tied to the words they were computed from: they are dropped
 * automatically whenever the active rewayah or
 * digitalKhattDataService.getCacheVersion() changes, so no char range from a
 * previous rewayah (or a previous copy of the data) survives a switch. The
 * shown units are resolved once per (rewayah, cache version), so they belong
 * to the same words (their dataKey is the rewayah's data identity, C5).
 */
class MushafVerseMapService {
  // Cache: key = "pageNumber:lineIndex"
  private cache: Map<string, VerseSegment[]> = new Map();
  // Cache: key = pageNumber
  private orderedVerseKeysCache: Map<number, string[]> = new Map();
  // @ai-start
  // Unit-segment caches (same keys as above) and the units they used:
  // undefined = not resolved yet for this data, null = none (fail closed).
  private unitCache: Map<string, readonly VerseSegment[]> = new Map();
  private orderedUnitKeysCache: Map<number, string[]> = new Map();
  private shownUnits: ShownVerseUnits | null | undefined = undefined;
  // @ai-end
  // Words cache (rewayah + cache version) the caches above were computed on.
  private dataRewayah: RewayahId | null = null;
  private dataVersion = -1;

  /** Drops every cached segment. Also happens automatically on data change. */
  clear(): void {
    this.cache.clear();
    this.orderedVerseKeysCache.clear();
    // @ai-start
    this.unitCache.clear();
    this.orderedUnitKeysCache.clear();
    this.shownUnits = undefined;
    // @ai-end
    this.dataRewayah = null;
    this.dataVersion = -1;
  }

  private ensureFresh(): void {
    const rewayah = digitalKhattDataService.rewayah;
    const version = digitalKhattDataService.getCacheVersion();
    if (rewayah !== this.dataRewayah || version !== this.dataVersion) {
      this.cache.clear();
      this.orderedVerseKeysCache.clear();
      // @ai-start
      this.unitCache.clear();
      this.orderedUnitKeysCache.clear();
      this.shownUnits = undefined;
      // @ai-end
      this.dataRewayah = rewayah;
      this.dataVersion = version;
    }
  }

  getVerseSegments(pageNumber: number, lineIndex: number): VerseSegment[] {
    this.ensureFresh();
    const key = `${pageNumber}:${lineIndex}`;
    const cached = this.cache.get(key);
    if (cached) return cached;

    const segments = this.computeVerseSegments(pageNumber, lineIndex);
    this.cache.set(key, segments);
    return segments;
  }

  private computeVerseSegments(
    pageNumber: number,
    lineIndex: number,
  ): VerseSegment[] {
    const lines = digitalKhattDataService.getPageLines(pageNumber);
    if (lineIndex >= lines.length) return [];

    // Surah-name and basmallah lines have no word slots, hence no segments.
    const spans = getLineWordSpans(lines[lineIndex], digitalKhattDataService);
    if (spans.length === 0) return [];

    const segments: VerseSegment[] = [];
    let currentSegment: VerseSegment | null = null;

    for (const span of spans) {
      const verseKey = span.info.verseKey;

      if (currentSegment && currentSegment.verseKey === verseKey) {
        // Extend current segment (covers the space before this slot too)
        currentSegment.endCharIndex = span.end;
        currentSegment.lastWordId = span.wordId;
      } else {
        // Start new segment
        const parts: string[] = verseKey.split(':');
        currentSegment = {
          verseKey,
          surahNumber: parseInt(parts[0], 10),
          ayahNumber: parseInt(parts[1], 10),
          startCharIndex: span.start,
          endCharIndex: span.end,
          firstWordId: span.wordId,
          lastWordId: span.wordId,
        };
        segments.push(currentSegment);
      }
    }

    return segments;
  }

  getOrderedVerseKeysForPage(pageNumber: number): string[] {
    this.ensureFresh();
    const cached = this.orderedVerseKeysCache.get(pageNumber);
    if (cached) return cached;

    const lines = digitalKhattDataService.getPageLines(pageNumber);
    const seen = new Set<string>();
    const ordered: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const segments = this.getVerseSegments(pageNumber, i);
      for (const segment of segments) {
        if (!seen.has(segment.verseKey)) {
          seen.add(segment.verseKey);
          ordered.push(segment.verseKey);
        }
      }
    }

    this.orderedVerseKeysCache.set(pageNumber, ordered);
    return ordered;
  }

  findVerseAtCharIndex(
    pageNumber: number,
    lineIndex: number,
    charIndex: number,
  ): VerseSegment | null {
    const segments = this.getVerseSegments(pageNumber, lineIndex);
    for (const segment of segments) {
      if (
        charIndex >= segment.startCharIndex &&
        charIndex <= segment.endCharIndex
      ) {
        return segment;
      }
    }
    return null;
  }

  getVerseSegmentsForPage(
    pageNumber: number,
    verseKey: string,
  ): {lineIndex: number; segment: VerseSegment}[] {
    const lines = digitalKhattDataService.getPageLines(pageNumber);
    const results: {lineIndex: number; segment: VerseSegment}[] = [];

    for (let i = 0; i < lines.length; i++) {
      const segments = this.getVerseSegments(pageNumber, i);
      for (const segment of segments) {
        if (segment.verseKey === verseKey) {
          results.push({lineIndex: i, segment});
        }
      }
    }

    return results;
  }

  // @ai-start
  // ── Verse units of the shown text ────────────────────────────────────────

  /**
   * The verse units of the text the mushaf shows (the active DK words), or
   * null when a non-Hafs text has no usable units (refused: no verse is
   * selectable or painted). Resolved once per data version; for a non-Hafs
   * rewayah the first call builds its units (RewayahVerseUnitsService).
   * A null while those words are still loading is not remembered: the next
   * call asks again (the load also bumps the cache version).
   */
  getShownVerseUnits(): ShownVerseUnits | null {
    this.ensureFresh();
    if (this.shownUnits === undefined) {
      const rewayah = digitalKhattDataService.rewayah;
      if (rewayah === 'hafs') {
        this.shownUnits = HAFS_SHOWN_UNITS;
      } else {
        let units: RewayahVerseUnits | null = null;
        let refused = false;
        try {
          units = rewayahVerseUnitsService.get(rewayah);
          if (!units) {
            const status = rewayahVerseUnitsService.getStatus(rewayah);
            refused = status !== 'loading' && status !== 'idle';
          }
        } catch (error) {
          // Never break the page over the units: fail closed instead.
          refused = true;
          console.error(
            `[MushafVerseMapService] ${rewayah} verse units unavailable:`,
            error,
          );
        }
        if (units) this.shownUnits = shownVerseUnitsOf(units);
        else if (refused) this.shownUnits = null;
        else return null; // not loaded yet: resolve again on the next call
      }
    }
    return this.shownUnits;
  }

  /** Segments of the shown text's verse units on one line (see class doc). */
  getUnitSegments(
    pageNumber: number,
    lineIndex: number,
  ): readonly VerseSegment[] {
    this.ensureFresh();
    const key = `${pageNumber}:${lineIndex}`;
    const cached = this.unitCache.get(key);
    if (cached) return cached;

    const shown = this.getShownVerseUnits();
    // Units not resolved yet (still loading): nothing to cache.
    if (!shown && this.shownUnits === undefined) return NO_SEGMENTS;
    const segments = shown
      ? this.computeUnitSegments(shown, pageNumber, lineIndex)
      : NO_SEGMENTS;
    this.unitCache.set(key, segments);
    return segments;
  }

  private computeUnitSegments(
    shown: ShownVerseUnits,
    pageNumber: number,
    lineIndex: number,
  ): VerseSegment[] {
    const lines = digitalKhattDataService.getPageLines(pageNumber);
    if (lineIndex >= lines.length) return [];

    // Surah-name and basmallah lines have no word slots, hence no segments.
    const spans = getLineWordSpans(lines[lineIndex], digitalKhattDataService);
    if (spans.length === 0) return [];

    const segments: VerseSegment[] = [];
    let current: VerseSegment | null = null;

    for (const span of spans) {
      const unit = shown.unitOfSlot(span.wordId, span.info.verseKey);
      if (!unit) {
        // The unnumbered Fatiha basmala (Madani / Basri counts): no verse.
        current = null;
        continue;
      }
      if (current && current.verseKey === unit.key) {
        // Same unit: extend over this slot and the space before it.
        current.endCharIndex = span.end;
        current.lastWordId = span.wordId;
      } else {
        // A new unit starts here, also right after an inline verse marker.
        current = {
          verseKey: unit.key,
          surahNumber: unit.surah,
          ayahNumber: unit.ayah,
          startCharIndex: span.start,
          endCharIndex: span.end,
          firstWordId: span.wordId,
          lastWordId: span.wordId,
        };
        segments.push(current);
      }
    }

    return segments;
  }

  /** Unit keys of a page in reading order (drag-select ranges, themes). */
  getOrderedUnitKeysForPage(pageNumber: number): string[] {
    this.ensureFresh();
    const cached = this.orderedUnitKeysCache.get(pageNumber);
    if (cached) return cached;

    const lines = digitalKhattDataService.getPageLines(pageNumber);
    const seen = new Set<string>();
    const ordered: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      for (const segment of this.getUnitSegments(pageNumber, i)) {
        if (!seen.has(segment.verseKey)) {
          seen.add(segment.verseKey);
          ordered.push(segment.verseKey);
        }
      }
    }

    // Cached only once the shown units are resolved (not while loading).
    if (this.shownUnits !== undefined) {
      this.orderedUnitKeysCache.set(pageNumber, ordered);
    }
    return ordered;
  }

  /** Hit-test: the unit segment under a char index of a line, or null. */
  findUnitAtCharIndex(
    pageNumber: number,
    lineIndex: number,
    charIndex: number,
  ): VerseSegment | null {
    for (const segment of this.getUnitSegments(pageNumber, lineIndex)) {
      if (
        charIndex >= segment.startCharIndex &&
        charIndex <= segment.endCharIndex
      ) {
        return segment;
      }
    }
    return null;
  }

  /** Every segment of one unit on a page (what a verse overlay paints). */
  getUnitSegmentsForPage(
    pageNumber: number,
    unitKey: string,
  ): {lineIndex: number; segment: VerseSegment}[] {
    const lines = digitalKhattDataService.getPageLines(pageNumber);
    const results: {lineIndex: number; segment: VerseSegment}[] = [];

    for (let i = 0; i < lines.length; i++) {
      for (const segment of this.getUnitSegments(pageNumber, i)) {
        if (segment.verseKey === unitKey) {
          results.push({lineIndex: i, segment});
        }
      }
    }

    return results;
  }
  // @ai-end
}

export const mushafVerseMapService = new MushafVerseMapService();

// @ai-start
/**
 * The units to put in the mushaf selection store for unit keys of the shown
 * text (CONTRACT 4.7: keys always travel with their rewayah); null when the
 * text has no units or none of the keys is a unit of it.
 */
export function selectionForUnitKeys(
  unitKeys: readonly string[],
): {rewayah: RewayahId; units: SelectedVerseUnit[]} | null {
  const shown = mushafVerseMapService.getShownVerseUnits();
  if (!shown) return null;
  const units: SelectedVerseUnit[] = [];
  for (const key of unitKeys) {
    const unit = shown.describe(key);
    if (unit) units.push(unit);
  }
  return units.length > 0 ? {rewayah: shown.rewayah, units} : null;
}

/**
 * The selection for a stored Hafs anchor ('S:A' or 'S:A:W': a bookmark,
 * note or highlight opened from a list, a route param) in the shown text:
 * exactly the unit holding that slot (CONTRACT 4.4: anchors in, units
 * selected), with its rewayah. Null when the text has no units or the
 * anchor names no unit (invalid, or the unnumbered Fatiha basmala).
 */
export function selectionForAnchor(
  anchorKey: string,
): {rewayah: RewayahId; units: SelectedVerseUnit[]} | null {
  const shown = mushafVerseMapService.getShownVerseUnits();
  const key = shown?.unitKeyForAnchor(anchorKey) ?? null;
  return key ? selectionForUnitKeys([key]) : null;
}

/** Where a navigation to one verse lands (see verseNavigationTarget). */
export interface VerseNavigationTarget {
  readonly rewayah: RewayahId;
  /** Select this HAFS verse (painted as the shown units holding it). */
  readonly hafsKey: string | null;
  /** Or select exactly this unit of `rewayah`. */
  readonly unit: SelectedVerseUnit | null;
  /** Hafs verse the vertical views scroll to; null: scroll to the page. */
  readonly scrollHafsKey: string | null;
}

/**
 * Navigation to verse `verseKey` numbered in `rewayah` (mushaf search,
 * bookmark chips; CONTRACT 4.4). A Hafs key selects that Hafs verse, as
 * before. A key in the shown rewayah's own numbering selects exactly that
 * unit and scrolls to its anchor's Hafs verse. A key of any other numbering
 * (or while the shown text has no units) selects nothing: never a verse
 * that merely has the same number.
 */
export function verseNavigationTarget(
  verseKey: string,
  rewayah: RewayahId,
): VerseNavigationTarget {
  if (rewayah === 'hafs') {
    return {rewayah, hafsKey: verseKey, unit: null, scrollHafsKey: verseKey};
  }
  const selection = selectionForUnitKeys([verseKey]);
  const unit = selection?.rewayah === rewayah ? selection.units[0] : null;
  const anchor = unit ? parseAnchorKey(unit.anchor) : null;
  return {
    rewayah,
    hafsKey: null,
    unit: unit && anchor ? unit : null,
    scrollHafsKey: anchor ? `${anchor.surah}:${anchor.ayah}` : null,
  };
}
// @ai-end
