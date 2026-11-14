import {create} from 'zustand';
import {persist} from 'zustand/middleware';
import {persistStorage} from '@/utils/storage'; // @ai
import {Track} from '@/types/audio';
import {shuffleArray} from '@/utils/arrayUtils'; // @ai
import {
  UnifiedPlayerState,
  PlaybackState,
  QueueState,
  LoadingState,
  ErrorState,
  PlaybackSettings,
  UIState,
} from '../types/state';
import {createDefaultUnifiedPlayerState} from './validation';
import {computeQueueRemoval} from './queueRemoval'; // @ai
import {expoAudioService} from '@/services/audio/ExpoAudioService';
import {audioCoordinator} from '@/services/audio/AudioCoordinator';
import {analyticsService} from '@/services/analytics/AnalyticsService';
// @ai-start
import {pendingRestoreLoad} from '../utils/restoreLoad';
import {reportPlaybackFailed} from '../utils/playbackFailure';
// @ai-end

const STORAGE_KEY = 'player-store';

// Map our playback state to store state
type StorePlaybackState =
  | 'none'
  | 'loading'
  | 'buffering'
  | 'ready'
  | 'playing'
  | 'paused'
  | 'stopped'
  | 'ended'
  | 'error';

/**
 * Interface for the player store
 */
export interface PlayerStoreState extends Omit<UnifiedPlayerState, 'ui'> {
  // UI State
  sheetMode: UIState['sheetMode'];
  isImmersive: boolean;

  // UI Actions
  setSheetMode: (mode: UIState['sheetMode']) => void;
  toggleImmersive: () => void;
  setImmersive: (value: boolean) => void;

  // Playback Actions
  play: () => Promise<void>;
  pause: () => Promise<void>;
  skipToNext: () => Promise<void>;
  skipToPrevious: () => Promise<void>;
  seekTo: (position: number) => Promise<void>;
  setRate: (rate: number) => Promise<void>;

  // Queue Actions
  updateQueue: (
    tracks: Track[],
    currentIndex?: number,
    startPosition?: number,
  ) => Promise<void>;
  addToQueue: (tracks: Track[]) => Promise<void>;
  removeFromQueue: (indices: number[]) => Promise<void>;
  moveInQueue: (fromIndex: number, toIndex: number) => Promise<void>;
  /** Shuffles the tracks after the current one, leaving it playing. @ai */
  shuffleUpNext: () => void;

  // Settings Actions
  setRepeatMode: (mode: PlaybackSettings['repeatMode']) => void;
  toggleShuffle: () => void;
  setSleepTimer: (minutes: number) => void;
  toggleSkipSilence: () => void;

  // State Updates
  updatePlaybackState: (playbackState: Partial<PlaybackState>) => void;
  updateQueueState: (queueState: Partial<QueueState>) => void;
  updateLoadingState: (loadingState: Partial<LoadingState>) => void;
  setError: (type: keyof ErrorState, error: Error | null) => void;
  reset: () => void;

  // Cleanup
  cleanup: () => Promise<void>;
}

// @ai-start
// A track this close to its end counts as finished when play is pressed:
// the native players do not start again from there (ExoPlayer stays ended).
const END_OF_TRACK_SECONDS = 0.5;

// Bumped by pause(). A load that was started with autoplay checks it before
// it plays, so a pause that lands while a track is still loading (the pause
// button, the sleep timer, another audio source taking over) is not undone
// when the load finishes.
let pauseEpoch = 0;

/**
 * What loadTrackAtIndex() did: 'superseded' (a newer action owns the state,
 * write nothing), 'played' (loaded and playing), or 'loaded' (loaded and
 * left paused: autoplay was off, or a pause landed during the load).
 */
type LoadOutcome = 'superseded' | 'played' | 'loaded';

/** The playback state that a finished load leaves. */
function stateAfterLoad(outcome: LoadOutcome): StorePlaybackState {
  return outcome === 'played' ? 'playing' : 'paused';
}

type TrackUrlResolver = (track: Track) => string;
let trackUrlResolver: TrackUrlResolver = track => track.url;

/**
 * Sets how a queue track's url is chosen at the moment it is loaded.
 * A queue is built once, but what a track should play from changes: a surah
 * downloaded since then should play from its file (and work offline), and
 * one whose download was removed has to stream again. Injected, because the
 * resolver needs modules that import this store. See utils/trackUrl.ts.
 */
export function setTrackUrlResolver(resolver: TrackUrlResolver): void {
  trackUrlResolver = resolver;
}

// The url last handed to the player, and the track it was for. play() uses
// it to tell whether the player still holds the current track.
let loadedSource: {trackId: string; url: string} | null = null;

