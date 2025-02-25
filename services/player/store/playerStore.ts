import {create} from 'zustand';
import {createJSONStorage, persist} from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import TrackPlayer, {
  State as TrackPlayerState,
  RepeatMode,
} from 'react-native-track-player';
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

const STORAGE_KEY = 'player-store';

/**
 * Interface for the player store
 */
export interface PlayerStoreState extends Omit<UnifiedPlayerState, 'ui'> {
  // UI State
  sheetMode: UIState['sheetMode'];

  // UI Actions
  setSheetMode: (mode: UIState['sheetMode']) => void;

  // Playback Actions
  play: () => Promise<void>;
  pause: () => Promise<void>;
  skipToNext: () => Promise<void>;
  skipToPrevious: () => Promise<void>;
  seekTo: (position: number) => Promise<void>;
  setRate: (rate: number) => Promise<void>;

  // Queue Actions
  updateQueue: (tracks: Track[], currentIndex?: number) => Promise<void>;
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

export const usePlayerStore = create<PlayerStoreState>()(
  persist(
    (set, get) => ({
      ...createDefaultUnifiedPlayerState(),
      // Add UI state
      sheetMode: 'hidden' as const,

      // UI Actions
      setSheetMode: (mode: UIState['sheetMode']) => {
        const currentMode = get().sheetMode;
        if (currentMode === mode) return; // Don't update if mode hasn't changed

        console.log('[PlayerStore] Sheet mode:', {
          from: currentMode,
          to: mode,
        });

        set({sheetMode: mode});
      },

      // Playback Actions
      play: async () => {
        try {
          set(state => ({
            loading: {...state.loading, trackLoading: true},
          }));
          await TrackPlayer.play();
          set(state => ({
            playback: {
              ...state.playback,
              state: TrackPlayerState.Playing,
            },
            loading: {...state.loading, trackLoading: false},
          }));
        } catch (error) {
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
          await TrackPlayer.pause();
          set(state => ({
            playback: {
              ...state.playback,
              state: TrackPlayerState.Paused,
            },
            loading: {...state.loading, trackLoading: false},
          }));
        } catch (error) {
          if (error instanceof Error) {
            set(state => ({
              error: {...state.error, playback: error},
              loading: {...state.loading, trackLoading: false},
            }));
          }
        }
      },

      skipToNext: async () => {
        try {
          set(state => ({
            loading: {...state.loading, trackLoading: true},
          }));
          await TrackPlayer.skipToNext();
          set(state => ({
            queue: {
              ...state.queue,
              currentIndex: state.queue.currentIndex + 1,
            },
            loading: {...state.loading, trackLoading: false},
          }));
        } catch (error) {
          if (error instanceof Error) {
            set(state => ({
              error: {...state.error, playback: error},
              loading: {...state.loading, trackLoading: false},
            }));
          }
        }
      },

      skipToPrevious: async () => {
        try {
          set(state => ({
            loading: {...state.loading, trackLoading: true},
          }));
          await TrackPlayer.skipToPrevious();
          set(state => ({
            queue: {
              ...state.queue,
              currentIndex: Math.max(0, state.queue.currentIndex - 1),
            },
            loading: {...state.loading, trackLoading: false},
          }));
        } catch (error) {
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
          await TrackPlayer.seekTo(position);
          set(state => ({
            playback: {
              ...state.playback,
              position,
            },
          }));
        } catch (error) {
          if (error instanceof Error) {
            set(state => ({
              error: {...state.error, playback: error},
            }));
          }
        }
      },

      setRate: async (rate: number) => {
        try {
          await TrackPlayer.setRate(rate);
          set(state => ({
            playback: {
              ...state.playback,
              rate,
            },
          }));
        } catch (error) {
          if (error instanceof Error) {
            set(state => ({
              error: {...state.error, playback: error},
            }));
          }
        }
      },

      updateQueue: async (tracks: Track[], currentIndex = 0) => {
        try {
          console.log('[PlayerStore] Updating queue:', {
            tracksCount: tracks.length,
            currentIndex,
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

          await TrackPlayer.reset();
          await TrackPlayer.add(tracks);
          await TrackPlayer.skip(currentIndex);

          const queue = await TrackPlayer.getQueue();
          const currentTrack = await TrackPlayer.getCurrentTrack();

          console.log('[PlayerStore] TrackPlayer state after update:', {
            queueLength: queue.length,
            currentTrackIndex: currentTrack,
            targetIndex: currentIndex,
          });

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
              state: TrackPlayerState.Ready,
              position: 0,
              duration: 0,
              buffering: false,
            },
          }));

          console.log('[PlayerStore] Store state after update:', {
            queueLength: tracks.length,
            currentIndex,
            hasCurrentTrack: !!tracks[currentIndex],
          });
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
          await TrackPlayer.add(tracks);
          set(state => ({
            queue: {
              ...state.queue,
              tracks: [...state.queue.tracks, ...tracks],
              total: state.queue.tracks.length + tracks.length,
            },
            loading: {...state.loading, queueLoading: false},
          }));
        } catch (error) {
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
          for (const index of sortedIndices) {
            await TrackPlayer.remove(index);
          }

          set(state => {
            const tracks = [...state.queue.tracks];
            for (const index of sortedIndices) {
              tracks.splice(index, 1);
            }
            return {
              queue: {
                ...state.queue,
                tracks,
                total: tracks.length,
                currentIndex: Math.min(
                  state.queue.currentIndex,
                  tracks.length - 1,
                ),
              },
              loading: {...state.loading, queueLoading: false},
            };
          });
        } catch (error) {
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
          await TrackPlayer.move(fromIndex, toIndex);

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
          if (error instanceof Error) {
            set(state => ({
              error: {...state.error, queue: error},
              loading: {...state.loading, queueLoading: false},
            }));
          }
        }
      },

      setRepeatMode: async (mode: PlaybackSettings['repeatMode']) => {
        try {
          // Map our repeat mode to TrackPlayer's repeat mode
          const trackPlayerMode = {
            none: RepeatMode.Off,
            queue: RepeatMode.Queue,
            track: RepeatMode.Track,
          }[mode];

          // Update TrackPlayer's repeat mode
          await TrackPlayer.setRepeatMode(trackPlayerMode);

          // Update store state
          set(state => ({
            settings: {
              ...state.settings,
              repeatMode: mode,
            },
          }));
        } catch (error) {
          console.error('Error setting repeat mode:', error);
        }
      },

      toggleShuffle: () => {
        set(state => ({
          settings: {
            ...state.settings,
            shuffle: !state.settings.shuffle,
          },
        }));
      },

      setSleepTimer: (minutes: number) => {
        const state = get();

        // Clear any existing timer
        if (
          typeof state.settings.sleepTimer === 'number' &&
          state.settings.sleepTimer > 0
        ) {
          clearTimeout(state.settings.sleepTimer);
        }

        if (minutes === 0) {
          set(currentState => ({
            settings: {
              ...currentState.settings,
              sleepTimer: 0,
            },
          }));
          return;
        }

        // Update state with new timer
        set(currentState => ({
          settings: {
            ...currentState.settings,
            sleepTimer: minutes,
          },
        }));
      },

      toggleSkipSilence: () => {
        set(prevState => ({
          settings: {
            ...prevState.settings,
            skipSilence: !prevState.settings.skipSilence,
          },
        }));
      },

      updatePlaybackState: (playbackState: Partial<PlaybackState>) => {
        set(state => ({
          playback: {
            ...state.playback,
            ...playbackState,
          },
        }));
      },

      updateQueueState: (queueState: Partial<QueueState>) => {
        set(state => ({
          queue: {
            ...state.queue,
            ...queueState,
          },
        }));
      },

      updateLoadingState: (loadingState: Partial<LoadingState>) => {
        set(state => ({
          loading: {
            ...state.loading,
            ...loadingState,
          },
        }));
      },

      setError: (type: keyof ErrorState, error: Error | null) => {
        set(state => ({
          error: {
            ...state.error,
            [type]: error,
          },
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
          typeof state.settings.sleepTimer === 'number' &&
          state.settings.sleepTimer > 0
        ) {
          clearTimeout(state.settings.sleepTimer);
        }
        await TrackPlayer.reset();
        set(createDefaultUnifiedPlayerState());
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: state => ({
        settings: state.settings, // Only persist settings, not queue state
      }),
    },
  ),
);

export const useUnifiedPlayer = () => {
  const store = usePlayerStore();
  return {
    // State
    playback: store.playback,
    queue: store.queue,
    loading: store.loading,
    error: store.error,
    settings: store.settings,
    sheetMode: store.sheetMode,

    // UI Actions
    setSheetMode: store.setSheetMode,

    // Playback Controls
    play: store.play,
    pause: store.pause,
    skipToNext: store.skipToNext,
    skipToPrevious: store.skipToPrevious,
    seekTo: store.seekTo,
    setRate: store.setRate,

    // Queue Management
    updateQueue: store.updateQueue,
    addToQueue: store.addToQueue,
    removeFromQueue: store.removeFromQueue,
    moveInQueue: store.moveInQueue,

    // Settings Management
    setRepeatMode: store.setRepeatMode,
    toggleShuffle: store.toggleShuffle,
    setSleepTimer: store.setSleepTimer,
    toggleSkipSilence: store.toggleSkipSilence,
  };
};

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

    // Reset the TrackPlayer
    await TrackPlayer.reset();

    // Add tracks to TrackPlayer
    await TrackPlayer.add(tracks);

    // Update store state
    store.updateQueueState({
      tracks,
      currentIndex: targetIndex,
    });
    store.updateLoadingState({
      queueLoading: false,
      stateRestoring: false,
      trackLoading: false,
    });

    // Skip to target track
    if (targetIndex > 0) {
      await TrackPlayer.skip(targetIndex);
    }
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
