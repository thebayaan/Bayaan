/**
 * Mushaf Player Store
 *
 * Zustand store for mushaf ayah-by-ayah audio player state.
 * Persists reciter preference, playback rate, and repeat counts across sessions.
 *
 * Verse numbering: a timing set may be numbered by the reciter's rewayah
 * (e.g. Warsh 2:4 is Hafs 2:5, Warsh 2:1 is Hafs 2:1 + 2:2). Everything the UI
 * reads or writes here is a HAFS verse key (currentVerseKey / currentVerseKeys,
 * rangeStart / rangeEnd, the key passed to startPlayback), because the words
 * DBs, layouts and highlight renderers are all keyed by Hafs verses. Talking
 * to MushafAudioService happens in TIMING ENTRY numbers. The loaded surah's
 * TimingNumbering (utils/timestampNumbering.ts) translates between the two:
 * a timing entry highlights every Hafs verse it recites, a Hafs verse starts
 * at the first entry containing it, and repeats / ranges run in whole
 * reciter verses. When the numbering cannot be established for a surah,
 * follow-along highlight and verse seeking are disabled for that surah.
 *
 * Rewayah verse units (decision 3 of Release 1, @ai): a mushaf that shows a
 * non-Hafs rewayah works in that rewayah's OWN verses. Next to the Hafs keys
 * (kept for page turns and Hafs-keyed readers) the store publishes the
 * follow-along band as verse unit keys of the mushaf on screen
 * (currentUnitKeys, usePlaybackUnitKeys) and labels the playing verse from
 * them. Starts and ranges can be given as verse units (startPlayback with a
 * unit, setUnitRange, setPendingStart): when the reciter's timing entries are
 * that rewayah's own verses, a unit is exactly one entry (the band moves at
 * the rewayah's verse ends, Repeat loops one rewayah verse, a range stops at
 * its last verse, also inside a split Hafs verse); for any other set the
 * unit's Hafs verses are used as above (verse-units contract 4.2). For Hafs
 * every unit is its Hafs verse and every answer is the historical one.
 */

import {useCallback, useMemo} from 'react'; // @ai
import {create} from 'zustand';
import {createJSONStorage, persist} from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {AyahTimestamp} from '@/types/timestamps';
import {RECITERS} from '@/data/reciterData';
import {timestampService} from '@/services/timestamps/TimestampService';
import {timestampFetchService} from '@/services/timestamps/TimestampFetchService';
import {timingNumberingService} from '@/services/timestamps/TimingNumberingService';
import {
  mushafAudioService,
  type SurahEndReason,
} from '@/services/audio/MushafAudioService';
import {mushafVerseMapService} from '@/services/mushaf/MushafVerseMapService';
import {parseVerseKey} from '@/services/mushaf/RewayahVerseMapService';
import type {RewayahId} from '@/services/rewayah/RewayahIdentity';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import {resolveMushafAudioUrl} from '@/utils/mushafAudioUtils';
import {
  parseVerseKeyListId, // @ai
  VERSE_TRACKING_UNAVAILABLE_LABEL, // @ai
  verseKeyListId, // @ai
  type TimingNumbering,
  type TimingNumberingMode,
  // @ai-start
  // Verse units (the verse label now comes from the band).
  compareAudioUnits,
  formatUnitKeysLabel,
  hafsKeysToUnitKeys,
  toAudioUnitTarget,
  type AudioUnitInput,
  type AudioUnitTarget,
  // @ai-end
} from '@/utils/timestampNumbering';
// @ai-start
import {
  canShowRewayahVerses,
  readyVerseUnits,
  subscribeVerseUnitsChanges,
} from '@/utils/playbackVerseUnits';
// @ai-end

const STORAGE_KEY = 'mushaf-player-store';

type PlaybackState = 'idle' | 'loading' | 'playing' | 'paused';

export interface AvailableReciter {
  rewayatId: string;
  reciterName: string;
  imageUrl: string | null;
  style: string;
}

interface RangeEndpoint {
  surah: number;
  ayah: number;
}

// @ai-start
/**
 * Consecutive verse units `first`..`last` of one rewayah (its own
 * numbering), both included.
 */
export interface UnitRange {
  first: AudioUnitTarget;
  last: AudioUnitTarget;
}
// @ai-end

export const TIMESTAMPS_UNAVAILABLE_ERROR =
  'Timestamps unavailable for this reciter on this surah. Try a different reciter.';

/** Shown when a repeat / loop is requested on a surah without verse timing. */
export const VERSE_TIMING_UNAVAILABLE_ERROR =
  "Verse-by-verse playback isn't available for this reciter on this surah. Try a different reciter.";

// @ai-start
/**
 * Shown when a requested range resolves to no timing entry of the reciter
 * (playback would end before it starts), instead of a silent stop or a
 * 'playing' state with no audio.
 */
export const RANGE_UNPLAYABLE_ERROR =
  'This selection has no verses to play for this reciter. Try a different reciter or range.';

/** Shown in place of a verse number while the surah has no verse tracking. */
export {VERSE_TRACKING_UNAVAILABLE_LABEL};
// @ai-end

const NO_KEYS: readonly string[] = Object.freeze([]);