/** The url that the player holds, or would be given, for `track`. */
function sourceUrlFor(track: Track): string {
  return loadedSource?.trackId === track.id ? loadedSource.url : track.url;
}
// @ai-end

// Monotonic id for the in-flight play operation. Every loadTrackAtIndex()
// claims a fresh id at entry; cleanup() bumps it via pauseForEmptyQueue().
// Without this, two overlapping loads both run to completion: a second tap (a
// rapid skip, or re-queueing while the first load is still awaiting the
// network) starts its own load, then the OLDER one's play() lands after the
// newer one's and its caller's trailing set() clobbers the newer track's state
// — audible track A over a queue that says track B. loadTrackAtIndex re-checks
// the id after each await and returns false when superseded, so callers skip
// their trailing state writes and the last legitimate operation wins.
let playOpId = 0;

/** Invalidate any in-flight loadTrackAtIndex (see playOpId above). */
function invalidatePlayOps(): void {
  playOpId++;
}

/**
 * Current play op id. Loads outside the store (restoreSession's background
 * load) snapshot it and bail when it moves, so they never replace a source a
 * newer play started.
 */
export function currentPlayOpId(): number {
  return playOpId;
}

/**
 * @ai Before a write that leaves no current track (the app then shows no
 * player, so nothing could stop the audio): end the in-flight loads, then
 * pause. A pause failure must not block the write. Returns false when a
 * newer load started during the pause, the same as loadTrackAtIndex().
 * LockScreenService relies on every such write to pause first.
 */
async function pauseForEmptyQueue(): Promise<boolean> {
  const opId = ++playOpId;
  try {
    await expoAudioService.pause();
  } catch (error) {
    if (__DEV__) console.warn('[PlayerStore] Empty-queue pause failed:', error);
  }
  return opId === playOpId;
}

/**
 * Helper to load and optionally play a track from the queue.
 *
 * Returns 'superseded' when the operation was overtaken mid-flight (a
 * cleanup() or a newer load won the race) — the caller MUST skip its trailing
 * state write in that case so the superseding action's state stands.
 */
async function loadTrackAtIndex(
  tracks: Track[],
  index: number,
  startPosition = 0,
  autoPlay = false,
): Promise<LoadOutcome> {
  const track = tracks[index];
  if (!track?.url) {
    if (__DEV__) console.warn('[PlayerStore] No track at index:', index);
    // Not superseded — nothing was loaded, but the caller's op is still the
    // current one, so let it finalize its loading flags as before.
    return 'loaded';
  }

  // Claim the op: any older load still awaiting the network is now stale
  // (last legitimate operation wins — matches the optimistic-set ordering).
  const opId = ++playOpId;
  const pausesAtStart = pauseEpoch; // @ai
  // @ai The url is chosen now, not when the queue was built.
  const url = trackUrlResolver(track);
  loadedSource = {trackId: track.id, url}; // @ai

  if (__DEV__)
    console.log('[PlayerStore] Loading track:', {
      index,
      title: track.title,
      url: url.substring(0, 50) + '...',
      startPosition,
      autoPlay,
    });

  // @ai-start
  try {
    await expoAudioService.loadTrack(url);
  } catch (error) {
    // A superseded load that failed is not the user's problem any more: the
    // newer action owns the state, so do not surface the failure.
    if (opId !== playOpId) return 'superseded';
    throw error;
  }
  // @ai-end
  if (opId !== playOpId) {
    // cleanup() or a newer load landed while we awaited the network — do NOT
    // seek or play; the superseding action's state is authoritative.
    return 'superseded';
  }

  // @ai-start
  // A start position at the very end of the track (a recent card for a surah
  // that was heard to its end) would finish at once and move on to the next
  // surah. The user asked for this one, so start it from the beginning.
  const duration = expoAudioService.getDuration();
  if (duration > 0 && startPosition >= duration - END_OF_TRACK_SECONDS) {
    startPosition = 0;
  }
  // @ai-end

  if (startPosition > 0) {
    if (__DEV__)
      console.log('[PlayerStore] PRE-SEEK state:', {
        startPosition,
        isLoaded: expoAudioService.getIsLoaded(),
        duration: expoAudioService.getDuration(),
        currentTime: expoAudioService.getCurrentTime(),
      });
    await expoAudioService.seekTo(startPosition);
    if (__DEV__)
      console.log('[PlayerStore] POST-SEEK state:', {
        currentTime: expoAudioService.getCurrentTime(),
      });
  }

  if (autoPlay) {
    if (opId !== playOpId) {
      // Superseded during the seek await — same contract as above.
      return 'superseded';
    }
    // @ai A pause landed while this was loading: leave it loaded and paused.
    if (pausesAtStart !== pauseEpoch) return 'loaded';
    await expoAudioService.play();
    if (__DEV__ && startPosition > 0)
      console.log('[PlayerStore] POST-PLAY state:', {
        currentTime: expoAudioService.getCurrentTime(),
      });
    return 'played'; // @ai
  }
  return 'loaded';
}

