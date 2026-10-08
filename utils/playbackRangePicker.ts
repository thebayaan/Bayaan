// @ai-generated
/**
 * Verse numbering of the mushaf player's range pickers (Starting / Ending
 * Verse in MushafPlayerOptionsSheet; verse-units contract 4.2): the reader
 * picks among the verses of the mushaf on screen, in its own numbering, and
 * playback gets those verse units (setUnitRange, startPlayback with a unit).
 *
 * - Hafs mushaf: Hafs verse keys, exactly as before (setRange with Hafs
 *   verses).
 * - Another rewayah's mushaf with its verse units ready: unit keys 'S:A' of
 *   that rewayah; a surah's grid is its own verse count.
 * - Another rewayah's mushaf whose verse units are not available (loading,
 *   refused): Hafs verse keys labelled as Hafs references, never as that
 *   rewayah's numbers.
 */

import {SURAHS} from '@/data/surahData';
import type {
  RewayahVerseUnits,
  VerseUnit,
} from '@/services/mushaf/RewayahVerseUnits';
import type {RewayahId} from '@/services/rewayah/RewayahIdentity';
import {
  selectPendingStartUnit,
  selectRangeUnits,
  type MushafPlayerStoreState,
} from '@/store/mushafPlayerStore';
import {readyVerseUnits} from '@/utils/playbackVerseUnits';

export interface RangePickerNumbering {
  /** Numbering of the picker keys: the mushaf's rewayah, or 'hafs'. */
  readonly rewayah: RewayahId;
  /** The mushaf rewayah's verse units; null when the keys are Hafs keys. */
  readonly units: RewayahVerseUnits | null;
  /** Hafs keys in another rewayah's mushaf: labels name them as Hafs. */
  readonly hafsFallback: boolean;
}

/** The pickers' numbering for a mushaf of `mushafRewayah`. */
export function rangePickerNumbering(
  mushafRewayah: RewayahId,
  units: RewayahVerseUnits | null,
): RangePickerNumbering {
  if (mushafRewayah !== 'hafs' && units && units.rewayah === mushafRewayah) {
    return {rewayah: mushafRewayah, units, hafsFallback: false};
  }
  return {
    rewayah: 'hafs',
    units: null,
    hafsFallback: mushafRewayah !== 'hafs',
  };
}

/** Verses of `surah` in the pickers' numbering (the ayah grid). */
export function pickerVerseCount(
  n: RangePickerNumbering,
  surah: number,
): number {
  if (n.units) return n.units.verseCount(surah);
  return SURAHS[surah - 1]?.verses_count ?? 1;
}

/** "Al-Baqarah 2:255"; "Al-Fatihah 1:7 (Hafs)" for Hafs fallback keys. */
export function pickerVerseLabel(n: RangePickerNumbering, key: string): string {
  const [s] = key.split(':').map(Number);
  if (!(s >= 1 && s <= 114)) return key;
  const label = `${SURAHS[s - 1].name} ${key}`;
  return n.hafsFallback ? `${label} (Hafs)` : label;
}

/**
 * The verse of `units` holding the slot a Hafs key or anchor names ('S:A'
 * or 'S:A:W'); the first verse after it for the unnumbered Fatiha basmala.
 */
function unitAtHafs(units: RewayahVerseUnits, key: string): VerseUnit | null {
  const id = units.wordIdForAnchor(key);
  return id === null ? null : units.unitAtOrAfterWordId(id);
}

type PickerStoreState = Pick<
  MushafPlayerStoreState,
  | 'rangeStart'
  | 'rangeEnd'
  | 'rangeUnits'
  | 'pendingStartUnit'
  | 'pendingStartVerseKey'
>;

/**
 * Default Starting / Ending Verse: the range already set, else the first and
 * last verse of the page (`pageHafsKeys`: its Hafs verse keys in order).
 */
export function pickerDefaults(
  n: RangePickerNumbering,
  s: PickerStoreState,
  pageHafsKeys: readonly string[],
): {start: string; end: string} {
  const {units} = n;
  if (!units) {
    return {
      start: s.rangeStart
        ? `${s.rangeStart.surah}:${s.rangeStart.ayah}`
        : (pageHafsKeys[0] ?? '1:1'),
      end: s.rangeEnd
        ? `${s.rangeEnd.surah}:${s.rangeEnd.ayah}`
        : (pageHafsKeys[pageHafsKeys.length - 1] ?? '1:7'),
    };
  }
  const range = selectRangeUnits(s);
  const pageUnits = units.unitsForHafsKeys(pageHafsKeys);
  const fallback = units.units[0]?.key ?? '1:1';
  let start = pageUnits[0]?.key ?? fallback;
  let end = pageUnits[pageUnits.length - 1]?.key ?? start;
  if (range && range.first.rewayah === n.rewayah) {
    start = range.first.key;
    end = range.last.key;
  } else {
    if (s.rangeStart) {
      const key = `${s.rangeStart.surah}:${s.rangeStart.ayah}`;
      start = unitAtHafs(units, key)?.key ?? start;
    }
    if (s.rangeEnd) {
      const holding = units.unitsForHafsKey(
        `${s.rangeEnd.surah}:${s.rangeEnd.ayah}`,
      );
      end = holding[holding.length - 1]?.key ?? end;
    }
  }
  return {start, end};
}

/**
 * The pending start (Play / Repeat asked before a reciter was chosen) in
 * the pickers' numbering, or null.
 */
export function pickerPendingStart(
  n: RangePickerNumbering,
  s: PickerStoreState,
): string | null {
  if (!n.units) return s.pendingStartVerseKey;
  const pending = selectPendingStartUnit(s);
  if (pending && pending.rewayah === n.rewayah) return pending.key;
  // A verse of another rewayah: the verse of this mushaf holding its first
  // word (its anchor; every words DB shares the word ids), not the start of
  // its first Hafs verse, which for the later part of a split Hafs verse is
  // the verse before.
  const own =
    pending && pending.rewayah !== 'hafs'
      ? readyVerseUnits(pending.rewayah)?.unitByKey(pending.key)
      : null;
  if (own) return n.units.unitAtOrAfterWordId(own.firstWordId)?.key ?? null;
  if (!s.pendingStartVerseKey) return null;
  // A Hafs verse (or a unit of another rewayah whose units are not loaded,
  // by its Hafs verse): the verse of this mushaf holding its start.
  return unitAtHafs(n.units, s.pendingStartVerseKey)?.key ?? null;
}

export type PickerSelection =
  | {kind: 'units'; first: VerseUnit; last: VerseUnit}
  | {
      kind: 'hafs';
      start: {surah: number; ayah: number};
      end: {surah: number; ayah: number};
    };

/**
 * What Play applies: verse units of the mushaf's rewayah (setUnitRange and
 * startPlayback with the first unit), or Hafs verses (setRange and
 * startPlayback with the start key, as before). Null for keys that name no
 * verse in the pickers' numbering.
 */
export function pickerSelection(
  n: RangePickerNumbering,
  startKey: string,
  endKey: string,
): PickerSelection | null {
  if (n.units) {
    const first = n.units.unitByKey(startKey);
    const last = n.units.unitByKey(endKey);
    return first && last ? {kind: 'units', first, last} : null;
  }
  const [startS, startA] = startKey.split(':').map(Number);
  const [endS, endA] = endKey.split(':').map(Number);
  if (![startS, startA, endS, endA].every(Number.isInteger)) return null;
  return {
    kind: 'hafs',
    start: {surah: startS, ayah: startA},
    end: {surah: endS, ayah: endA},
  };
}
