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
 *
 * Rewayah verse units (decision 3 of Release 1, @ai): a surface that shows a
 * non-Hafs rewayah works in that rewayah's OWN verses (VerseUnit,
 * services/mushaf/RewayahVerseUnits.ts; verse-units contract 4.2). When the
 * timing entries are exactly those verses (a set numbered by the reciter's
 * rewayah, shown in that same rewayah) a unit is one entry: the follow-along
 * band moves at the rewayah's own verse ends (also inside a split Hafs
 * verse), and Play from here / Repeat / Range start, loop and stop on exactly
 * the selected verses. For every other set (Hafs-numbered, or numbered by
 * another rewayah) the Hafs-keyed mapping above stays in charge: an entry
 * lights every unit holding a word of what it recites, and a unit plays the
 * whole entries holding its words (never half of a reciter's verse). Hafs
 * units are the Hafs verses, so every Hafs answer is the historical one.
 */

import type {AyahTimestamp, AyahTrackingState} from '@/types/timestamps';
import type {RewayahId} from '@/services/rewayah/RewayahIdentity';
import {
  hafsVerseCount,
  parseVerseKey,
  rewayahVerseMapService, // @ai
  type RewayahVerseMapService,
} from '@/services/mushaf/RewayahVerseMapService';
// @ai-start
import {
  formatUnitRangeLabel,
  type VerseUnit,
} from '@/services/mushaf/RewayahVerseUnits';
// @ai-end

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

// @ai-start
// ── Rewayah verse units as audio targets ───────────────────────────────────

/**
 * A verse of a shown rewayah (a VerseUnit, in that rewayah's own numbering)
 * as audio needs it: its own number, used when the timing entries are that
 * rewayah's verses, and the Hafs verses holding its words, used for every
 * other timing set. Plain data: it does not tie the player to one load of
 * the words.
 */
export interface AudioUnitTarget {
  readonly rewayah: RewayahId;
  readonly surah: number;
  /** The rewayah's own verse number (VerseUnit.ayah). */
  readonly ayah: number;
  /** `${surah}:${ayah}`, the unit key (rewayah numbering). */
  readonly key: string;
  /** Hafs ayah of the first Hafs verse holding the verse's words. */
  readonly hafsFirstAyah: number;
  /** Hafs ayah of the last Hafs verse holding the verse's words. */
  readonly hafsLastAyah: number;
}

/** A unit as callers hold it: from the units model, or already converted. */
export type AudioUnitInput = VerseUnit | AudioUnitTarget;

/**
 * The audio target of a verse unit. Units never cross a surah and always
 * hold at least one word, so the Hafs extent is inside the unit's surah.
 * (Its first Hafs verse is the Hafs verse of the unit's storage anchor:
 * checked on every unit of every words DB by the all-DB audio test.)
 */
export function toAudioUnitTarget(input: AudioUnitInput): AudioUnitTarget {
  if (!('hafsKeys' in input)) return input;
  const first = parseVerseKey(input.hafsKeys[0] ?? '');
  const last = parseVerseKey(input.hafsKeys[input.hafsKeys.length - 1] ?? '');
  if (!first || !last || first.surah !== input.surah) {
    throw new Error(
      `[TimingNumbering] ${input.rewayah} ${input.key} has no Hafs verses in its surah`,
    );
  }
  return {
    rewayah: input.rewayah,
    surah: input.surah,
    ayah: input.ayah,
    key: input.key,
    hafsFirstAyah: first.ayah,
    hafsLastAyah: last.ayah,
  };
}

/** Negative when `a` comes before `b` (same rewayah: reading order). */
export function compareAudioUnits(
  a: Pick<AudioUnitTarget, 'surah' | 'ayah'>,
  b: Pick<AudioUnitTarget, 'surah' | 'ayah'>,
): number {
  return a.surah !== b.surah ? a.surah - b.surah : a.ayah - b.ayah;
}

/**
 * Keys of `rewayah`'s verses holding words of Hafs verses `hafsKeys`, in
 * order, without repeats: the safe Hafs-keyed mapping. It equals
 * units.unitsForHafsKeys() of that rewayah (h2r), because units that
 * disagree with the bundled verse map are refused at runtime. Hafs: the keys
 * themselves. Empty when `rewayah` has no usable verse map: never Hafs
 * numbers under another rewayah's name.
 */
export function hafsKeysToUnitKeys(
  hafsKeys: readonly string[],
  rewayah: RewayahId,
  verseMap: RewayahVerseMapService = rewayahVerseMapService,
): string[] {
  if (rewayah === 'hafs') return hafsKeys.slice();
  if (!verseMap.hasVerseMap(rewayah)) return [];
  const out: string[] = [];
  for (const hafsKey of hafsKeys) {
    for (const key of verseMap.toRiwayahKeys(rewayah, hafsKey)) {
      if (!out.includes(key)) out.push(key);
    }
  }
  return out;
}
// @ai-end

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
  // @ai-start
  // ── Rewayah verse units (verse-units contract 4.2) ──
  /**
   * True when the entries are exactly the verses of `rewayah` (entry N is
   * that rewayah's verse N of this surah, so one verse unit is one entry):
   * a set numbered by the reciter's own rewayah ('riwayah'), shown in that
   * same rewayah. False otherwise, also for a disabled numbering.
   */
  numbersVersesOf(rewayah: RewayahId): boolean;
  /**
   * Entry where playback of verse unit `unit` starts: exactly its own entry
   * when the entries are its rewayah's verses, otherwise the entry where its
   * first Hafs verse starts (startEntryForHafsAyah: a Hafs-numbered set
   * starts the second part of a split Hafs verse at the whole Hafs verse).
   * Null when the unit is in another surah or no verse-level start exists.
   */
  startEntryForUnit(unit: AudioUnitTarget): AyahTimestamp | null;
  /**
   * Last entry ayah of a range ending at verse unit `unit`: exactly its own
   * entry when the entries are its rewayah's verses, otherwise the last entry
   * holding its last Hafs verse (endEntryAyahForHafsAyah). Null when unknown
   * or when the unit is in another surah.
   */
  endEntryAyahForUnit(unit: AudioUnitTarget): number | null;
  /**
   * Entry ayah range that plays all of verse unit `unit` and nothing before
   * it (what a Repeat of that one verse loops): its own entry when the
   * entries are its rewayah's verses, otherwise every entry holding its
   * words. Null when unknown or when the unit is in another surah.
   */
  entryRangeForUnit(unit: AudioUnitTarget): {start: number; end: number} | null;
  /**
   * The follow-along band in `rewayah`'s own verses while entry `entryAyah`
   * plays (unit keys 'S:A' of that rewayah, in order). Exactly the entry's
   * own verse when the entries are `rewayah`'s verses, so the band moves at
   * the rewayah's own verse ends, also inside a split Hafs verse; otherwise
   * every verse holding a word of the Hafs verses the entry recites. Hafs:
   * hafsKeysForEntry(entryAyah), the historical keys. Empty when what is
   * recited is no verse there (the unnumbered Fatiha basmala) or unknown.
   */
  unitKeysForEntry(entryAyah: number, rewayah: RewayahId): string[];
  // @ai-end
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
    return withUnitMethods(byAyah, verseMap, {
      surah,
      mode: 'disabled',
      reciterRewayah,
      reason: mode === 'disabled' ? reason : 'rewayah unknown',
      hafsKeysForEntry: () => NO_KEYS.slice(),
      entryAyahsForHafsAyah: () => [],
      startEntryForHafsAyah: () => null,
      endEntryAyahForHafsAyah: () => null,
      entryRangeForHafsAyah: () => null,
    }); // @ai
  }

  if (mode === 'hafs') {
    // Identity: exactly the historical behaviour (an entry's number is used
    // as the Hafs ayah, including an ayah-0 pre-roll).
    return withUnitMethods(byAyah, verseMap, {
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
    }); // @ai
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

  return withUnitMethods(byAyah, verseMap, {
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
  }); // @ai
}

