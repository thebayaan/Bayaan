/**
 * Verse numbering of ayah timing sets.
 *
 * Timing entries carry the verse numbers of their upstream source. Most
 * non-Hafs recitations are numbered by their own rewayah (Madani count for
 * Warsh / Qalun, Makki for al-Bazzi / Qunbul, the KFGQPC count for al-Duri /
 * al-Susi), a few are Hafs-numbered, and an occasional surah follows neither.
 * Everything the app highlights, pages to or seeks from is keyed by Hafs verse
 * keys, so an entry must be translated before use and a Hafs verse must be
 * translated back into timing entries before seeking.
 *
 * This module is pure: it decides the numbering of one (timing set, surah)
 * from the entry count and the verse maps, and builds a TimingNumbering that
 * answers every translation question for that surah. The async part (the
 * set-level vote that needs other surahs' timings) lives in
 * services/timestamps/TimingNumberingService.ts.
 */

import type {AyahTimestamp, AyahTrackingState} from '@/types/timestamps';
import type {RewayahId} from '@/services/rewayah/RewayahIdentity';
import {
  hafsVerseCount,
  parseVerseKey,
  type RewayahVerseMapService,
} from '@/services/mushaf/RewayahVerseMapService';

/**
 * - 'hafs': entries are Hafs verse numbers (identity).
 * - 'riwayah': entries are the reciter's rewayah verse numbers; translate
 *   through the verse map.
 * - 'disabled': the numbering cannot be established; follow-along highlight
 *   and verse seeking are switched off for the surah instead of guessing.
 */
export type TimingNumberingMode = 'hafs' | 'riwayah' | 'disabled';

/**
 * Set-level numbering, decided by a vote over the surahs whose Hafs and
 * rewayah verse counts differ. Needed only for surahs where both counts are
 * equal but the verse boundaries differ (e.g. al-Fatihah, al-A'raf).
 */
export type TimingSetClass = 'hafs' | 'riwayah' | 'unknown';

/** Share of discriminating surahs that must agree for a set-level verdict. */
export const SET_CLASS_THRESHOLD = 0.95;

export interface TimingEntryStats {
  /** Number of entries numbered 1 or above (an ayah-0 pre-roll is ignored). */
  count: number;
  /** True when those entries are numbered exactly 1..count in order. */
  contiguous: boolean;
}

export function getTimingEntryStats(
  entries: readonly AyahTimestamp[],
): TimingEntryStats {
  let count = 0;
  let contiguous = true;
  for (const e of entries) {
    if (e.ayahNumber === 0 && count === 0) continue; // pre-roll (basmala)
    count += 1;
    if (e.ayahNumber !== count) contiguous = false;
  }
  return {count, contiguous: contiguous && count > 0};
}

export interface SurahNumberingInput {
  /** Rewayah of the recitation; null when it cannot be resolved. */
  reciterRewayah: RewayahId | null;
  surah: number;
  entries: readonly AyahTimestamp[];
  /** Set-level class, or null when not (yet) known. */
  setClass: TimingSetClass | null;
}

export interface SurahNumberingDecision {
  mode: TimingNumberingMode;
  /** Set when the decision needs the set-level class and it is not known. */
  needsSetClass: boolean;
  reason: string;
}

/**
 * Decide how the entries of one surah are numbered.
 *
 *  - Hafs recitations keep the historical identity behaviour, whatever the
 *    entries look like.
 *  - Rewayat with a verse map: count == Hafs count != rewayah count -> 'hafs';
 *    count == rewayah count != Hafs count -> 'riwayah'; both counts equal ->
 *    identity when the map is identity for the surah, else the set-level
 *    class; anything else -> 'disabled'.
 *  - Rewayat that should have a map but whose map is unavailable -> 'disabled'.
 *  - Unknown rewayat (no map): count == Hafs count -> 'hafs', else 'disabled'.
 */
