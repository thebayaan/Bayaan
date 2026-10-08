import {create} from 'zustand';
import type {AyahTimestamp, AyahTrackingState} from '@/types/timestamps';
import {timestampService} from '@/services/timestamps/TimestampService';
import {timestampFetchService} from '@/services/timestamps/TimestampFetchService'; // @ai
import {RECITERS} from '@/data/reciterData';
// @ai-start
import {
  getPlayFromHereTarget,
  type PlayFromHereTarget,
  type TimingLoadStatus,
} from '@/utils/timestampUtils';
import type {TimingNumberingMode} from '@/utils/timestampNumbering';

/** The main player track whose timings were last requested. */
export interface TimestampRequest {
  /** `${rewayatId}-${surahNumber}`, the form of currentTimestampKey. */
  key: string;
  rewayatId: string;
  surahNumber: number;
}
// @ai-end

interface TimestampState {
  currentAyah: AyahTrackingState | null;
  currentSurahTimestamps: AyahTimestamp[] | null;
  currentTimestampKey: string | null;
  // @ai-start
  /**
   * The track whose timings were last requested, and where that request
   * stands: a load in flight ('loading') is told apart from one that settled
   * without timings ('not-covered', 'failed'). While a new surah loads,
   * currentSurahTimestamps still holds the previous surah's timings.
   */
  timestampRequest: TimestampRequest | null;
  timestampLoadStatus: TimingLoadStatus;
  /**
   * Verse numbering the follow-along tracker resolved for the loaded
   * timings ('disabled': they cannot be followed). Null while unknown.
   */
  trackingNumberingMode: TimingNumberingMode | null;
  // @ai-end
  isLocked: boolean;

  // Follow Along registry
  supportedRewayatIds: Set<string>;
  supportedReciterIds: Set<string>;
  registryLoaded: boolean;
  followAlongEnabled: boolean;

  setCurrentAyah: (state: AyahTrackingState) => void;
  setIsLocked: (isLocked: boolean) => void;
  clearCurrentAyah: () => void;
  loadTimestampsForSurah: (
    rewayatId: string,
    surahNumber: number,
  ) => Promise<void>;
  clearCurrentTimestamps: () => void;
  /** Loads the current track's timings again after a failed load. @ai */
  retryTimestamps: () => Promise<void>;
  /** Written by the follow-along tracker (useAyahTracker). @ai */
  setTrackingNumberingMode: (mode: TimingNumberingMode | null) => void;
  loadFollowAlongRegistry: () => void;
  toggleFollowAlong: () => void;
}