// @ai-start
type UnitMethodName =
  | 'numbersVersesOf'
  | 'startEntryForUnit'
  | 'endEntryAyahForUnit'
  | 'entryRangeForUnit'
  | 'unitKeysForEntry';

/**
 * Adds the verse-unit methods (verse-units contract 4.2) to a numbering's
 * Hafs-level ones. numbersVersesOf alone chooses between the exact path
 * (one unit = one entry: a 'riwayah' set shown in the reciter's own
 * rewayah) and the Hafs-keyed path through the unit's Hafs verses. A Hafs
 * unit always takes the Hafs-keyed path with its own Hafs verse, so every
 * Hafs answer is the historical one.
 */
function withUnitMethods(
  byAyah: ReadonlyMap<number, AyahTimestamp>,
  verseMap: RewayahVerseMapService,
  base: Omit<TimingNumbering, UnitMethodName>,
): TimingNumbering {
  const {surah, mode} = base;
  const numbersVersesOf = (rewayah: RewayahId): boolean =>
    mode === 'riwayah' && base.reciterRewayah === rewayah;
  // The unit's own entry when the entries are its rewayah's verses.
  const ownEntry = (unit: AudioUnitTarget): AyahTimestamp | null =>
    numbersVersesOf(unit.rewayah) ? (byAyah.get(unit.ayah) ?? null) : null;
  const usable = (unit: AudioUnitTarget): boolean =>
    mode !== 'disabled' && unit.surah === surah;

  return {
    ...base,
    numbersVersesOf,
    startEntryForUnit: unit => {
      if (!usable(unit)) return null;
      return ownEntry(unit) ?? base.startEntryForHafsAyah(unit.hafsFirstAyah);
    },
    endEntryAyahForUnit: unit => {
      if (!usable(unit)) return null;
      const own = ownEntry(unit);
      if (own) return own.ayahNumber;
      return base.endEntryAyahForHafsAyah(unit.hafsLastAyah);
    },
    entryRangeForUnit: unit => {
      if (!usable(unit)) return null;
      const own = ownEntry(unit);
      if (own) return {start: own.ayahNumber, end: own.ayahNumber};
      // Every entry holding the unit's words: a Hafs-numbered set loops a
      // merged verse whole and never cuts a split Hafs verse in two.
      const start = base.startEntryForHafsAyah(unit.hafsFirstAyah);
      if (!start) return null;
      const end = base.endEntryAyahForHafsAyah(unit.hafsLastAyah);
      return {
        start: start.ayahNumber,
        end: end === null ? start.ayahNumber : Math.max(start.ayahNumber, end),
      };
    },
    unitKeysForEntry: (entryAyah, rewayah) => {
      if (mode === 'disabled') return [];
      // Hafs units are the Hafs verses: the historical keys, unchanged.
      if (rewayah === 'hafs') return base.hafsKeysForEntry(entryAyah);
      if (numbersVersesOf(rewayah)) {
        const count = verseMap.verseCount(rewayah, surah) ?? 0;
        return entryAyah >= 1 && entryAyah <= count
          ? [`${surah}:${entryAyah}`]
          : [];
      }
      return hafsKeysToUnitKeys(
        base.hafsKeysForEntry(entryAyah),
        rewayah,
        verseMap,
      );
    },
  };
}
// @ai-end

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