export function decideSurahNumbering(
  input: SurahNumberingInput,
  verseMap: RewayahVerseMapService,
): SurahNumberingDecision {
  const {reciterRewayah, surah, entries, setClass} = input;
  const decide = (
    mode: TimingNumberingMode,
    reason: string,
    needsSetClass = false,
  ): SurahNumberingDecision => ({mode, reason, needsSetClass});

  if (reciterRewayah === 'hafs') {
    return decide('hafs', 'Hafs recitation');
  }
  const hafsCount = hafsVerseCount(surah);
  if (hafsCount === 0) return decide('disabled', 'invalid surah');
  const {count, contiguous} = getTimingEntryStats(entries);
  if (!contiguous) {
    return decide('disabled', 'entries are not numbered 1..n');
  }

  if (reciterRewayah && verseMap.hasVerseMap(reciterRewayah)) {
    const riwayahCount = verseMap.verseCount(reciterRewayah, surah)!;
    if (count === hafsCount && count !== riwayahCount) {
      return decide('hafs', 'entry count matches the Hafs count');
    }
    if (count === riwayahCount && count !== hafsCount) {
      return decide('riwayah', 'entry count matches the rewayah count');
    }
    if (count === hafsCount && count === riwayahCount) {
      if (verseMap.isIdentitySurah(reciterRewayah, surah)) {
        return decide('hafs', 'surah is numbered identically in both counts');
      }
      if (setClass === 'hafs') {
        return decide('hafs', 'equal counts; set is Hafs-numbered');
      }
      if (setClass === 'riwayah') {
        return decide('riwayah', 'equal counts; set is rewayah-numbered');
      }
      return decide(
        'disabled',
        setClass === 'unknown'
          ? 'equal counts with different boundaries; set numbering unknown'
          : 'equal counts with different boundaries; set numbering not resolved',
        setClass === null,
      );
    }
    return decide(
      'disabled',
      `entry count ${count} matches neither Hafs (${hafsCount}) nor the rewayah (${riwayahCount})`,
    );
  }

  if (reciterRewayah && verseMap.expectsVerseMap(reciterRewayah)) {
    return decide('disabled', 'verse map unavailable');
  }
  if (count === hafsCount) {
    return decide('hafs', 'unknown rewayah; entry count matches Hafs');
  }
  return decide(
    'disabled',
    'unknown rewayah numbering and the entry count differs from Hafs',
  );
}

/**
 * Set-level verdict from per-surah observations on discriminating surahs.
 * Returns null when there are too few observations to decide.
 */
export function classifyTimingSet(
  votes: {hafs: number; riwayah: number; neither: number},
  minObservations = 3,
): TimingSetClass | null {
  const total = votes.hafs + votes.riwayah + votes.neither;
  if (total < minObservations) return null;
  if (votes.hafs / total >= SET_CLASS_THRESHOLD) return 'hafs';
  if (votes.riwayah / total >= SET_CLASS_THRESHOLD) return 'riwayah';
  return 'unknown';
}

/**
 * Translation of one surah of one timing set. "Entry ayah" always means the
 * ayahNumber carried by a timing entry (the set's own numbering); "Hafs ayah"
 * means the Hafs verse number used by the mushaf and the verse lists.
 *
 * A Hafs verse that no reciter verse contains (only the Fatiha basmala, Hafs
 * 1:1, in the Madani and Basri counts: there it is recited before verse 1
 * but is not a verse) resolves to the NEAREST REAL RECITER VERSE for every
 * playback unit: a start, a range end and a repeat unit all land on a timing
 * entry the reciter actually recites (for 1:1, the reciter's verse 1 =
 * Hafs 1:2), never on nothing.
 */
export interface TimingNumbering {
  readonly surah: number;
  readonly mode: TimingNumberingMode;
  readonly reciterRewayah: RewayahId | null;
  readonly reason: string;
  /** Hafs verse keys recited by an entry, in order. Empty when unknown. */
  hafsKeysForEntry(entryAyah: number): string[];
  /** Entry ayahs whose recitation contains Hafs verse `hafsAyah`, in order. */
  entryAyahsForHafsAyah(hafsAyah: number): number[];
  /**
   * Entry where playback of Hafs verse `hafsAyah` starts: the first entry
   * containing it; for a rewayah-numbered surah, the nearest real reciter
   * verse when no entry contains it (the next entry, else the previous one;
   * e.g. the Fatiha basmala in the Madani count starts at the reciter's
   * verse 1). Null when no verse-level start exists.
   */
  startEntryForHafsAyah(hafsAyah: number): AyahTimestamp | null;
  /**
   * Last entry ayah of a range ending at Hafs verse `hafsAyah`: the last entry
   * containing it; when none does, the nearest real reciter verse (the last
   * entry before it, else the first entry after it). Null when unknown.
   */
  endEntryAyahForHafsAyah(hafsAyah: number): number | null;
  /**
   * Entry ayah range that must be played to hear all of Hafs verse
   * `hafsAyah` (several entries when the rewayah splits that Hafs verse).
   * When no entry contains it, the nearest real reciter verse (the entry
   * playback starts at) as a one-entry unit. Null when unknown.
   */
  entryRangeForHafsAyah(hafsAyah: number): {start: number; end: number} | null;
}