export const useTimestampStore = create<TimestampState>()((set, get) => ({
  currentAyah: null,
  currentSurahTimestamps: null,
  currentTimestampKey: null,
  timestampRequest: null, // @ai
  timestampLoadStatus: 'idle', // @ai
  trackingNumberingMode: null, // @ai
  isLocked: true,

  // Follow Along registry defaults
  supportedRewayatIds: new Set<string>(),
  supportedReciterIds: new Set<string>(),
  registryLoaded: false,
  followAlongEnabled: true,

  setIsLocked: isLocked => set({isLocked}),

  setCurrentAyah: ayahState => set({currentAyah: ayahState}),

  clearCurrentAyah: () => set({currentAyah: null}),

  loadTimestampsForSurah: async (rewayatId, surahNumber) => {
    const key = `${rewayatId}-${surahNumber}`;
    // @ai-start
    // Requested already: loaded, loading, or known to have no timing. Only a
    // failed load is tried again.
    const {timestampRequest, timestampLoadStatus} = get();
    if (timestampRequest?.key === key && timestampLoadStatus !== 'failed') {
      return;
    }
    set({
      timestampRequest: {key, rewayatId, surahNumber},
      timestampLoadStatus: 'loading',
    });
    // @ai-end

    const timestamps = await timestampService.getTimestampsForSurah(
      rewayatId,
      surahNumber,
    );
    // @ai-start
    // A newer request (the track moved on) or a clear superseded this one:
    // its result must not replace the current track's timings.
    if (get().timestampRequest?.key !== key) return;
    // The very timings the store already holds for this track (the track
    // left and came back before the other surah's timings arrived): the
    // tracker has already resolved them and will not again, so keep what
    // it published (its numbering mode, the verse being recited).
    const held = get();
    if (
      timestamps &&
      timestamps === held.currentSurahTimestamps &&
      key === held.currentTimestampKey
    ) {
      set({timestampLoadStatus: 'ready'});
      return;
    }
    // @ai-end
    set({
      currentSurahTimestamps: timestamps,
      currentTimestampKey: key,
      currentAyah: null,
      // @ai-start
      timestampLoadStatus: timestamps
        ? 'ready'
        : timestampFetchService.hasSurah(rewayatId, surahNumber)
          ? 'failed'
          : 'not-covered',
      trackingNumberingMode: null, // the tracker resolves the new timings
      // @ai-end
    });
  },

  clearCurrentTimestamps: () =>
    set({
      currentSurahTimestamps: null,
      currentTimestampKey: null,
      currentAyah: null,
      timestampRequest: null, // @ai
      timestampLoadStatus: 'idle', // @ai
      trackingNumberingMode: null, // @ai
    }),

  // @ai-start
  retryTimestamps: async () => {
    const {timestampRequest, timestampLoadStatus} = get();
    if (!timestampRequest || timestampLoadStatus !== 'failed') return;
    await get().loadTimestampsForSurah(
      timestampRequest.rewayatId,
      timestampRequest.surahNumber,
    );
  },

  setTrackingNumberingMode: mode => set({trackingNumberingMode: mode}),
  // @ai-end

  loadFollowAlongRegistry: () => {
    const rewayatIds = new Set<string>();
    const reciterIds = new Set<string>();

    for (const reciter of RECITERS) {
      for (const rewayat of reciter.rewayat) {
        if (rewayat.has_timestamps) {
          rewayatIds.add(rewayat.id);
          reciterIds.add(reciter.id);
        }
      }
    }

    console.log(
      `[FollowAlong] Registry loaded: ${rewayatIds.size} rewayat, ${reciterIds.size} reciters`,
    );

    set({
      supportedRewayatIds: rewayatIds,
      supportedReciterIds: reciterIds,
      registryLoaded: true,
    });
  },

  toggleFollowAlong: () =>
    set(state => ({followAlongEnabled: !state.followAlongEnabled})),
}));

// @ai-start
/**
 * The main player's "Play from here" on Hafs verse `hafsVerseKey`, from the
 * current track's timings (getPlayFromHereTarget): 'pending' only while they
 * load, and the reason when the load settled without them. A failed load is
 * retried on the way, so the "try again" it asks for can succeed.
 */
export function resolvePlayFromHere(hafsVerseKey: string): PlayFromHereTarget {
  const state = useTimestampStore.getState();
  const target = getPlayFromHereTarget(state, hafsVerseKey);
  if (state.timestampLoadStatus === 'failed') {
    state.retryTimestamps().catch(error => {
      console.warn('[Timestamps] Retrying the verse timing failed:', error);
    });
  }
  return target;
}

/**
 * True when follow-along is on and offered for the playing reciter, but this
 * surah's verses cannot be followed: it has no timing, its timing could not
 * be loaded, or their verse numbering cannot be established. The player
 * says so (as the mushaf player does: "Verse tracking unavailable") instead
 * of silently highlighting nothing. Use with
 * `useTimestampStore(selectVerseTrackingUnavailable)`.
 */
export function selectVerseTrackingUnavailable(
  s: Pick<
    TimestampState,
    | 'followAlongEnabled'
    | 'supportedRewayatIds'
    | 'timestampRequest'
    | 'timestampLoadStatus'
    | 'trackingNumberingMode'
  >,
): boolean {
  const request = s.timestampRequest;
  if (!s.followAlongEnabled || !request) return false;
  if (!s.supportedRewayatIds.has(request.rewayatId)) return false;
  switch (s.timestampLoadStatus) {
    case 'not-covered':
    case 'failed':
      return true;
    case 'ready':
      return s.trackingNumberingMode === 'disabled';
    default:
      return false;
  }
}
// @ai-end