// @ai-start
// ── Highlight key lists for store selectors ────────────────────────────────
//
// A store selector that returned the verse-key array itself would re-render
// its component whenever an equal array is rebuilt; joined into a string the
// selection compares by value. For a single verse (every Hafs recitation)
// the id is just that verse key.

const VERSE_KEY_LIST_SEPARATOR = '|';

/** Value-comparable id of a verse-key list ('' for none). */
export function verseKeyListId(keys: readonly string[]): string {
  return keys.join(VERSE_KEY_LIST_SEPARATOR);
}

/** Inverse of verseKeyListId. */
export function parseVerseKeyListId(id: string): readonly string[] {
  return id ? id.split(VERSE_KEY_LIST_SEPARATOR) : NO_KEYS;
}

/**
 * The main player's highlighted Hafs verse keys as a value-comparable id:
 * use with `useTimestampStore(selectTrackedVerseKeysId)`.
 */
export function selectTrackedVerseKeysId(s: {
  currentAyah: AyahTrackingState | null;
}): string {
  return verseKeyListId(getTrackedVerseKeys(s.currentAyah));
}
// @ai-end

// @ai-start
/**
 * The main player's follow-along band in `rewayah`'s own verses (unit keys
 * 'S:A' of that rewayah, verse-units contract 4.2), for verse rows shown in
 * `rewayah`: exactly the reciter's verse being recited (`reciterVerseKey`)
 * when `numbering`, the one registered for the playing timings, says the
 * entries are `rewayah`'s verses; otherwise every verse of `rewayah` holding
 * a word of the Hafs verses being recited. Hafs: getTrackedVerseKeys(state),
 * unchanged. Empty when nothing is recited or what is recited is no verse
 * of `rewayah` (the unnumbered Fatiha basmala). A non-Hafs rewayah's keys
 * may only be shown while its verse units are ready (useTrackedUnitKeys in
 * hooks/useAyahTracker.ts checks).
 */