const NO_KEYS: readonly string[] = Object.freeze([]);

export function createTimingNumbering(args: {
  surah: number;
  mode: TimingNumberingMode;
  reciterRewayah: RewayahId | null;
  reason: string;
  entries: readonly AyahTimestamp[];
  verseMap: RewayahVerseMapService;
}): TimingNumbering {
  const {surah, mode, reciterRewayah, reason, entries, verseMap} = args;
  const byAyah = new Map<number, AyahTimestamp>();
  for (const e of entries) {
    if (!byAyah.has(e.ayahNumber)) byAyah.set(e.ayahNumber, e);
  }

  if (mode === 'disabled' || (mode === 'riwayah' && !reciterRewayah)) {
    return {
      surah,
      mode: 'disabled',
      reciterRewayah,
      reason: mode === 'disabled' ? reason : 'rewayah unknown',
      hafsKeysForEntry: () => NO_KEYS.slice(),
      entryAyahsForHafsAyah: () => [],
      startEntryForHafsAyah: () => null,
      endEntryAyahForHafsAyah: () => null,
      entryRangeForHafsAyah: () => null,
    };
  }

  if (mode === 'hafs') {
    // Identity: exactly the historical behaviour (an entry's number is used
    // as the Hafs ayah, including an ayah-0 pre-roll).
    return {
      surah,
      mode,
      reciterRewayah,
      reason,
      hafsKeysForEntry: entryAyah => [`${surah}:${entryAyah}`],
      entryAyahsForHafsAyah: hafsAyah =>
        byAyah.has(hafsAyah) ? [hafsAyah] : [],
      startEntryForHafsAyah: hafsAyah => byAyah.get(hafsAyah) ?? null,
      endEntryAyahForHafsAyah: hafsAyah => hafsAyah,
      entryRangeForHafsAyah: hafsAyah =>
        byAyah.has(hafsAyah) ? {start: hafsAyah, end: hafsAyah} : null,
    };
  }

  const rewayah = reciterRewayah as RewayahId;
  // Ordered entries with their Hafs coverage, for the "next / previous entry"
  // fallbacks of Hafs verses that belong to no rewayah verse.
  const ordered = entries
    .filter(e => e.ayahNumber >= 1)
    .map(e => {
      const ayahs = verseMap
        .toHafsKeys(rewayah, `${surah}:${e.ayahNumber}`)
        .map(k => parseVerseKey(k)!.ayah);
      return {
        entry: e,
        first: ayahs.length ? ayahs[0] : Number.NaN,
        last: ayahs.length ? ayahs[ayahs.length - 1] : Number.NaN,
      };
    });

  const entryAyahsForHafsAyah = (hafsAyah: number): number[] =>
    verseMap
      .toRiwayahKeys(rewayah, `${surah}:${hafsAyah}`)
      .map(k => parseVerseKey(k)!.ayah)
      .filter(a => byAyah.has(a));

  // @ai-start
  // Nearest real reciter verses around a Hafs verse that no entry contains.
  const nextEntry = (hafsAyah: number): AyahTimestamp | null =>
    ordered.find(o => o.first > hafsAyah)?.entry ?? null;
  const previousEntry = (hafsAyah: number): AyahTimestamp | null => {
    let prev: AyahTimestamp | null = null;
    for (const o of ordered) {
      if (o.last < hafsAyah) prev = o.entry;
    }
    return prev;
  };
  // @ai-end

  return {
    surah,
    mode,
    reciterRewayah,
    reason,
    hafsKeysForEntry: entryAyah =>
      verseMap.toHafsKeys(rewayah, `${surah}:${entryAyah}`),
    entryAyahsForHafsAyah,
    startEntryForHafsAyah: hafsAyah => {
      const containing = entryAyahsForHafsAyah(hafsAyah);
      if (containing.length) return byAyah.get(containing[0]) ?? null;
      return nextEntry(hafsAyah) ?? previousEntry(hafsAyah); // @ai
    },
    endEntryAyahForHafsAyah: hafsAyah => {
      const containing = entryAyahsForHafsAyah(hafsAyah);
      if (containing.length) return containing[containing.length - 1];
      // @ai-start
      // The last entry before it; for a range ending on the Fatiha basmala
      // (nothing before it) the reciter's first verse, so the range still
      // plays the verse it starts at instead of ending before it begins.
      const nearest = previousEntry(hafsAyah) ?? nextEntry(hafsAyah);
      return nearest ? nearest.ayahNumber : null;
      // @ai-end
    },
    entryRangeForHafsAyah: hafsAyah => {
      const containing = entryAyahsForHafsAyah(hafsAyah);
      // @ai-start
      if (!containing.length) {
        const nearest = nextEntry(hafsAyah) ?? previousEntry(hafsAyah);
        return nearest
          ? {start: nearest.ayahNumber, end: nearest.ayahNumber}
          : null;
      }
      // @ai-end
      return {start: containing[0], end: containing[containing.length - 1]};
    },
  };
}

