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
 */

import {useMemo} from 'react'; // @ai
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
import {
  parseVerseKey,
  rewayahVerseMapService,
} from '@/services/mushaf/RewayahVerseMapService';
import type {RewayahId} from '@/services/rewayah/RewayahIdentity';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import {resolveMushafAudioUrl} from '@/utils/mushafAudioUtils';
import {
  formatPlaybackVerseLabel,
  parseVerseKeyListId, // @ai
  verseKeyListId, // @ai
  type TimingNumbering,
  type TimingNumberingMode,
} from '@/utils/timestampNumbering';

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
  /** Verse reference to display, in the numbering of the mushaf on screen. */
  currentVerseLabel: string | null;
  /** Numbering of the loaded surah ('disabled' = no follow-along / seeking). */
  numberingMode: TimingNumberingMode | null;
  currentPage: number | null;
  timestamps: AyahTimestamp[] | null;
  rangeStart: RangeEndpoint | null;
  rangeEnd: RangeEndpoint | null;
  availableReciters: AvailableReciter[];
  pendingStartVerseKey: string | null;
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
  clearRange: () => void;
  /** `startVerseKey` is a Hafs verse key. */
  startPlayback: (page: number, startVerseKey?: string) => Promise<void>;
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

function displayRewayah(): RewayahId {
  try {
    return useMushafSettingsStore.getState().rewayah ?? 'hafs';
  } catch {
    return 'hafs';
  }
}

const CLEARED_VERSE: Pick<
  MushafPlayerStoreState,
  | 'currentAyah'
  | 'currentVerseKey'
  | 'currentVerseKeys'
  | 'currentReciterVerseKey'
  | 'currentVerseLabel'
  | '_entryAyah'
> = {
  currentAyah: 0,
  currentVerseKey: null,
  currentVerseKeys: NO_KEYS,
  currentReciterVerseKey: null,
  currentVerseLabel: null,
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
    currentVerseLabel: formatPlaybackVerseLabel({
      hafsKeys: keys,
      reciterVerseKey,
      mode: numbering ? numbering.mode : 'hafs',
      reciterRewayah: numbering ? numbering.reciterRewayah : null,
      mushafRewayah: displayRewayah(),
      verseMap: rewayahVerseMapService,
    }),
    _entryAyah: entryAyah,
  };
}

function isIdentity(numbering: TimingNumbering | null): boolean {
  return !numbering || numbering.mode === 'hafs';
}

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
  ) => {
    const audioUrl = resolveMushafAudioUrl(rewayatId, surah);
    mushafAudioService.loadSurah(surah, audioUrl, timestamps);
    mushafAudioService.setVerseSeekingEnabled(numbering.mode !== 'disabled');
    mushafAudioService.setRate(get().rate);
    set({
      ...CLEARED_VERSE,
      currentSurah: surah,
      timestamps,
      _numbering: numbering,
      numberingMode: numbering.mode,
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
   * timing entry). Used for advancing to the next surah and for looping a
   * range that started in another surah.
   */
  const playSurahFrom = async (surah: number, hafsAyah: number | null) => {
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
      loadSurahAudio(rewayatId, surah, timestamps, numbering);
      if (numbering.mode !== 'disabled') {
        let start: number | null = 1; // first timing entry
        if (hafsAyah !== null) {
          const startEntry = numbering.startEntryForHafsAyah(hafsAyah);
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
      void playSurahFrom(start.surah, start.ayah);
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
        numberingMode: null,
        currentPage: null,
        timestamps: null,
        rangeStart: null,
        rangeEnd: null,
        availableReciters: [],
        pendingStartVerseKey: null,
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
          set({rangeStart: start, rangeEnd: end});
        },

        clearRange: () => {
          set({rangeStart: null, rangeEnd: null});
        },

        startPlayback: async (page: number, startVerseKey?: string) => {
          const {rewayatId, rangeStart, pendingStartVerseKey} = get();
          if (!rewayatId) return;
          const session = ++playbackSession;

          set({
            playbackState: 'loading',
            currentPage: page,
            pendingStartVerseKey: null,
            timestampError: null,
            _versePlayCount: 1,
            _rangePlayCount: 1,
          });

          try {
            let targetKey = startVerseKey || pendingStartVerseKey;
            if (!targetKey && rangeStart) {
              targetKey = `${rangeStart.surah}:${rangeStart.ayah}`;
            }
            if (!targetKey) {
              const orderedKeys =
                mushafVerseMapService.getOrderedVerseKeysForPage(page);
              if (orderedKeys.length === 0) {
                set({playbackState: 'idle'});
                return;
              }
              targetKey = orderedKeys[0];
            }

            const target = parseVerseKey(targetKey);
            if (!target) {
              console.warn(
                `[MushafPlayerStore] Invalid start verse key "${targetKey}"`,
              );
              set({playbackState: 'idle'});
              return;
            }
            const {surah: surahNumber, ayah: ayahNumber} = target;

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
            );

            if (numbering.mode !== 'disabled') {
              const start = numbering.startEntryForHafsAyah(ayahNumber);
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
            rangeStart: null,
            rangeEnd: null,
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
// @ai-end