export interface MushafPlayerStoreState {
  // Runtime state (not persisted)
  playbackState: PlaybackState;
  /** Surah whose audio is loaded / playing (0 when idle). */
  currentSurah: number;
  /** Hafs ayah of currentVerseKey (0 when no verse is being tracked). */
  currentAyah: number;
  /**
   * First Hafs verse key recited by the current timing entry: drives page
   * turns and scrolling. Null before the first entry or when follow-along is
   * unavailable for the surah.
   */
  currentVerseKey: string | null;
  /** Every Hafs verse key recited by the current timing entry (highlight). */
  currentVerseKeys: readonly string[];
  /**
   * The current timing entry's own key, in the timing set's numbering (the
   * reciter's rewayah numbering for rewayah-numbered sets).
   */
  currentReciterVerseKey: string | null;
  /**
   * Verse reference to display, in the numbering of the mushaf on screen:
   * the label of currentUnitKeys ("1:6", "2:1-2"; @ai). Null when what is
   * recited has no verse number there (the Fatiha basmala in a Madani or
   * Basri mushaf) or that rewayah's verse units are not available.
   */
  currentVerseLabel: string | null;
  // @ai-start
  /**
   * The follow-along band as verse unit keys of currentUnitRewayah (the
   * mushaf on screen): exactly the entry's own verse when the reciter's
   * entries are that rewayah's verses, else every verse holding a word of
   * the Hafs verses being recited. Hafs: currentVerseKeys. Empty when that
   * rewayah's verse units are refused or not in memory: no band and no
   * number rather than Hafs ones. Read it with usePlaybackUnitKeys().
   */
  currentUnitKeys: readonly string[];
  /** The rewayah currentUnitKeys are numbered in (null when none). */
  currentUnitRewayah: RewayahId | null;
  // @ai-end
  /** Numbering of the loaded surah ('disabled' = no follow-along / seeking). */
  numberingMode: TimingNumberingMode | null;
  currentPage: number | null;
  timestamps: AyahTimestamp[] | null;
  rangeStart: RangeEndpoint | null;
  rangeEnd: RangeEndpoint | null;
  // @ai-start
  /**
   * The range as verse units of one rewayah when it was set with
   * setUnitRange; rangeStart / rangeEnd then hold its Hafs envelope (the
   * first unit's first Hafs verse, the last unit's last Hafs verse). Used
   * only while they still hold that envelope.
   */
  rangeUnits: UnitRange | null;
  /**
   * Verse unit a later startPlayback() without a start begins at (see
   * setPendingStart). Used only while pendingStartVerseKey still holds its
   * first Hafs verse.
   */
  pendingStartUnit: AudioUnitTarget | null;
  // @ai-end
  availableReciters: AvailableReciter[];
  pendingStartVerseKey: string | null;
  // @ai-start
  /**
   * The verse playback was asked to start at when the surah has no verse
   * tracking: it plays from its beginning instead, and the notice says so.
   * Null otherwise.
   */
  ignoredStartVerseKey: string | null;
  // @ai-end
  timestampError: string | null;
  _versePlayCount: number;
  _rangePlayCount: number;
  /** Current timing entry ayah (timing-set numbering), 0 when none. */
  _entryAyah: number;
  /** Translation for the loaded surah. */
  _numbering: TimingNumbering | null;

  // UI state (synced from MushafViewer, not persisted)
  isImmersive: boolean;
  isSearchMode: boolean;

  // Persisted preferences
  rewayatId: string | null;
  reciterName: string | null;
  rate: number;
  verseRepeatCount: number;
  rangeRepeatCount: number;

  // Actions
  setPlaybackState: (state: PlaybackState) => void;
  /** The timing entry (surah, entry ayah in the set's numbering) is playing. */
  setCurrentAyah: (surah: number, ayah: number) => void;
  setReciter: (rewayatId: string, reciterName: string) => void;
  setRate: (rate: number) => void;
  setVerseRepeatCount: (count: number) => void;
  setRangeRepeatCount: (count: number) => void;
  /** Range endpoints are Hafs verses. */
  setRange: (start: RangeEndpoint, end: RangeEndpoint) => void;
  // @ai-start
  /**
   * Range of consecutive verse units `first`..`last` of one rewayah (a
   * mushaf selection, or a verse to the end of its surah). A reciter whose
   * entries are that rewayah's verses plays exactly those verses; any other
   * reciter plays the entries holding their Hafs verses. Throws when the two
   * units belong to different rewayat.
   */
  setUnitRange: (first: AudioUnitInput, last: AudioUnitInput) => void;
  /**
   * Remember (or clear, with null) the verse unit a later startPlayback()
   * without a start begins at, e.g. while the reciter picker is open. Also
   * sets pendingStartVerseKey to its first Hafs verse for Hafs-keyed readers.
   */
  setPendingStart: (unit: AudioUnitInput | null) => void;
  // @ai-end
  clearRange: () => void;
  /**
   * `startAt` is a Hafs verse key or (@ai) a verse unit. Without it playback
   * starts at the pending start, else at the range start, else at the first
   * verse of `page` in the mushaf on screen.
   */
  startPlayback: (
    page: number,
    startAt?: string | AudioUnitInput,
  ) => Promise<void>;
  stop: () => void;
  computeAvailableReciters: () => Promise<void>;
}

type StoreSet = (
  partial:
    | Partial<MushafPlayerStoreState>
    | ((s: MushafPlayerStoreState) => Partial<MushafPlayerStoreState>),
) => void;
type StoreGet = () => MushafPlayerStoreState;

// Incremented by every startPlayback / stop: async continuations of a
// superseded playback request must not load audio or touch state.
let playbackSession = 0;
// @ai-start
// The playback session that loaded the surah audio MushafAudioService
// holds. A start does not stop the surah playing, which plays on until the
// new surah's audio replaces it: the verse boundaries and the end it reaches
// meanwhile belong to the superseded playback, and must not repeat, end or
// advance the new one.
let audioSession = 0;
// @ai-end

function displayRewayah(): RewayahId {
  try {
    return useMushafSettingsStore.getState().rewayah ?? 'hafs';
  } catch {
    return 'hafs';
  }
}

// @ai-start
/**
 * The follow-along band of entry `entryAyah` in `rewayah`'s own verses
 * (TimingNumbering.unitKeysForEntry). Empty while that rewayah's verse units
 * are refused or not in memory: no band and no number rather than guessed
 * ones. Without a numbering (nothing loaded) entries are Hafs verses.
 */
function bandUnitKeys(
  numbering: TimingNumbering | null,
  surah: number,
  entryAyah: number,
  rewayah: RewayahId,
): readonly string[] {
  if (!canShowRewayahVerses(rewayah)) return NO_KEYS;
  if (numbering) return numbering.unitKeysForEntry(entryAyah, rewayah);
  return hafsKeysToUnitKeys([`${surah}:${entryAyah}`], rewayah);
}

/**
 * Band and verse label of the playing entry in the mushaf on screen. For a
 * Hafs mushaf the band is the entry's Hafs keys and the label the
 * historical one ("2:5", "2:1-2").
 */
function unitStateFor(
  numbering: TimingNumbering | null,
  surah: number,
  entryAyah: number,
): Pick<
  MushafPlayerStoreState,
  'currentUnitKeys' | 'currentUnitRewayah' | 'currentVerseLabel'
> {
  const rewayah = displayRewayah();
  const keys = bandUnitKeys(numbering, surah, entryAyah, rewayah);
  return {
    currentUnitKeys: keys.length ? keys : NO_KEYS,
    currentUnitRewayah: rewayah,
    currentVerseLabel: formatUnitKeysLabel(keys),
  };
}