// @ai-start
/**
 * The loading flags and playback state after a load or play that failed.
 * 'loading' must not stay behind: ExpoAudioProvider ignores the native
 * player's status while the store says loading, so the controls would never
 * settle again.
 */
function failedLoadState(
  state: PlayerStoreState,
): Pick<PlayerStoreState, 'loading' | 'playback'> {
  return {
    loading: {
      ...state.loading,
      queueLoading: false,
      stateRestoring: false,
      trackLoading: false,
    },
    playback:
      state.playback.state === 'loading'
        ? {...state.playback, state: 'paused', buffering: false}
        : state.playback,
  };
}
// @ai-end

export const usePlayerStore = create<PlayerStoreState>()(
  persist(
    (set, get) => ({
      ...createDefaultUnifiedPlayerState(),
      // Add UI state
      sheetMode: 'hidden' as const,
      isImmersive: false,

      // UI Actions
      setSheetMode: (mode: UIState['sheetMode']) => {
        const currentMode = get().sheetMode;
        if (currentMode === mode) return; // Don't update if mode hasn't changed

        if (__DEV__)
          console.log('[PlayerStore] Sheet mode:', {
            from: currentMode,
            to: mode,
          });

        set({sheetMode: mode});
      },

      toggleImmersive: () => {
        set(state => ({isImmersive: !state.isImmersive}));
      },

      setImmersive: (value: boolean) => {
        if (get().isImmersive !== value) {
          set({isImmersive: value});
        }
      },

      // Playback Actions
      play: async () => {
        try {
          set(state => ({
            loading: {...state.loading, trackLoading: true},
          }));

          audioCoordinator.mainWillPlay();

          // @ai-start
          // Let the launch restore finish its load and seek, so this play
          // neither starts at 0:00 under it nor reloads what it is loading.
          await pendingRestoreLoad();

          // The native play() below only resumes a source that is loaded and
          // not at its end. On anything else it is silent while the controls
          // show playing, so work out what should be heard and load it.
          const {tracks, currentIndex} = get().queue;
          const track = tracks[currentIndex];
          if (track?.url) {
            const {playback, settings} = get();
            const ready = expoAudioService.isSourceReady(sourceUrlFor(track));
            // Where the track stands: the player knows once it holds the
            // source; before that, the saved position does.
            const position = ready
              ? expoAudioService.getCurrentTime()
              : playback.position;
            const duration = ready
              ? expoAudioService.getDuration()
              : playback.duration;
            const finished =
              playback.state === 'ended' ||
              (duration > 0 && position >= duration - END_OF_TRACK_SECONDS);

            if (finished || !ready) {
              // A finished track goes on to what follows it, as it would
              // have by itself; after the last one the queue starts again.
              // An unfinished one that is not loaded (the launch restore
              // could not load it, a load failed, the stream broke) is
              // loaded where it was left.
              let index = currentIndex;
              if (finished && settings.repeatMode !== 'track') {
                index = currentIndex < tracks.length - 1 ? currentIndex + 1 : 0;
              }
              const startPosition = finished ? 0 : Math.max(0, position);

              let outcome: LoadOutcome = 'played';
              if (ready && index === currentIndex) {
                await expoAudioService.seekTo(0);
                await expoAudioService.play();
              } else {
                set(state => ({
                  queue: {...state.queue, currentIndex: index},
                  playback: {
                    ...state.playback,
                    state: 'loading' as StorePlaybackState,
                    position: startPosition,
                  },
                }));
                outcome = await loadTrackAtIndex(
                  tracks,
                  index,
                  startPosition,
                  true,
                );
                if (outcome === 'superseded') return; // a newer action won
              }
              set(state => ({
                playback: {
                  ...state.playback,
                  state: stateAfterLoad(outcome),
                  position: startPosition,
                },
                loading: {...state.loading, trackLoading: false},
              }));
              return;
            }
          }
          // @ai-end

          await expoAudioService.play();

          set(state => ({
            playback: {
              ...state.playback,
              state: 'playing' as StorePlaybackState,
            },
            loading: {...state.loading, trackLoading: false},
          }));
        } catch (error) {
          console.error('[PlayerStore] Play failed:', error);
          if (error instanceof Error) {
            set(state => ({
              error: {...state.error, playback: error},
              ...failedLoadState(state), // @ai
            }));
          }
          reportPlaybackFailed(); // @ai
        }
      },

      pause: async () => {
        try {
          pauseEpoch++; // @ai A load that is still in flight must not play.
          set(state => ({
            loading: {...state.loading, trackLoading: true},
          }));

          await expoAudioService.pause();

          set(state => ({
            playback: {
              ...state.playback,
              state: 'paused' as StorePlaybackState,
            },
            loading: {...state.loading, trackLoading: false},
          }));
        } catch (error) {
          console.error('[PlayerStore] Pause failed:', error);
          if (error instanceof Error) {
            set(state => ({
              error: {...state.error, playback: error},
              loading: {...state.loading, trackLoading: false},
            }));
          }
        }
      },

      skipToNext: async () => {
        const state = get();
        const {tracks, currentIndex} = state.queue;
        const {repeatMode} = state.settings;

        // Fire analytics before advancing
        const currentTrack = tracks[currentIndex];
        if (currentTrack?.surahId && !currentTrack.isUserUpload) {
          analyticsService.trackPlaybackSkipped({
            surah_id: parseInt(currentTrack.surahId, 10),
            reciter_id: currentTrack.reciterId,
            reciter_name: currentTrack.reciterName,
            position_ms: Math.round(state.playback.position * 1000),
            listened_ms: Math.round(state.playback.position * 1000),
            direction: 'next',
          });
        }

        try {
          let nextIndex = currentIndex + 1;

          // Handle end of queue
          if (nextIndex >= tracks.length) {
            if (repeatMode === 'queue') {
              nextIndex = 0; // Loop back to start
            } else {
              // @ai-start
              // End of queue: there is no next track, so stay on the last
              // one as it is. This is a user "next" (a track that finishes
              // by itself is handled in ExpoAudioProvider). It used to mark
              // the queue as ended while the last track kept playing or sat
              // paused mid-way, which showed a play button over audible
              // audio and made the next play() restart the queue.
              if (__DEV__) console.log('[PlayerStore] End of queue reached');
              return;
              // @ai-end
            }
          }

          // Optimistic update: set currentIndex immediately so UI updates instantly
          set(state => ({
            queue: {...state.queue, currentIndex: nextIndex},
            loading: {...state.loading, trackLoading: true},
            playback: {
              ...state.playback,
              state: 'loading' as StorePlaybackState,
              position: 0,
            },
          }));

          // Load and play the next track
          audioCoordinator.mainWillPlay();
          const outcome = await loadTrackAtIndex(tracks, nextIndex, 0, true); // @ai
          if (outcome === 'superseded') return; // cleanup()/a newer load won

          set(state => ({
            playback: {
              ...state.playback,
              state: stateAfterLoad(outcome), // @ai
              position: 0,
            },
            loading: {...state.loading, trackLoading: false},
          }));
        } catch (error) {
          console.error('[PlayerStore] Skip to next failed:', error);
          if (error instanceof Error) {
            set(state => ({
              error: {...state.error, playback: error},
              ...failedLoadState(state), // @ai
            }));
          }
          reportPlaybackFailed(); // @ai
        }
      },

      skipToPrevious: async () => {
        const state = get();
        const {tracks, currentIndex} = state.queue;
        const {repeatMode} = state.settings;
        const position = expoAudioService.getPosition();

        // Fire analytics before going back
        const currentTrack = tracks[currentIndex];
        if (currentTrack?.surahId && !currentTrack.isUserUpload) {
          analyticsService.trackPlaybackSkipped({
            surah_id: parseInt(currentTrack.surahId, 10),
            reciter_id: currentTrack.reciterId,
            reciter_name: currentTrack.reciterName,
            position_ms: Math.round(state.playback.position * 1000),
            listened_ms: Math.round(state.playback.position * 1000),
            direction: 'prev',
          });
        }

        try {
          // If more than 3 seconds into the track, restart it (no index change needed)
          if (position > 3) {
            set(state => ({
              loading: {...state.loading, trackLoading: true},
            }));
            await expoAudioService.seekTo(0);
            set(state => ({
              playback: {...state.playback, position: 0},
              loading: {...state.loading, trackLoading: false},
            }));
            return;
          }

          let prevIndex = currentIndex - 1;

          // Handle start of queue
          if (prevIndex < 0) {
            if (repeatMode === 'queue') {
              prevIndex = tracks.length - 1; // Loop to end
            } else {
              // Start of queue, just restart current track
              set(state => ({
                loading: {...state.loading, trackLoading: true},
              }));
              await expoAudioService.seekTo(0);
              set(state => ({
                playback: {...state.playback, position: 0},
                loading: {...state.loading, trackLoading: false},
              }));
              return;
            }
          }

          // Optimistic update: set currentIndex immediately so UI updates instantly
          set(state => ({
            queue: {...state.queue, currentIndex: prevIndex},
            loading: {...state.loading, trackLoading: true},
            playback: {
              ...state.playback,
              state: 'loading' as StorePlaybackState,
              position: 0,
            },
          }));

          // Load and play the previous track
          audioCoordinator.mainWillPlay();
          const outcome = await loadTrackAtIndex(tracks, prevIndex, 0, true); // @ai
          if (outcome === 'superseded') return; // cleanup()/a newer load won

          set(state => ({
            playback: {
              ...state.playback,
              state: stateAfterLoad(outcome), // @ai
              position: 0,
            },
            loading: {...state.loading, trackLoading: false},
          }));
        } catch (error) {
          console.error('[PlayerStore] Skip to previous failed:', error);
          if (error instanceof Error) {
            set(state => ({
              error: {...state.error, playback: error},
              ...failedLoadState(state), // @ai
            }));
          }
          reportPlaybackFailed(); // @ai
        }
      },

      seekTo: async (position: number) => {
        try {
          const currentTrack = get().queue.tracks[get().queue.currentIndex];
          if (currentTrack?.surahId && !currentTrack.isUserUpload) {
            analyticsService.trackPlaybackSeeked({
              surah_id: parseInt(currentTrack.surahId, 10),
              from_ms: Math.round(get().playback.position * 1000),
              to_ms: Math.round(position * 1000),
            });
          }

          await expoAudioService.seekTo(position);
          set(state => ({
            playback: {...state.playback, position},
          }));
        } catch (error) {
          console.error('[PlayerStore] Seek failed:', error);
          if (error instanceof Error) {
            set(state => ({
              error: {...state.error, playback: error},
            }));
          }
        }
      },

      setRate: async (rate: number) => {
        try {
          analyticsService.trackRateChanged({
            old_rate: get().playback.rate,
            new_rate: rate,
          });

          expoAudioService.setRate(rate);
          set(state => ({
            playback: {...state.playback, rate},
          }));
        } catch (error) {
          console.error('[PlayerStore] Set rate failed:', error);
          if (error instanceof Error) {
            set(state => ({
              error: {...state.error, playback: error},
            }));
          }
        }
      },

      updateQueue: async (
        tracks: Track[],
        currentIndex = 0,
        startPosition = 0,
      ) => {
        try {
          if (__DEV__)
            console.log('[PlayerStore] Updating queue:', {
              tracksCount: tracks.length,
              currentIndex,
              startPosition,
              firstTrack: tracks[0]?.title,
              targetTrack: tracks[currentIndex]?.title,
            });

          // Optimistic update: set queue metadata immediately so UI updates instantly
          set(state => ({
            queue: {
              ...state.queue,
              tracks,
              currentIndex,
              total: tracks.length,
              loading: false,
              endReached: false,
            },
            loading: {
              ...state.loading,
              queueLoading: true,
              trackLoading: true,
              stateRestoring: false,
            },
            playback: {
              ...state.playback,
              state: 'loading' as StorePlaybackState,
              position: startPosition,
            },
          }));

          // Load the track at the specified index and auto-play
          let outcome: LoadOutcome | null = null; // @ai
          if (
            tracks.length > 0 &&
            currentIndex >= 0 &&
            currentIndex < tracks.length
          ) {
            audioCoordinator.mainWillPlay();
            outcome = await loadTrackAtIndex(
              tracks,
              currentIndex,
              startPosition,
              true,
            );
            // A cleanup() or a newer play landed while the load awaited the
            // network — keep ITS state; writing 'ready' here would report the
            // superseded track as the ready one (or resurrect a playing state
            // over a queue that has already moved on).
            if (outcome === 'superseded') return;
          }

          // @ai The load above also started playback, so say so. 'ready'
          // here showed a play button over audible audio until the next
          // native status update.
          set(state => ({
            loading: {
              ...state.loading,
              queueLoading: false,
              stateRestoring: false,
              trackLoading: false,
            },
            playback: {
              ...state.playback,
              state: outcome === null ? 'ready' : stateAfterLoad(outcome), // @ai
              position: startPosition,
              duration: expoAudioService.getDuration() || 0,
              buffering: false,
            },
          }));

          if (__DEV__) console.log('[PlayerStore] Queue updated successfully');
        } catch (error) {
          console.error('[PlayerStore] Error updating queue:', error);
          if (error instanceof Error) {
            set(state => ({
              error: {...state.error, queue: error},
              ...failedLoadState(state), // @ai
            }));
          }
          reportPlaybackFailed(); // @ai
        }
      },

      addToQueue: async (tracks: Track[]) => {
        try {
          set(state => ({
            loading: {...state.loading, queueLoading: true},
          }));

          // Just add to our state - expo-audio handles single track playback
          // @ai-start
          // With nothing in the player (first use, or after its queue was
          // cleared) there is no current track, so no player was shown and
          // the added tracks could not be reached. Make the first one
          // current and leave it paused: play() loads it.
          set(state => {
            const hadCurrent =
              state.queue.tracks[state.queue.currentIndex] !== undefined;
            return {
              queue: {
                ...state.queue,
                tracks: [...state.queue.tracks, ...tracks],
                total: state.queue.tracks.length + tracks.length,
                currentIndex:
                  hadCurrent || tracks.length === 0
                    ? state.queue.currentIndex
                    : state.queue.tracks.length,
              },
              loading: {...state.loading, queueLoading: false},
              playback:
                hadCurrent || tracks.length === 0
                  ? state.playback
                  : {
                      ...state.playback,
                      state: 'paused' as StorePlaybackState,
                      position: 0,
                      duration: 0,
                    },
            };
          });
          // @ai-end

          if (__DEV__)
            console.log(
              '[PlayerStore] Added',
              tracks.length,
              'tracks to queue',
            );
        } catch (error) {
          console.error('[PlayerStore] Add to queue failed:', error);
          if (error instanceof Error) {
            set(state => ({
              error: {...state.error, queue: error},
              loading: {...state.loading, queueLoading: false},
            }));
          }
        }
      },

      removeFromQueue: async (indices: number[]) => {
        try {
          set(state => ({
            loading: {...state.loading, queueLoading: true},
          }));

          const {queue, playback} = get();
          const {tracks, index, outcome} = computeQueueRemoval(queue, indices);
          // @ai Read the autoplay intent before the reload. 'loading' means
          // that a load which plays is in flight: only those loads write it.
          const autoPlay = ['playing', 'loading'].includes(playback.state);

          // @ai The state that this op settles; null leaves it to its owner.
          let settled: StorePlaybackState | null = null;
          let stillCurrent = true;
          switch (outcome) {
            case 'currentUnchanged':
              break;
            // @ai-start
            case 'newCurrent': {
              const outcome = await loadTrackAtIndex(
                tracks,
                index,
                0,
                autoPlay,
              );
              stillCurrent = outcome !== 'superseded';
              // 'ready' when it was not playing before; paused when a pause
              // landed during the reload.
              settled = autoPlay ? stateAfterLoad(outcome) : 'ready';
              break;
            }
            // @ai-end
            case 'emptied':
              stillCurrent = await pauseForEmptyQueue();
              settled = 'paused';
              break;
          }
          // Superseded by cleanup()/a newer load: the newer queue stands.
          if (!stillCurrent) return;

          // @ai Re-read the queue after the await. addToQueue() appends, so
          // a track queued during the reload is past the old end: keep it.
          const added = get().queue.tracks.slice(queue.tracks.length);
          set(state => ({
            queue: {
              ...state.queue,
              tracks: [...tracks, ...added],
              total: tracks.length + added.length,
              currentIndex: index,
            },
            loading: {
              ...state.loading,
              queueLoading: false,
              // @ai The winning op clears the flag of the load it superseded.
              trackLoading: settled ? false : state.loading.trackLoading,
            },
            playback: settled
              ? {...state.playback, state: settled, position: 0}
              : state.playback,
          }));
        } catch (error) {
          console.error('[PlayerStore] Remove from queue failed:', error);
          if (error instanceof Error) {
            set(state => ({
              error: {...state.error, queue: error},
              // @ai A failed reload must not leave the controls disabled.
              ...failedLoadState(state),
            }));
          }
        }
      },

      moveInQueue: async (fromIndex: number, toIndex: number) => {
        try {
          set(state => ({
            loading: {...state.loading, queueLoading: true},
          }));

          set(state => {
            const tracks = [...state.queue.tracks];
            const [movedTrack] = tracks.splice(fromIndex, 1);
            tracks.splice(toIndex, 0, movedTrack);

            let newCurrentIndex = state.queue.currentIndex;
            if (state.queue.currentIndex === fromIndex) {
              newCurrentIndex = toIndex;
            } else if (
              fromIndex < state.queue.currentIndex &&
              toIndex >= state.queue.currentIndex
            ) {
              newCurrentIndex--;
            } else if (
              fromIndex > state.queue.currentIndex &&
              toIndex <= state.queue.currentIndex
            ) {
              newCurrentIndex++;
            }

            return {
              queue: {
                ...state.queue,
                tracks,
                currentIndex: newCurrentIndex,
              },
              loading: {...state.loading, queueLoading: false},
            };
          });
        } catch (error) {
          console.error('[PlayerStore] Move in queue failed:', error);
          if (error instanceof Error) {
            set(state => ({
              error: {...state.error, queue: error},
              loading: {...state.loading, queueLoading: false},
            }));
          }
        }
      },

      // @ai-start
      shuffleUpNext: () => {
        set(state => {
          const {tracks, currentIndex} = state.queue;
          return {
            queue: {
              ...state.queue,
              tracks: [
                ...tracks.slice(0, currentIndex + 1),
                ...shuffleArray(tracks.slice(currentIndex + 1)),
              ],
            },
          };
        });
      },
      // @ai-end

      setRepeatMode: (mode: PlaybackSettings['repeatMode']) => {
        // Just update store state - expo-audio doesn't have native repeat mode
        // Repeat logic is handled in skipToNext/handleTrackEnd
        set(state => ({
          settings: {...state.settings, repeatMode: mode},
        }));
        if (__DEV__) console.log('[PlayerStore] Repeat mode set to:', mode);
      },

      toggleShuffle: () => {
        const state = get();
        const newShuffleState = !state.settings.shuffle;

        set(prevState => ({
          settings: {...prevState.settings, shuffle: newShuffleState},
        }));

        if (__DEV__)
          console.log('[PlayerStore] Shuffle toggled to:', newShuffleState);

        // TODO: Implement shuffle logic - shuffle the queue tracks
        // For now, shuffle state is stored but not applied
      },

      setSleepTimer: (minutes: number) => {
        if (__DEV__)
          console.log('[PlayerStore] Setting sleep timer:', minutes, 'minutes');

        const state = get();

        // Clear any existing timer
        if (
          typeof state.settings.sleepTimerInterval === 'object' &&
          state.settings.sleepTimerInterval
        ) {
          clearInterval(state.settings.sleepTimerInterval as NodeJS.Timeout);
        }

        if (minutes === 0) {
          set(currentState => ({
            settings: {
              ...currentState.settings,
              sleepTimer: 0,
              sleepTimerEnd: null,
              sleepTimerInterval: null,
            },
          }));
          return;
        }

        // Calculate when the timer should end
        const milliseconds = Math.round(minutes * 60 * 1000);
        const sleepTimerEnd = Date.now() + milliseconds;

        set(currentState => ({
          settings: {
            ...currentState.settings,
            sleepTimer: minutes,
            sleepTimerEnd: sleepTimerEnd,
            // @ai The expiry itself lives in checkSleepTimer(), below.
            sleepTimerInterval: startSleepTimerTicker(),
          },
        }));
      },

      toggleSkipSilence: () => {
        // Skip silence not supported in expo-audio
        if (__DEV__)
          console.warn(
            '[PlayerStore] Skip silence is not supported with expo-audio',
          );
        set(prevState => ({
          settings: {
            ...prevState.settings,
            skipSilence: !prevState.settings.skipSilence,
          },
        }));
      },

      updatePlaybackState: (playbackState: Partial<PlaybackState>) => {
        set(state => ({
          playback: {...state.playback, ...playbackState},
        }));
      },

      updateQueueState: (queueState: Partial<QueueState>) => {
        set(state => ({
          queue: {...state.queue, ...queueState},
        }));
      },

      updateLoadingState: (loadingState: Partial<LoadingState>) => {
        set(state => ({
          loading: {...state.loading, ...loadingState},
        }));
      },

      setError: (type: keyof ErrorState, error: Error | null) => {
        set(state => ({
          error: {...state.error, [type]: error},
        }));
      },

      reset: () => {
        const defaultState = createDefaultUnifiedPlayerState();
        set(defaultState);
      },

      // Cleanup method
      cleanup: async () => {
        // @ai Pause first: no load may play() or write state after the reset.
        if (!(await pauseForEmptyQueue())) invalidatePlayOps();
        const state = get();
        if (
          typeof state.settings.sleepTimerInterval === 'object' &&
          state.settings.sleepTimerInterval
        ) {
          clearInterval(state.settings.sleepTimerInterval as NodeJS.Timeout);
        }
        expoAudioService.cleanup();
        loadedSource = null; // @ai
        set(createDefaultUnifiedPlayerState());
      },
    }),
    {
      name: STORAGE_KEY,
      storage: persistStorage(), // @ai
      partialize: state => ({
        settings: {
          ...state.settings,
          // Don't persist the interval object
          sleepTimerInterval: null,
        },
        // Persist queue so uploads survive app restart
        queue: {
          tracks: state.queue.tracks,
          currentIndex: state.queue.currentIndex,
          total: state.queue.total,
          loading: false,
          endReached: false,
        },
        // Persist playback position/duration for resume
        playback: {
          state: 'paused' as const,
          position: state.playback.position,
          duration: state.playback.duration,
          rate: state.playback.rate,
          buffering: false,
        },
      }),
      onRehydrateStorage: () => state => {
        if (!state) return;
        // @ai-start
        // The native player starts each launch at 1x. Hand it the restored
        // rate, or the controls show (say) 2x while the audio plays at 1x.
        const restoredRate = state.playback?.rate;
        if (
          typeof restoredRate === 'number' &&
          Number.isFinite(restoredRate) &&
          restoredRate > 0
        ) {
          expoAudioService.setRate(restoredRate);
        } else if (state.playback) {
          state.playback = {...state.playback, rate: 1};
        }
        // @ai-end
        // @ai-start
        // A sleep timer that was running when the app was closed. Its end
        // time is saved but its ticker is not, so the controls showed it
        // counting down after a relaunch and then nothing happened at zero.
        // Start the ticker again while it still has time left; clear it
        // when it ran out while the app was closed.
        const sleepTimerEnd = state.settings?.sleepTimerEnd;
        if (sleepTimerEnd) {
          if (sleepTimerEnd > Date.now()) {
            state.settings = {
              ...state.settings,
              sleepTimerInterval: startSleepTimerTicker(),
            };
          } else {
            state.settings = {
              ...state.settings,
              sleepTimer: 0,
              sleepTimerEnd: null,
              sleepTimerInterval: null,
            };
          }
        }
        // @ai-end
        const tracks = state.queue?.tracks ?? [];
        const hasStaleUrls = tracks.some(
          t => t.url.includes('mp3quran.net') || t.url.includes('supabase.co'),
        );
        if (hasStaleUrls) {
          console.log('[PlayerStore] Clearing stale URLs from persisted queue');
          state.queue = {...state.queue, tracks: [], currentIndex: 0, total: 0};
        }
      },
    },
  ),
);

