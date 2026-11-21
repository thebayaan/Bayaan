import {create} from 'zustand';
import {persist} from 'zustand/middleware'; // @ai
import {persistStorage} from '@/utils/storage'; // @ai
import {AppState} from 'react-native'; // @ai
import {useNetworkStore} from '@/store/networkStore'; // @ai
import {useReciterStore} from '@/store/reciterStore'; // @ai
import type {AyahTimestamp, AyahTrackingState} from '@/types/timestamps';
import {timestampService} from '@/services/timestamps/TimestampService';
import {timestampFetchService} from '@/services/timestamps/TimestampFetchService'; // @ai
// @ai-start
import {
  getPlayFromHereTarget,
  getPlayFromUnitTarget, // @ai
  type PlayFromHereTarget,
  type TimingLoadStatus,
} from '@/utils/timestampUtils';
import type {
  AudioUnitInput, // @ai
  TimingNumberingMode,
} from '@/utils/timestampNumbering';

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
  /**
   * Surah whose basmala is being recited: the audio is in the intro before
   * that surah's first timing entry (isInBasmalaIntro), so the follow-along
   * highlights its basmala instead of a verse. Null otherwise (also for
   * al-Fatihah and at-Tawbah). Written by the follow-along tracker.
   */
  basmalaIntroSurah: number | null;
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
  /** Written by the follow-along tracker (useAyahTracker). @ai */
  setBasmalaIntroSurah: (surah: number | null) => void;
  loadFollowAlongRegistry: () => void;
  toggleFollowAlong: () => void;
}

// @ai-start
interface FollowAlongChoice {
  followAlongEnabled: boolean;
}

/**
 * Whether the user has Follow Along on, and the only timestamp state that is
 * saved. It was not saved at all, so switching it off lasted until the app
 * was closed. Kept apart from useTimestampStore, which changes with every
 * verse recited and would be written to storage each time.
 * Exported for the foreground retry (services/persistedStores); the app
 * reads the choice through useTimestampStore.
 */
export const useFollowAlongChoice = create<FollowAlongChoice>()(
  persist((): FollowAlongChoice => ({followAlongEnabled: true}), {
    name: 'follow-along-store',
    storage: persistStorage(),
  }),
);
// @ai-end

export const useTimestampStore = create<TimestampState>()((set, get) => ({
  currentAyah: null,
  currentSurahTimestamps: null,
  currentTimestampKey: null,
  timestampRequest: null, // @ai
  timestampLoadStatus: 'idle', // @ai
  trackingNumberingMode: null, // @ai
  basmalaIntroSurah: null, // @ai
  isLocked: true,

  // Follow Along registry defaults
  supportedRewayatIds: new Set<string>(),
  supportedReciterIds: new Set<string>(),
  registryLoaded: false,
  followAlongEnabled: useFollowAlongChoice.getState().followAlongEnabled, // @ai

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
    // The store already holds timings for this track (the track left and
    // came back before the other surah's timings arrived, so two loads of
    // it were in flight): the tracker has already resolved them and will not
    // again, so keep what it published (its numbering mode, the verse being
    // recited). A duplicate load that failed must not wipe them either.
    const held = get();
    if (
      key === held.currentTimestampKey &&
      held.currentSurahTimestamps &&
      (!timestamps || timestamps === held.currentSurahTimestamps)
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
      basmalaIntroSurah: null,
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
      basmalaIntroSurah: null, // @ai
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

  setBasmalaIntroSurah: surah => set({basmalaIntroSurah: surah}),
  // @ai-end

  loadFollowAlongRegistry: () => {
    // @ai-start
    // The same rewayat as mushafPlayerStore.computeAvailableReciters.
    const timed = timestampFetchService.rewayatWithSource();
    const rewayatIds = new Set(timed.map(t => t.rewayat.id));
    const reciterIds = new Set(timed.map(t => t.reciter.id));
    // @ai-end

    console.log(
      `[FollowAlong] Registry loaded: ${rewayatIds.size} rewayat, ${reciterIds.size} reciters`,
    );

    set({
      supportedRewayatIds: rewayatIds,
      supportedReciterIds: reciterIds,
      registryLoaded: true,
    });
  },

  // @ai-start
  toggleFollowAlong: () => {
    const followAlongEnabled = !get().followAlongEnabled;
    set({followAlongEnabled});
    useFollowAlongChoice.setState({followAlongEnabled}); // saved
  },
  // @ai-end
}));

// @ai-start
// The saved choice arriving from storage, at launch or on a later retry of a
// read that failed. Only a change counts: storage with nothing saved also
// reports back, and must not undo what the store holds.
useFollowAlongChoice.subscribe(({followAlongEnabled}, previous) => {
  if (followAlongEnabled === previous.followAlongEnabled) return;
  if (useTimestampStore.getState().followAlongEnabled !== followAlongEnabled) {
    useTimestampStore.setState({followAlongEnabled});
  }
});
// @ai-end

// @ai-start
// The current track's timings failed to load (no connection): they were only
// tried again on "Play from here" or a track change, so a long surah stayed
// "Verse tracking unavailable" long after a brief drop. Try again when the
// connection comes back and when the app returns to the foreground
// (retryTimestamps does nothing unless the last load failed).
function retryFailedTimestamps(): void {
  useTimestampStore
    .getState()
    .retryTimestamps()
    .catch(error => {
      console.warn('[Timestamps] Retrying the verse timing failed:', error);
    });
}

useNetworkStore.subscribe(({isOnline}, previous) => {
  if (isOnline && !previous.isOnline) retryFailedTimestamps();
});

// Who has follow-along is worked out from the catalogue at launch, before
// the catalogue's refresh: reciters whose timings were added since showed no
// follow-along until the next launch. Work it out again whenever the
// catalogue is refilled (dataService then tells the reciter store). Guarded:
// a stand-in reciter store (tests) may only offer getState.
if (typeof useReciterStore?.subscribe === 'function') {
  useReciterStore.subscribe(() => {
    const {registryLoaded, loadFollowAlongRegistry} =
      useTimestampStore.getState();
    if (registryLoaded) loadFollowAlongRegistry();
  });
}

// Not while known to be offline: it would only fail again, hiding the
// notice for the moment it takes.
AppState.addEventListener('change', state => {
  if (state === 'active' && useNetworkStore.getState().isOnline) {
    retryFailedTimestamps();
  }
});
// @ai-end

// @ai-start
/**
 * The main player's "Play from here" on Hafs verse `hafsVerseKey`, from the
 * current track's timings (getPlayFromHereTarget): 'pending' only while they
 * load, and the reason when the load settled without them. A failed load is
 * retried on the way, so the "try again" it asks for can succeed. Given a
 * verse unit of the verse rows' rewayah instead (@ai), it starts exactly at
 * that verse when the timings are numbered by that rewayah
 * (getPlayFromUnitTarget).
 */
export function resolvePlayFromHere(
  hafsVerseKey: string | AudioUnitInput,
): PlayFromHereTarget {
  const state = useTimestampStore.getState();
  const target =
    typeof hafsVerseKey === 'string'
      ? getPlayFromHereTarget(state, hafsVerseKey)
      : getPlayFromUnitTarget(state, hafsVerseKey); // @ai
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