/** The timing entry being recited ({surah, entry ayah}), or null. */
function recitedEntry(
  s: Pick<MushafPlayerStoreState, 'currentReciterVerseKey'>,
): {surah: number; ayah: number} | null {
  if (!s.currentReciterVerseKey) return null;
  const [surah, ayah] = s.currentReciterVerseKey.split(':').map(Number);
  return Number.isInteger(surah) && Number.isInteger(ayah)
    ? {surah, ayah}
    : null;
}
// @ai-end

const CLEARED_VERSE: Pick<
  MushafPlayerStoreState,
  | 'currentAyah'
  | 'currentVerseKey'
  | 'currentVerseKeys'
  | 'currentReciterVerseKey'
  | 'currentVerseLabel'
  | 'currentUnitKeys' // @ai
  | 'currentUnitRewayah' // @ai
  | '_entryAyah'
> = {
  currentAyah: 0,
  currentVerseKey: null,
  currentVerseKeys: NO_KEYS,
  currentReciterVerseKey: null,
  currentVerseLabel: null,
  currentUnitKeys: NO_KEYS, // @ai
  currentUnitRewayah: null, // @ai
  _entryAyah: 0,
};

/** State for "timing entry `entryAyah` of `surah` is playing". */
function verseStateFor(
  numbering: TimingNumbering | null,
  surah: number,
  entryAyah: number,
): Partial<MushafPlayerStoreState> {
  const keys = numbering
    ? numbering.hafsKeysForEntry(entryAyah)
    : [`${surah}:${entryAyah}`];
  if (keys.length === 0) {
    return {...CLEARED_VERSE, currentSurah: surah, _entryAyah: entryAyah};
  }
  const primary = keys[0];
  const reciterVerseKey = `${surah}:${entryAyah}`;
  return {
    currentSurah: surah,
    currentAyah: parseInt(primary.split(':')[1], 10) || 0,
    currentVerseKey: primary,
    currentVerseKeys: keys,
    currentReciterVerseKey: reciterVerseKey,
    // The band in the mushaf's own verses and its label (@ai): for a Hafs
    // mushaf exactly the keys above and the historical label.
    ...unitStateFor(numbering, surah, entryAyah),
    _entryAyah: entryAyah,
  };
}

function isIdentity(numbering: TimingNumbering | null): boolean {
  return !numbering || numbering.mode === 'hafs';
}

// @ai-start
/** Hafs verse key a verse unit starts in (its first Hafs verse). */
const unitHafsStartKey = (unit: AudioUnitTarget): string =>
  `${unit.surah}:${unit.hafsFirstAyah}`;

/**
 * The range in verse units, while rangeStart / rangeEnd still hold its Hafs
 * envelope (a later Hafs-keyed range replaces it).
 */
function activeRangeUnits(
  state: Pick<MushafPlayerStoreState, 'rangeUnits' | 'rangeStart' | 'rangeEnd'>,
): UnitRange | null {
  const {rangeUnits: units, rangeStart: start, rangeEnd: end} = state;
  if (!units || !start || !end) return null;
  return start.surah === units.first.surah &&
    start.ayah === units.first.hafsFirstAyah &&
    end.surah === units.last.surah &&
    end.ayah === units.last.hafsLastAyah
    ? units
    : null;
}

/**
 * The pending start as a verse unit, while pendingStartVerseKey still holds
 * its first Hafs verse (a later Hafs-keyed pending start replaces it).
 */
function activePendingStartUnit(
  state: Pick<
    MushafPlayerStoreState,
    'pendingStartUnit' | 'pendingStartVerseKey'
  >,
): AudioUnitTarget | null {
  const unit = state.pendingStartUnit;
  return unit && state.pendingStartVerseKey === unitHafsStartKey(unit)
    ? unit
    : null;
}
// @ai-end

/**
 * Last timing entry inside the range for `surah`: +Infinity when the range
 * continues past this surah, -Infinity when it ended before it. For a
 * translated numbering both ends resolve to real reciter verses (see
 * TimingNumbering), and a range never ends before the entry it starts at:
 * Hafs 1:1-1:1 with a Madani reciter plays the reciter's verse 1.
 */
function rangeEndEntry(
  state: MushafPlayerStoreState,
  numbering: TimingNumbering | null,
  surah: number,
): number {
  // @ai-start
  // A range of verse units ends exactly at its last verse when the entries
  // are that rewayah's verses, else after the entries holding its last Hafs
  // verse. Identity numberings use its Hafs envelope (rangeEnd) below.
  const units = activeRangeUnits(state);
  if (units && numbering && !isIdentity(numbering)) {
    if (units.last.surah > surah) return Infinity;
    if (units.last.surah < surah) return -Infinity;
    const lastEntry = numbering.endEntryAyahForUnit(units.last);
    if (lastEntry === null) return -Infinity;
    const firstEntry = rangeStartEntry(state, numbering, surah);
    return firstEntry !== null ? Math.max(lastEntry, firstEntry) : lastEntry;
  }
  // @ai-end
  const end = state.rangeEnd!;
  if (end.surah > surah) return Infinity;
  if (end.surah < surah) return -Infinity;
  if (isIdentity(numbering)) return end.ayah;
  // @ai-start
  const last = numbering!.endEntryAyahForHafsAyah(end.ayah);
  if (last === null) return -Infinity;
  const first = rangeStartEntry(state, numbering, surah);
  return first !== null ? Math.max(last, first) : last;
  // @ai-end
}

/** First timing entry of the range when it starts in `surah`, else null. */
function rangeStartEntry(
  state: MushafPlayerStoreState,
  numbering: TimingNumbering | null,
  surah: number,
): number | null {
  // @ai-start
  const units = activeRangeUnits(state);
  if (units && numbering && !isIdentity(numbering)) {
    if (units.first.surah !== surah) return null;
    return numbering.startEntryForUnit(units.first)?.ayahNumber ?? null;
  }
  // @ai-end
  const start = state.rangeStart!;
  if (start.surah !== surah) return null;
  if (isIdentity(numbering)) return start.ayah;
  return numbering!.startEntryForHafsAyah(start.ayah)?.ayahNumber ?? null;
}