// Export singleton instance for use in service worker
export const playerStore = usePlayerStore;

// @ai-start
/**
 * Ends the sleep timer when its time has come: stops the Quran audio (the
 * main player, and verse audio in the Mushaf) and clears the timer.
 *
 * It is called from two places. A 1 s ticker covers the app in the
 * foreground and everything on iOS. ExpoAudioProvider also calls it on each
 * native status update, because React Native on Android stops JS timers
 * while the app is in the background: with the screen off the ticker alone
 * never fired, and the audio played on until the app was opened again.
 */
export function checkSleepTimer(now: number = Date.now()): void {
  const {settings, playback} = usePlayerStore.getState();
  const end = settings.sleepTimerEnd;
  if (!end || now < end) return;

  if (__DEV__) console.log('[PlayerStore] Sleep timer expired');
  // Clear it first, so a second caller in the same moment finds no timer.
  if (settings.sleepTimerInterval) clearInterval(settings.sleepTimerInterval);
  usePlayerStore.setState(state => ({
    settings: {
      ...state.settings,
      sleepTimer: 0,
      sleepTimerEnd: null,
      sleepTimerInterval: null,
    },
  }));

  // pause() also holds back a track that is still loading (see pauseEpoch),
  // so a timer that ends between two surahs is not undone by the next one.
  if (['playing', 'buffering', 'loading'].includes(playback.state)) {
    usePlayerStore
      .getState()
      .pause()
      .catch(error => {
        console.error('[PlayerStore] Error pausing on sleep timer:', error);
      });
  }
  // The timer is set in the main player, but it means "stop the recitation".
  audioCoordinator.pauseMushaf?.();
}