export function getTrackedUnitKeys(
  state: AyahTrackingState | null | undefined,
  rewayah: RewayahId,
  numbering: RegisteredTimingNumbering | null | undefined,
  verseMap: RewayahVerseMapService = rewayahVerseMapService,
): readonly string[] {
  if (!state) return NO_KEYS;
  if (rewayah === 'hafs') return getTrackedVerseKeys(state);
  const entryKey = (state as Partial<MappedAyahTrackingState>).reciterVerseKey;
  const entry = entryKey ? parseVerseKey(entryKey) : null;
  if (
    entry &&
    numbering &&
    numbering !== 'pending' &&
    numbering.surah === entry.surah &&
    numbering.numbersVersesOf(rewayah)
  ) {
    return numbering.unitKeysForEntry(entry.ayah, rewayah);
  }
  return hafsKeysToUnitKeys(getTrackedVerseKeys(state), rewayah, verseMap);
}
// @ai-end

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

// @ai-start
/**
 * Label of a follow-along band of verse unit keys (consecutive verses of one
 * rewayah): formatUnitRangeLabel of its first and last verse, so "1:6",
 * "2:1-2". One key reads as itself, so a Hafs band's label is the historical
 * one. Null for an empty band: what is recited has no verse number there.
 */
export function formatUnitKeysLabel(keys: readonly string[]): string | null {
  if (keys.length === 0) return null;
  if (keys.length === 1) return keys[0];
  const first = parseVerseKey(keys[0]);
  const last = parseVerseKey(keys[keys.length - 1]);
  if (!first || !last) return formatVerseKeyRange(keys);
  return formatUnitRangeLabel(first, last);
}
// @ai-end

/**
 * Verse reference for the verse being recited, in the numbering of the mushaf
 * on screen: the reciter's own key when the mushaf shows the reciter's
 * rewayah, the Hafs key(s) in a Hafs mushaf, otherwise the Hafs keys mapped
 * into the mushaf's rewayah. Null when what is recited has no verse number in
 * that mushaf (the Fatiha basmala in a Madani or Basri mushaf): a Hafs number
 * there would name a different verse.
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
  return formatVerseKeyRange(mapped); // @ai
}