/**
 * Entries repeated as one unit by verse repeat. Normally the single entry
 * that just finished; when the selection is one Hafs verse that the reciter
 * recites as several verses (e.g. Warsh splits Hafs 2:255 in two), the whole
 * span, so a loop never cuts the selected verse.
 */
function verseLoopUnit(
  state: MushafPlayerStoreState,
  numbering: TimingNumbering | null,
  entryAyah: number,
): {start: number; end: number} {
  // @ai-start
  // One verse unit selected: loop all of it and only it. Exactly its own
  // entry when the entries are its rewayah's verses (Repeat of Warsh 1:6
  // loops Warsh 1:6, not all of Hafs 1:7); otherwise every entry holding its
  // words (a Hafs-numbered set loops Warsh 107:6 as Hafs 107:6 + 107:7). A
  // Hafs unit gives the historical span of its Hafs verse.
  const units = activeRangeUnits(state);
  if (units) {
    if (
      numbering &&
      compareAudioUnits(units.first, units.last) === 0 &&
      units.first.surah === numbering.surah
    ) {
      const span = numbering.entryRangeForUnit(units.first);
      if (span && entryAyah >= span.start && entryAyah <= span.end) return span;
    }
    return {start: entryAyah, end: entryAyah};
  }
  // @ai-end
  const {rangeStart, rangeEnd} = state;
  if (
    numbering &&
    numbering.mode === 'riwayah' &&
    rangeStart &&
    rangeEnd &&
    rangeStart.surah === rangeEnd.surah &&
    rangeStart.ayah === rangeEnd.ayah &&
    rangeStart.surah === numbering.surah
  ) {
    const span = numbering.entryRangeForHafsAyah(rangeStart.ayah);
    if (span && entryAyah >= span.start && entryAyah <= span.end) return span;
  }
  return {start: entryAyah, end: entryAyah};
}

// @ai-start
/**
 * Where playback starts: a Hafs verse (`ayah` is Hafs) and, when the start
 * was given as a verse unit, that unit (`ayah` is then its first Hafs verse).
 */
interface StartPoint {
  surah: number;
  ayah: number;
  unit: AudioUnitTarget | null;
}

type StartResolution =
  | {kind: 'start'; point: StartPoint}
  | {kind: 'none'} // nothing to start at (a page without verses)
  | {kind: 'invalid'; key: string};

const unitStart = (unit: AudioUnitTarget): StartResolution => ({
  kind: 'start',
  point: {surah: unit.surah, ayah: unit.hafsFirstAyah, unit},
});

function hafsStart(key: string): StartResolution {
  const parsed = parseVerseKey(key);
  return parsed
    ? {kind: 'start', point: {...parsed, unit: null}}
    : {kind: 'invalid', key};
}

/** First timing entry to play for `point` in the loaded surah. */
function startEntryAt(
  numbering: TimingNumbering,
  point: StartPoint,
): AyahTimestamp | null {
  return point.unit
    ? numbering.startEntryForUnit(point.unit)
    : numbering.startEntryForHafsAyah(point.ayah);
}

/**
 * The first verse of `page` in the mushaf on screen: in a Hafs mushaf the
 * page's first Hafs verse, as always; in another rewayah's mushaf its own
 * verse holding the page's first word (found by word slot). The page's first
 * Hafs verse when that slot is in no verse (the unnumbered Fatiha basmala,
 * which a Hafs-numbered reciter recites as its first entry) or the verse
 * units are not available.
 */
function pageStart(page: number): StartResolution {
  const orderedKeys = mushafVerseMapService.getOrderedVerseKeysForPage(page);
  if (orderedKeys.length === 0) return {kind: 'none'};
  const rewayah = displayRewayah();
  const units = rewayah === 'hafs' ? null : readyVerseUnits(rewayah);
  if (units) {
    try {
      const first = mushafVerseMapService.getVerseSegmentsForPage(
        page,
        orderedKeys[0],
      )[0];
      const unit = first
        ? units.unitForWordId(first.segment.firstWordId)
        : null;
      if (unit) return unitStart(toAudioUnitTarget(unit));
    } catch (error) {
      console.warn('[MushafPlayerStore] No verse unit for the page:', error);
    }
  }
  return hafsStart(orderedKeys[0]);
}

/**
 * Where startPlayback begins: the given start, else the pending start, else
 * the range start, else the first verse of the page.
 */
function resolveStart(
  page: number,
  startAt: string | AudioUnitInput | undefined,
  state: MushafPlayerStoreState,
): StartResolution {
  if (startAt && typeof startAt !== 'string') {
    return unitStart(toAudioUnitTarget(startAt));
  }
  if (startAt) return hafsStart(startAt);
  const pendingUnit = activePendingStartUnit(state);
  if (pendingUnit) return unitStart(pendingUnit);
  if (state.pendingStartVerseKey) return hafsStart(state.pendingStartVerseKey);
  const rangeUnits = activeRangeUnits(state);
  if (rangeUnits) return unitStart(rangeUnits.first);
  if (state.rangeStart) {
    const {surah, ayah} = state.rangeStart;
    return {kind: 'start', point: {surah, ayah, unit: null}};
  }
  return pageStart(page);
}
// @ai-end