/** Starts the 1 s ticker that checks the sleep timer; stops by itself. */
function startSleepTimerTicker(): ReturnType<typeof setInterval> {
  const ticker = setInterval(() => {
    if (!usePlayerStore.getState().settings.sleepTimerEnd) {
      clearInterval(ticker);
      return;
    }
    checkSleepTimer();
  }, 1000);
  return ticker;
}
// @ai-end

export const updateQueue = async (tracks: Track[], targetIndex: number) => {
  const store = usePlayerStore.getState();
  try {
    store.updateLoadingState({
      queueLoading: true,
      stateRestoring: false,
      trackLoading: false,
    });

    // Update store state
    store.updateQueueState({
      tracks,
      currentIndex: targetIndex,
    });

    // Load the target track
    if (tracks.length > 0 && targetIndex >= 0 && targetIndex < tracks.length) {
      const outcome = await loadTrackAtIndex(tracks, targetIndex, 0, false); // @ai
      if (outcome === 'superseded') return; // its owner manages the flags
    }

    store.updateLoadingState({
      queueLoading: false,
      stateRestoring: false,
      trackLoading: false,
    });
  } catch (error) {
    console.error('[PlayerStore] Error updating queue:', error);
    store.updateLoadingState({
      queueLoading: false,
      stateRestoring: false,
      trackLoading: false,
    });
    throw error;
  }
};