// ── Registry ────────────────────────────────────────────────────────────────
//
// Lets numbering-unaware call sites that only hold a timestamps array (the
// main player's "Play from here" via findAyahTimestamp) use the numbering the
// follow-along tracker resolved for that exact array. 'pending' means the
// numbering is still being resolved: callers must not guess meanwhile.

export type RegisteredTimingNumbering = TimingNumbering | 'pending';

const registry = new WeakMap<
  readonly AyahTimestamp[],
  RegisteredTimingNumbering
>();

export function registerTimingNumbering(
  entries: readonly AyahTimestamp[],
  numbering: RegisteredTimingNumbering,
): void {
  registry.set(entries, numbering);
}

export function getRegisteredTimingNumbering(
  entries: readonly AyahTimestamp[],
): RegisteredTimingNumbering | undefined {
  return registry.get(entries);
}

// ── Follow-along state for the main player ─────────────────────────────────

/**
 * AyahTrackingState as written by the follow-along tracker. `verseKey` /
 * `surahNumber` / `ayahNumber` describe the first Hafs verse being recited
 * (page turns, scrolling); `verseKeys` lists every Hafs verse the current
 * timing entry recites (highlight); `reciterVerseKey` is the entry's own key.
 */
export interface MappedAyahTrackingState extends AyahTrackingState {
  verseKeys: readonly string[];
  reciterVerseKey: string;
}

/** All Hafs verse keys of a tracking state (works for legacy states too). */
export function getTrackedVerseKeys(
  state: AyahTrackingState | null | undefined,
): readonly string[] {
  if (!state) return NO_KEYS;
  const keys = (state as Partial<MappedAyahTrackingState>).verseKeys;
  return keys && keys.length ? keys : [state.verseKey];
}

// ── Labels ─────────────────────────────────────────────────────────────────

/** ['2:1','2:2'] -> '2:1-2'; ['2:286','3:1'] -> '2:286-3:1'; ['2:5'] -> '2:5'. */
export function formatVerseKeyRange(keys: readonly string[]): string | null {
  if (keys.length === 0) return null;
  const first = keys[0];
  const last = keys[keys.length - 1];
  if (first === last) return first;
  const a = parseVerseKey(first);
  const b = parseVerseKey(last);
  if (a && b && a.surah === b.surah) return `${first}-${b.ayah}`;
  return `${first}-${last}`;
}

/**
 * Verse reference for the verse being recited, in the numbering of the mushaf
 * on screen: the reciter's own key when the mushaf shows the reciter's
 * rewayah, the Hafs key(s) in a Hafs mushaf, otherwise the Hafs keys mapped
 * into the mushaf's rewayah.
 */
export function formatPlaybackVerseLabel(args: {
  hafsKeys: readonly string[];
  reciterVerseKey: string | null;
  mode: TimingNumberingMode | null;
  reciterRewayah: RewayahId | null;
  mushafRewayah: RewayahId;
  verseMap: RewayahVerseMapService;
}): string | null {
  const {hafsKeys, reciterVerseKey, mode, reciterRewayah, mushafRewayah} = args;
  if (hafsKeys.length === 0) return null;
  if (
    mode === 'riwayah' &&
    reciterVerseKey &&
    reciterRewayah === mushafRewayah
  ) {
    return reciterVerseKey;
  }
  if (mushafRewayah === 'hafs' || !args.verseMap.hasVerseMap(mushafRewayah)) {
    return formatVerseKeyRange(hafsKeys);
  }
  const mapped: string[] = [];
  for (const k of hafsKeys) {
    for (const r of args.verseMap.toRiwayahKeys(mushafRewayah, k)) {
      if (!mapped.includes(r)) mapped.push(r);
    }
  }
  return formatVerseKeyRange(mapped.length ? mapped : hafsKeys);
}