function createPlaybackEngine(set: StoreSet, get: StoreGet) {
  /**
   * Seek to a timing entry and publish it. `_entryAyah` is cleared first so
   * the change MushafAudioService dispatches for this seek is not mistaken
   * for the reciter moving on (which would trigger verse repeat).
   */
  const jumpToEntry = (surah: number, entryAyah: number): boolean => {
    set({_entryAyah: 0});
    const ok = mushafAudioService.seekToAyah(entryAyah);
    // @ai-start
    // The seek dispatches the entry change synchronously, and a range that
    // ends there finishes playback inside that dispatch: never republish a
    // verse for playback that has already stopped.
    if (!ok || get().playbackState === 'idle') return false;
    set(verseStateFor(get()._numbering, surah, entryAyah));
    return true;
    // @ai-end
  };

  const finishPlayback = () => {
    mushafAudioService.stop();
    set({
      ...CLEARED_VERSE,
      playbackState: 'idle',
      _versePlayCount: 1,
      _rangePlayCount: 1,
    });
  };

  const loadSurahAudio = (
    rewayatId: string,
    surah: number,
    timestamps: AyahTimestamp[],
    numbering: TimingNumbering,
    startHafsAyah: number | null = null, // @ai
  ) => {
    const audioUrl = resolveMushafAudioUrl(rewayatId, surah);
    mushafAudioService.loadSurah(surah, audioUrl, timestamps);
    // @ai-start
    // Its verse boundaries and end are this playback's from now on (both
    // callers load only for the current session).
    audioSession = playbackSession;
    // @ai-end
    mushafAudioService.setVerseSeekingEnabled(numbering.mode !== 'disabled');
    mushafAudioService.setRate(get().rate);
    set({
      ...CLEARED_VERSE,
      currentSurah: surah,
      timestamps,
      _numbering: numbering,
      numberingMode: numbering.mode,
      // @ai-start
      // Without verse tracking the surah plays from its beginning: a later
      // start verse that was asked for is skipped (set with numberingMode so
      // the notice for this surah can say so).
      ignoredStartVerseKey:
        numbering.mode === 'disabled' &&
        startHafsAyah !== null &&
        startHafsAyah > 1
          ? `${surah}:${startHafsAyah}`
          : null,
      // @ai-end
    });
  };

  const prepareSurah = async (
    rewayatId: string,
    surah: number,
  ): Promise<{
    timestamps: AyahTimestamp[];
    numbering: TimingNumbering;
  } | null> => {
    const timestamps = await timestampService.getTimestampsForSurah(
      rewayatId,
      surah,
    );
    if (!timestamps) return null;
    const numbering = await timingNumberingService.resolve(
      rewayatId,
      surah,
      timestamps,
    );
    return {timestamps, numbering};
  };

  /**
   * Load `surah` and play it from Hafs verse `hafsAyah` (null: from its first
   * timing entry), or from verse unit `unit` when given (@ai; `hafsAyah` is
   * then its first Hafs verse). Used for advancing to the next surah and for
   * looping a range that started in another surah.
   */
  const playSurahFrom = async (
    surah: number,
    hafsAyah: number | null,
    unit: AudioUnitTarget | null = null, // @ai
  ) => {
    const session = playbackSession;
    const {rewayatId} = get();
    if (!rewayatId) return;
    try {
      set({playbackState: 'loading'});
      mushafAudioService.pause();
      const prepared = await prepareSurah(rewayatId, surah);
      if (session !== playbackSession) return;
      if (!prepared) {
        finishPlayback();
        return;
      }
      const {timestamps, numbering} = prepared;
      loadSurahAudio(
        rewayatId,
        surah,
        timestamps,
        numbering,
        unit && unit.ayah === 1 ? 1 : hafsAyah,
      ); // @ai
      if (numbering.mode !== 'disabled') {
        let start: number | null = 1; // first timing entry
        if (hafsAyah !== null) {
          const startEntry = startEntryAt(numbering, {
            surah,
            ayah: hafsAyah,
            unit,
          }); // @ai
          start = startEntry ? startEntry.ayahNumber : null;
        }
        if (start !== null) jumpToEntry(surah, start);
      }
      // @ai-start
      if (get().playbackState === 'idle') {
        // The range ended at its first entry: nothing to play.
        set({timestampError: RANGE_UNPLAYABLE_ERROR});
        return;
      }
      // @ai-end
      mushafAudioService.play();
      set({playbackState: 'playing'});
    } catch (error) {
      console.error('[MushafPlayerStore] Failed to load surah:', error);
      if (session === playbackSession) finishPlayback();
    }
  };

  /** Jump back to the range start (reloading its surah if needed). */
  const loopToRangeStart = (surah: number, resume: boolean) => {
    const state = get();
    const start = state.rangeStart!;
    if (start.surah !== surah) {
      // A range of verse units restarts at its first unit (@ai).
      const units = activeRangeUnits(state);
      void playSurahFrom(start.surah, start.ayah, units ? units.first : null);
      return;
    }
    const entry = rangeStartEntry(state, state._numbering, surah);
    if (entry === null || !jumpToEntry(surah, entry)) {
      // No timing entry to return to: stop rather than loop on nothing.
      if (get().playbackState !== 'idle') finishPlayback(); // @ai
      return;
    }
    if (resume) mushafAudioService.play();
  };

  const handleEntryChange = (surah: number, entryAyah: number) => {
    const state = get();

    // Bail out if playback was stopped (stale callback)
    if (state.playbackState === 'idle') return;
    // ...or superseded by a start still loading its surah (@ai)
    if (audioSession !== playbackSession) return; // @ai

    const numbering = state._numbering;
    const prevEntry = state._entryAyah;
    const prevSurah = state.currentSurah;
    set(verseStateFor(numbering, surah, entryAyah));

    // Without a verse numbering there are no verse boundaries to repeat or
    // to end a range on.
    if (numbering && numbering.mode === 'disabled') return;

    // Verse repeat, in reciter verses (timing entries)
    if (
      state.verseRepeatCount !== 1 &&
      prevEntry > 0 &&
      surah === prevSurah &&
      entryAyah !== prevEntry
    ) {
      const unit = verseLoopUnit(state, numbering, prevEntry);
      if (entryAyah < unit.start || entryAyah > unit.end) {
        if (
          state.verseRepeatCount === 0 ||
          state._versePlayCount < state.verseRepeatCount
        ) {
          if (state.verseRepeatCount !== 0) {
            set({_versePlayCount: state._versePlayCount + 1});
          }
          jumpToEntry(surah, unit.start);
          return;
        }
        // Exhausted verse repeats — reset counter and let it advance
        set({_versePlayCount: 1});
      }
    }

    // Range boundary check
    if (state.rangeEnd && state.rangeStart) {
      if (entryAyah > rangeEndEntry(state, numbering, surah)) {
        if (state.rangeRepeatCount === 0) {
          set({_versePlayCount: 1});
          loopToRangeStart(surah, false);
          return;
        }
        if (state._rangePlayCount < state.rangeRepeatCount) {
          set({
            _rangePlayCount: state._rangePlayCount + 1,
            _versePlayCount: 1,
          });
          loopToRangeStart(surah, false);
          return;
        }
        // Range exhausted — stop playback
        finishPlayback();
      }
    }
  };

  const handleSurahEnd = (reason: SurahEndReason) => {
    const state = get();

    // Bail out if playback was stopped (stale callback)
    if (state.playbackState === 'idle') return;
    // ...or superseded by a start still loading its surah (@ai)
    if (audioSession !== playbackSession) return; // @ai

    const numbering = state._numbering;
    const surah = state.currentSurah;
    const versesKnown = !numbering || numbering.mode !== 'disabled';

    // Verse repeat of the surah's last verse (its end is the audio's end)
    if (
      reason === 'finished' &&
      versesKnown &&
      state.verseRepeatCount !== 1 &&
      state._entryAyah > 0
    ) {
      if (
        state.verseRepeatCount === 0 ||
        state._versePlayCount < state.verseRepeatCount
      ) {
        const unit = verseLoopUnit(state, numbering, state._entryAyah);
        if (state.verseRepeatCount !== 0) {
          set({_versePlayCount: state._versePlayCount + 1});
        }
        if (jumpToEntry(surah, unit.start)) {
          mushafAudioService.play();
          return;
        }
        if (get().playbackState === 'idle') return; // @ai
      }
      set({_versePlayCount: 1});
    }

    // Range boundary check at surah end (a range ending in a later surah
    // simply continues into the next surah)
    if (state.rangeEnd && state.rangeStart && state.rangeEnd.surah <= surah) {
      if (state.rangeRepeatCount === 0) {
        set({_versePlayCount: 1});
        loopToRangeStart(surah, true);
        return;
      }
      if (state._rangePlayCount < state.rangeRepeatCount) {
        set({
          _rangePlayCount: state._rangePlayCount + 1,
          _versePlayCount: 1,
        });
        loopToRangeStart(surah, true);
        return;
      }
      // Range exhausted
      finishPlayback();
      return;
    }

    // Default: advance to next surah
    const nextSurah = surah + 1;
    if (nextSurah > 114) {
      finishPlayback();
      return;
    }
    set({_versePlayCount: 1});
    void playSurahFrom(nextSurah, null);
  };

  const registerCallbacks = () => {
    mushafAudioService.setOnAyahChange(handleEntryChange);
    mushafAudioService.setOnSurahEnd(handleSurahEnd);
  };

  return {
    jumpToEntry,
    loadSurahAudio,
    prepareSurah,
    registerCallbacks,
  };
}

