import {create} from 'zustand';
import {createJSONStorage, persist} from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {Track} from '@/types/audio';
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
import {expoAudioService} from '@/services/audio/ExpoAudioService';

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

/**
 * Helper to load and optionally play a track from the queue
 */
async function loadTrackAtIndex(
  tracks: Track[],
  index: number,
  startPosition = 0,
  autoPlay = false,
): Promise<void> {
  const track = tracks[index];
  if (!track?.url) {
    if (__DEV__) console.warn('[PlayerStore] No track at index:', index);
    return;
  }

  if (__DEV__)
    console.log('[PlayerStore] Loading track:', {
      index,
      title: track.title,
      url: track.url.substring(0, 50) + '...',
      startPosition,
      autoPlay,
    });

  await expoAudioService.loadTrack(track.url);

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
    await expoAudioService.play();
    if (__DEV__ && startPosition > 0)
      console.log('[PlayerStore] POST-PLAY state:', {
        currentTime: expoAudioService.getCurrentTime(),
      });
  }
}

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
              loading: {...state.loading, trackLoading: false},
            }));
          }
        }
      },

      pause: async () => {
        try {
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

        try {
          set(state => ({
            loading: {...state.loading, trackLoading: true},
          }));

          let nextIndex = currentIndex + 1;

          // Handle end of queue
          if (nextIndex >= tracks.length) {
            if (repeatMode === 'queue') {
              nextIndex = 0; // Loop back to start
            } else {
              // End of queue, stay on last track
              if (__DEV__) console.log('[PlayerStore] End of queue reached');
              set(state => ({
                loading: {...state.loading, trackLoading: false},
                playback: {
                  ...state.playback,
                  state: 'ended' as StorePlaybackState,
                },
              }));
              return;
            }
          }

          // Load and play the next track
          await loadTrackAtIndex(tracks, nextIndex, 0, true);

          set(state => ({
            queue: {...state.queue, currentIndex: nextIndex},
            playback: {
              ...state.playback,
              state: 'playing' as StorePlaybackState,
              position: 0,
            },
            loading: {...state.loading, trackLoading: false},
          }));
        } catch (error) {
          console.error('[PlayerStore] Skip to next failed:', error);
          if (error instanceof Error) {
            set(state => ({
              error: {...state.error, playback: error},
              loading: {...state.loading, trackLoading: false},
            }));
          }
        }
      },

      skipToPrevious: async () => {
        const state = get();
        const {tracks, currentIndex} = state.queue;
        const {repeatMode} = state.settings;
        const position = expoAudioService.getPosition();

        try {
          set(state => ({
            loading: {...state.loading, trackLoading: true},
          }));

          // If more than 3 seconds into the track, restart it
          if (position > 3) {
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
              await expoAudioService.seekTo(0);
              set(state => ({
                playback: {...state.playback, position: 0},
                loading: {...state.loading, trackLoading: false},
              }));
              return;
            }
          }

          // Load and play the previous track
          await loadTrackAtIndex(tracks, prevIndex, 0, true);

          set(state => ({
            queue: {...state.queue, currentIndex: prevIndex},
            playback: {
              ...state.playback,
              state: 'playing' as StorePlaybackState,
              position: 0,
            },
            loading: {...state.loading, trackLoading: false},
          }));
        } catch (error) {
          console.error('[PlayerStore] Skip to previous failed:', error);
          if (error instanceof Error) {
            set(state => ({
              error: {...state.error, playback: error},
              loading: {...state.loading, trackLoading: false},
            }));
          }
        }
      },

      seekTo: async (position: number) => {
        try {
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

          set(state => ({
            loading: {
              ...state.loading,
              queueLoading: true,
              stateRestoring: false,
            },
          }));

          // Load the track at the specified index and auto-play
          if (
            tracks.length > 0 &&
            currentIndex >= 0 &&
            currentIndex < tracks.length
          ) {
            await loadTrackAtIndex(tracks, currentIndex, startPosition, true);
          }

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
              queueLoading: false,
              stateRestoring: false,
              trackLoading: false,
            },
            playback: {
              ...state.playback,
              state: 'ready' as StorePlaybackState,
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
              loading: {
                ...state.loading,
                queueLoading: false,
                stateRestoring: false,
                trackLoading: false,
              },
            }));
          }
        }
      },

      addToQueue: async (tracks: Track[]) => {
        try {
          set(state => ({
            loading: {...state.loading, queueLoading: true},
          }));

          // Just add to our state - expo-audio handles single track playback
          set(state => ({
            queue: {
              ...state.queue,
              tracks: [...state.queue.tracks, ...tracks],
              total: state.queue.tracks.length + tracks.length,
            },
            loading: {...state.loading, queueLoading: false},
          }));

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

          const sortedIndices = [...indices].sort((a, b) => b - a);
          const state = get();
          const tracks = [...state.queue.tracks];
          let newCurrentIndex = state.queue.currentIndex;

          for (const index of sortedIndices) {
            if (index >= 0 && index < tracks.length) {
              tracks.splice(index, 1);

              // Adjust currentIndex
              if (index < newCurrentIndex) {
                newCurrentIndex--;
              } else if (index === newCurrentIndex) {
                // Current track was removed - load next or previous
                if (newCurrentIndex >= tracks.length) {
                  newCurrentIndex = tracks.length - 1;
                }
                if (tracks.length > 0) {
                  await loadTrackAtIndex(
                    tracks,
                    newCurrentIndex,
                    0,
                    state.playback.state === 'playing',
                  );
                }
              }
            }
          }

          set(state => ({
            queue: {
              ...state.queue,
              tracks,
              total: tracks.length,
              currentIndex: Math.max(0, newCurrentIndex),
            },
            loading: {...state.loading, queueLoading: false},
          }));
        } catch (error) {
          console.error('[PlayerStore] Remove from queue failed:', error);
          if (error instanceof Error) {
            set(state => ({
              error: {...state.error, queue: error},
              loading: {...state.loading, queueLoading: false},
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

        // Create an interval that checks if the timer has expired
        const interval = setInterval(async () => {
          const currentState = get();
          const endTime = currentState.settings.sleepTimerEnd;

          if (!endTime) {
            clearInterval(interval);
            return;
          }

          const now = Date.now();
          if (now >= endTime) {
            if (__DEV__)
              console.log(
                '[PlayerStore] Sleep timer expired, pausing playback',
              );
            clearInterval(interval);

            // Pause playback
            try {
              await get().pause();
            } catch (error) {
              console.error(
                '[PlayerStore] Error pausing on sleep timer:',
                error,
              );
            }

            // Clear timer state
            set(prevState => ({
              settings: {
                ...prevState.settings,
                sleepTimer: 0,
                sleepTimerEnd: null,
                sleepTimerInterval: null,
              },
            }));
          }
        }, 1000);

        set(currentState => ({
          settings: {
            ...currentState.settings,
            sleepTimer: minutes,
            sleepTimerEnd: sleepTimerEnd,
            sleepTimerInterval: interval,
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
        const state = get();
        if (
          typeof state.settings.sleepTimerInterval === 'object' &&
          state.settings.sleepTimerInterval
        ) {
          clearInterval(state.settings.sleepTimerInterval as NodeJS.Timeout);
        }
        expoAudioService.cleanup();
        set(createDefaultUnifiedPlayerState());
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: state => ({
        settings: {
          ...state.settings,
          // Don't persist the interval object
          sleepTimerInterval: null,
        },
      }),
    },
  ),
);

// Export singleton instance for use in service worker
export const playerStore = usePlayerStore;

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
      await loadTrackAtIndex(tracks, targetIndex, 0, false);
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