export const useMushafPlayerStore = create<MushafPlayerStoreState>()(
  persist(
    (set, get) => {
      const engine = createPlaybackEngine(set, get);

      return {
        // Runtime state defaults
        playbackState: 'idle',
        currentSurah: 0,
        currentAyah: 0,
        currentVerseKey: null,
        currentVerseKeys: NO_KEYS,
        currentReciterVerseKey: null,
        currentVerseLabel: null,
        currentUnitKeys: NO_KEYS, // @ai
        currentUnitRewayah: null, // @ai
        numberingMode: null,
        currentPage: null,
        timestamps: null,
        rangeStart: null,
        rangeEnd: null,
        rangeUnits: null, // @ai
        pendingStartUnit: null, // @ai
        availableReciters: [],
        pendingStartVerseKey: null,
        ignoredStartVerseKey: null, // @ai
        timestampError: null,
        _versePlayCount: 1,
        _rangePlayCount: 1,
        _entryAyah: 0,
        _numbering: null,
        isImmersive: false,
        isSearchMode: false,

        // Persisted preferences defaults
        rewayatId: null,
        reciterName: null,
        rate: 1.0,
        verseRepeatCount: 1,
        rangeRepeatCount: 1,

        setPlaybackState: (state: PlaybackState) => {
          set({playbackState: state});
        },

        setCurrentAyah: (surah: number, ayah: number) => {
          set(verseStateFor(get()._numbering, surah, ayah));
        },

        setReciter: (rewayatId: string, reciterName: string) => {
          set({rewayatId, reciterName});
        },

        setRate: (rate: number) => {
          const clamped = Math.max(0.5, Math.min(2.0, rate));
          mushafAudioService.setRate(clamped);
          set({rate: clamped});
        },

        setVerseRepeatCount: (count: number) => {
          set({verseRepeatCount: count});
        },

        setRangeRepeatCount: (count: number) => {
          set({rangeRepeatCount: count});
        },

        setRange: (start: RangeEndpoint, end: RangeEndpoint) => {
          set({rangeStart: start, rangeEnd: end, rangeUnits: null}); // @ai
        },

        // @ai-start
        setUnitRange: (first: AudioUnitInput, last: AudioUnitInput) => {
          const from = toAudioUnitTarget(first);
          const to = toAudioUnitTarget(last);
          if (from.rewayah !== to.rewayah) {
            throw new Error(
              `[MushafPlayerStore] A range from ${from.rewayah} ${from.key} to ${to.rewayah} ${to.key} mixes two numberings`,
            );
          }
          set({
            rangeUnits: {first: from, last: to},
            // Its Hafs envelope, for Hafs-keyed readers of the range.
            rangeStart: {surah: from.surah, ayah: from.hafsFirstAyah},
            rangeEnd: {surah: to.surah, ayah: to.hafsLastAyah},
          });
        },

        setPendingStart: (unit: AudioUnitInput | null) => {
          const target = unit ? toAudioUnitTarget(unit) : null;
          set({
            pendingStartUnit: target,
            pendingStartVerseKey: target ? unitHafsStartKey(target) : null,
          });
        },
        // @ai-end

        clearRange: () => {
          set({rangeStart: null, rangeEnd: null, rangeUnits: null}); // @ai
        },

        startPlayback: async (
          page: number,
          startAt?: string | AudioUnitInput, // @ai
        ) => {
          const state = get(); // @ai
          const {rewayatId} = state;
          if (!rewayatId) return;
          const session = ++playbackSession;
          followVerseUnits(); // @ai

          set({
            playbackState: 'loading',
            currentPage: page,
            pendingStartVerseKey: null,
            ignoredStartVerseKey: null, // @ai
            timestampError: null,
            _versePlayCount: 1,
            _rangePlayCount: 1,
            pendingStartUnit: null, // @ai
          });

          try {
            // @ai-start
            // The given start (a Hafs key or a verse unit), else the pending
            // start, else the range start, else the page's first verse.
            const target = resolveStart(page, startAt, state);
            if (target.kind === 'none') {
              set({playbackState: 'idle'});
              return;
            }
            if (target.kind === 'invalid') {
              console.warn(
                `[MushafPlayerStore] Invalid start verse key "${target.key}"`,
              );
              set({playbackState: 'idle'});
              return;
            }
            const {
              surah: surahNumber,
              ayah: ayahNumber,
              unit: startUnit,
            } = target.point;
            // @ai-end

            const prepared = await engine.prepareSurah(rewayatId, surahNumber);
            if (session !== playbackSession) return;
            if (!prepared) {
              console.warn(
                `[MushafPlayerStore] No timestamps for rewayat=${rewayatId} surah=${surahNumber}`,
              );
              set({
                playbackState: 'idle',
                timestampError: TIMESTAMPS_UNAVAILABLE_ERROR,
              });
              return;
            }
            const {timestamps, numbering} = prepared;

            if (numbering.mode === 'disabled') {
              console.warn(
                `[MushafPlayerStore] Verse numbering unavailable for rewayat=${rewayatId} surah=${surahNumber}: ${numbering.reason}`,
              );
              const {verseRepeatCount, rangeRepeatCount} = get();
              if (verseRepeatCount !== 1 || rangeRepeatCount !== 1) {
                // A repeat cannot be honoured without verse boundaries.
                set({
                  playbackState: 'idle',
                  timestampError: VERSE_TIMING_UNAVAILABLE_ERROR,
                });
                return;
              }
              // Plain playback: the surah plays from its beginning without
              // follow-along (no verse is highlighted rather than a wrong one).
            }

            engine.registerCallbacks();
            engine.loadSurahAudio(
              rewayatId,
              surahNumber,
              timestamps,
              numbering,
              startUnit && startUnit.ayah === 1 ? 1 : ayahNumber, // @ai
            );

            if (numbering.mode !== 'disabled') {
              const start = startEntryAt(numbering, {
                surah: surahNumber,
                ayah: ayahNumber,
                unit: startUnit,
              }); // @ai
              if (start) engine.jumpToEntry(surahNumber, start.ayahNumber);
            }
            // @ai-start
            if (get().playbackState === 'idle') {
              // The range ended at its first entry (it resolved to no verse
              // of this reciter): say so instead of claiming to play.
              set({timestampError: RANGE_UNPLAYABLE_ERROR});
              return;
            }
            // @ai-end
            mushafAudioService.play();

            set({playbackState: 'playing'});
          } catch (error) {
            console.error(
              '[MushafPlayerStore] Failed to start playback:',
              error,
            );
            if (session === playbackSession) set({playbackState: 'idle'});
          }
        },

        stop: () => {
          playbackSession++;
          mushafAudioService.stop();
          set({
            ...CLEARED_VERSE,
            playbackState: 'idle',
            currentSurah: 0,
            numberingMode: null,
            _numbering: null,
            currentPage: null,
            timestamps: null,
            rangeUnits: null, // @ai
            rangeStart: null,
            rangeEnd: null,
            ignoredStartVerseKey: null, // @ai
            timestampError: null,
            _versePlayCount: 1,
            _rangePlayCount: 1,
          });
        },

        computeAvailableReciters: async () => {
          try {
            const available: AvailableReciter[] = [];
            for (const reciter of RECITERS) {
              for (const rewayat of reciter.rewayat) {
                if (timestampFetchService.hasSource(rewayat.id)) {
                  available.push({
                    rewayatId: rewayat.id,
                    reciterName: reciter.name,
                    imageUrl: reciter.image_url,
                    style: rewayat.style,
                  });
                }
              }
            }

            set({availableReciters: available});
          } catch (error) {
            console.error(
              '[MushafPlayerStore] Failed to compute available reciters:',
              error,
            );
          }
        },
      };
    },
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: state => ({
        rewayatId: state.rewayatId,
        reciterName: state.reciterName,
        rate: state.rate,
        verseRepeatCount: state.verseRepeatCount,
        rangeRepeatCount: state.rangeRepeatCount,
      }),
    },
  ),
);

// @ai-start
// The band and the verse label are in the numbering of the mushaf on
// screen. When the reader switches the mushaf's rewayah, or that rewayah's
// verse units become ready (or are refused or dropped), redo both at once,
// also while paused, instead of keeping the previous numbering until the
// next verse. The Hafs keys (page turns) do not change.
function relabelRecitedVerse(): void {
  const s = useMushafPlayerStore.getState();
  const entry = recitedEntry(s);
  if (!entry) return;
  const next = unitStateFor(s._numbering, entry.surah, entry.ayah);
  if (
    next.currentUnitRewayah !== s.currentUnitRewayah ||
    next.currentVerseLabel !== s.currentVerseLabel ||
    verseKeyListId(next.currentUnitKeys) !== verseKeyListId(s.currentUnitKeys)
  ) {
    useMushafPlayerStore.setState(next);
  }
}

// Guarded: a stand-in settings store (tests) may only offer getState.
if (typeof useMushafSettingsStore?.subscribe === 'function') {
  useMushafSettingsStore.subscribe((settings, previous) => {
    if (settings.rewayah !== previous.rewayah) relabelRecitedVerse();
  });
} else if (__DEV__ && useMushafSettingsStore === undefined) {
  // Not defined yet when this module is evaluated: an import cycle.
  console.warn(
    "[MushafPlayerStore] mushafSettingsStore is not defined yet (an import cycle?): the verse label will not follow the mushaf's rewayah",
  );
}

let stopFollowingVerseUnits: (() => void) | null = null;

/**
 * Relabel whenever the words in memory change (a rewayah's verse units may
 * have become ready). Subscribed by the first playback, so loading this
 * store does not load the words data service.
 */
function followVerseUnits(): void {
  if (!stopFollowingVerseUnits) {
    stopFollowingVerseUnits = subscribeVerseUnitsChanges(relabelRecitedVerse);
  }
}
// @ai-end

/**
 * Hafs verse keys to highlight for mushaf playback (empty when idle). Use
 * with `useMushafPlayerStore(selectPlaybackVerseKeys)`.
 */
export function selectPlaybackVerseKeys(
  s: MushafPlayerStoreState,
): readonly string[] {
  return s.playbackState === 'idle' ? NO_KEYS : s.currentVerseKeys;
}

/** True while `verseKey` (Hafs) is being recited by the mushaf player. */
export function isVerseKeyPlaying(
  s: MushafPlayerStoreState,
  verseKey: string,
): boolean {
  return s.playbackState !== 'idle' && s.currentVerseKeys.includes(verseKey);
}

// @ai-start
/**
 * Value-comparable id of the Hafs verse keys to highlight ('' when idle or
 * when no verse is tracked). For a Hafs recitation it is just
 * currentVerseKey; a reciter verse covering several Hafs verses (Warsh 2:1 =
 * Hafs 2:1 + 2:2) lists them all.
 */
export function selectPlaybackVerseKeysId(s: MushafPlayerStoreState): string {
  if (s.playbackState === 'idle') return '';
  if (s.currentVerseKeys.length > 0) return verseKeyListId(s.currentVerseKeys);
  return s.currentVerseKey ?? '';
}

/**
 * Every Hafs verse key the mushaf player is reciting (empty when idle): what
 * every follow-along highlight must paint. Re-renders only when the set of
 * keys changes.
 */
export function usePlaybackVerseKeys(): readonly string[] {
  const id = useMushafPlayerStore(selectPlaybackVerseKeysId);
  return useMemo(() => parseVerseKeyListId(id), [id]);
}

/** The range as verse units while it is in effect (see rangeUnits), else null. */
export const selectRangeUnits = activeRangeUnits;

/** The pending start as a verse unit while it is in effect, else null. */
export const selectPendingStartUnit = activePendingStartUnit;

/**
 * Value-comparable id of the follow-along band as verse unit keys of
 * `rewayah` (default: the mushaf on screen); '' when idle or when nothing
 * with a verse number in that rewayah is being recited. See
 * usePlaybackUnitKeys().
 */
export function selectPlaybackUnitKeysId(
  s: MushafPlayerStoreState,
  rewayah: RewayahId = displayRewayah(),
): string {
  if (s.playbackState === 'idle') return '';
  if (s.currentUnitRewayah === rewayah) {
    return verseKeyListId(s.currentUnitKeys);
  }
  const entry = recitedEntry(s);
  if (!entry) return '';
  return verseKeyListId(
    bandUnitKeys(s._numbering, entry.surah, entry.ayah, rewayah),
  );
}

/**
 * The mushaf player's follow-along band as verse unit keys of `rewayah`
 * (default: the rewayah of the mushaf on screen): what every band painter
 * that draws that rewayah's verses (segments by verse unit) must paint.
 * When the reciter's timing entries are that rewayah's own verses the band
 * is exactly the verse being recited, so it moves at the rewayah's own verse
 * ends (Warsh 1:6, then Warsh 1:7, inside Hafs 1:7); otherwise it is every
 * verse holding a word of what is recited. Hafs: the same keys as
 * usePlaybackVerseKeys(). Empty when idle or when that rewayah's verse
 * units are not available. Re-renders only when the keys change.
 */
export function usePlaybackUnitKeys(rewayah?: RewayahId): readonly string[] {
  const selector = useCallback(
    (s: MushafPlayerStoreState) => selectPlaybackUnitKeysId(s, rewayah),
    [rewayah],
  );
  const id = useMushafPlayerStore(selector);
  return useMemo(() => parseVerseKeyListId(id), [id]);
}

/**
 * What the player is reciting, for the player bar and the iOS 26 toolbar:
 * "Al-Baqarah 2:4" (verse in the numbering of the mushaf on screen),
 * "Al-Mulk · Verse tracking unavailable", or just the surah name when no
 * verse is being recited yet.
 */
export function formatPlaybackInfo(
  surahName: string,
  s: Pick<MushafPlayerStoreState, 'currentVerseLabel' | 'numberingMode'>,
): string {
  if (s.numberingMode === 'disabled') {
    return `${surahName} · ${VERSE_TRACKING_UNAVAILABLE_LABEL}`;
  }
  if (s.currentVerseLabel) return `${surahName} ${s.currentVerseLabel}`;
  return surahName;
}

export interface PlaybackNotice {
  title: string;
  message: string;
  preset: 'error' | 'none';
}

type NoticeState = Pick<
  MushafPlayerStoreState,
  'playbackState' | 'timestampError' | 'numberingMode' | 'currentSurah'
> &
  Partial<Pick<MushafPlayerStoreState, 'ignoredStartVerseKey'>>;

/**
 * Notice for entering a surah that plays without verse tracking, or null.
 * When playback was asked to start at a later verse it says the surah plays
 * from its beginning instead, also when that surah was already playing
 * untracked (a new start request in it skips a verse again).
 */
function untrackedSurahNotice(
  prev: NoticeState,
  next: NoticeState,
  surahName: (surah: number) => string,
): PlaybackNotice | null {
  const newlySkipped =
    !!next.ignoredStartVerseKey &&
    next.ignoredStartVerseKey !== prev.ignoredStartVerseKey;
  if (
    next.playbackState === 'idle' ||
    next.numberingMode !== 'disabled' ||
    (prev.numberingMode === 'disabled' &&
      prev.currentSurah === next.currentSurah &&
      !newlySkipped)
  ) {
    return null;
  }
  const name = surahName(next.currentSurah);
  const subject = name ? `${name} plays` : 'This surah plays';
  return {
    title: VERSE_TRACKING_UNAVAILABLE_LABEL,
    message: next.ignoredStartVerseKey
      ? `${subject} from the beginning without verse tracking for this reciter.`
      : `${subject} without verse highlighting for this reciter.`,
    preset: 'none',
  };
}

/**
 * Messages the player bar shows inline, as a one-off notice for surfaces
 * that have no room for them (the iOS 26 toolbar): a refused or impossible
 * playback request, and a surah that plays without verse tracking (from its
 * beginning, when a later start verse was asked for; the bar shows that part
 * as a notice too, see getPlayerBarNotice). Null when the transition from
 * `prev` to `next` shows nothing new.
 */
export function getPlaybackNotice(
  prev: NoticeState,
  next: NoticeState,
  surahName: (surah: number) => string,
): PlaybackNotice | null {
  if (next.timestampError && next.timestampError !== prev.timestampError) {
    return {
      title: 'Playback unavailable',
      message: next.timestampError,
      preset: 'error',
    };
  }
  return untrackedSurahNotice(prev, next, surahName);
}

/**
 * The notices the player bar shows as toasts: it shows refusals and
 * "Verse tracking unavailable" inline, but not that a requested start verse
 * was skipped because the surah plays from its beginning.
 */
export function getPlayerBarNotice(
  prev: NoticeState,
  next: NoticeState,
  surahName: (surah: number) => string,
): PlaybackNotice | null {
  if (!next.ignoredStartVerseKey) return null;
  return untrackedSurahNotice(prev, next, surahName);
}
// @ai-end
