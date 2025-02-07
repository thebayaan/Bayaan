import {create} from 'zustand';
import {persist, createJSONStorage} from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import TrackPlayer, {RepeatMode} from 'react-native-track-player';
import {saveLastTrack, saveLastPosition} from '@/utils/trackPersistence';
import {Track, ensureTrackFields} from '@/types/audio';
import {QueueManager} from '@/services/QueueManager';
import {PlayerColorState, PlayerColorActions} from '@/types/playerColors';
import {PlayerColors, CachedReciterColors} from '@/utils/playerColorUtils';

interface PlayerState extends PlayerColorState {
  activeTrackId: string | null;
  activeTrack: Track | null;
  progress: number;
  duration: number;
  isPlaying: boolean;
  isLoading: boolean;
  sleepTimer: NodeJS.Timeout | null;
  sleepTimerEnd: number | 'END_OF_SURAH' | null;
  playbackSpeed: number;
  repeatMode: 'off' | 'all' | 'once';
  queue: Track[];
  setQueue: (queue: Track[]) => void;
  addToQueue: (track: Track) => Promise<void>;
  removeFromQueue: (index: number) => Promise<void>;
  clearQueue: () => Promise<void>;
  getQueue: () => Promise<Track[]>;
  setActiveTrack: (track: Track) => Promise<void>;
  togglePlayback: () => Promise<void>;
  loadAndPlayTrack: (track: Track) => Promise<void>;
  setSleepTimer: (minutes: number | 'END_OF_SURAH') => void;
  clearSleepTimer: () => void;
  setPlaybackSpeed: (speed: number) => void;
  toggleRepeatMode: () => void;
  isEndOfSurahTimer: boolean;
  handleTrackEnd: () => void;
  seekTo: (position: number) => Promise<void>;
  skipToNext: () => Promise<void>;
  favoriteTrackIds: string[];
  toggleFavoriteTrack: (favoriteKey: string) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  setIsLoading: (isLoading: boolean) => void;
  currentTrack: Track | null;
  setCurrentTrack: (track: Track | null) => void;
  updateCurrentTrack: () => Promise<void>;
  cleanup: () => Promise<void>;
  isPlayerSheetVisible: boolean;
  setPlayerSheetVisible: (visible: boolean) => void;
  colors: PlayerColors | null;
  cachedColors: {[reciterName: string]: CachedReciterColors};
  setColors: (colors: PlayerColors) => void;
  setCachedColors: (reciterName: string, colors: CachedReciterColors) => void;
  clearCachedColors: () => void;
}

export const usePlayerStore = create<PlayerState & PlayerColorActions>()(
  persist(
    (set, get) => ({
      activeTrackId: null,
      activeTrack: null,
      progress: 0,
      duration: 0,
      isPlaying: false,
      isLoading: false,
      sleepTimer: null,
      sleepTimerEnd: null,
      playbackSpeed: 1,
      repeatMode: 'off',
      queue: [],
      isEndOfSurahTimer: false,
      favoriteTrackIds: [],
      currentTrack: null,
      isPlayerSheetVisible: false,
      colors: null,
      cachedColors: {},

      setQueue: (queue: Track[]) => set({queue}),

      setActiveTrack: async (track: Track) => {
        try {
          await TrackPlayer.reset();
          await TrackPlayer.add(track);
          await TrackPlayer.play();
          set({
            activeTrack: ensureTrackFields(track),
            currentTrack: ensureTrackFields(track),
          });
          await saveLastTrack(track);
        } catch (error) {
          console.error('Error setting active track:', error);
        }
      },

      togglePlayback: async () => {
        const state = get();
        if (state.isLoading) return; // Prevent multiple toggles while loading

        try {
          set({isLoading: true});
          const currentTrack = await TrackPlayer.getCurrentTrack();

          if (currentTrack === null && state.queue.length > 0) {
            // If no track is loaded but we have tracks in queue, load the first one
            await TrackPlayer.skip(0);
          }

          if (state.isPlaying) {
            await TrackPlayer.pause();
          } else {
            await TrackPlayer.play();
          }

          set({
            isPlaying: !state.isPlaying,
            isLoading: false,
          });
        } catch (error) {
          console.error('Error in togglePlayback:', error);
          set({
            isPlaying: state.isPlaying, // Revert on error
            isLoading: false,
          });
        }
      },

      loadAndPlayTrack: async track => {
        try {
          // Optimistic updates
          set({
            currentTrack: track,
            isPlaying: true,
            isLoading: true,
          });

          await TrackPlayer.reset();
          await TrackPlayer.add([track]);
          await TrackPlayer.play();

          // Update state after successful load
          set({isLoading: false});
        } catch (error) {
          // Reset state on error
          set({
            currentTrack: null,
            isPlaying: false,
            isLoading: false,
          });
          console.error('Error in loadAndPlayTrack:', error);
          throw error;
        }
      },

      setSleepTimer: minutes => {
        const {sleepTimer} = get();
        if (sleepTimer) {
          clearTimeout(sleepTimer);
        }

        if (minutes === 'END_OF_SURAH') {
          set({
            isEndOfSurahTimer: true,
            sleepTimer: null,
            sleepTimerEnd: 'END_OF_SURAH',
          });
        } else {
          const endTime = Date.now() + minutes * 60 * 1000;
          const timer = setTimeout(
            () => {
              TrackPlayer.pause();
              set({
                sleepTimer: null,
                sleepTimerEnd: null,
                isEndOfSurahTimer: false,
                isPlaying: false,
              });
            },
            minutes * 60 * 1000,
          );

          set({
            sleepTimer: timer,
            sleepTimerEnd: endTime,
            isEndOfSurahTimer: false,
          });
        }
      },
      clearSleepTimer: () => {
        const {sleepTimer} = get();
        if (sleepTimer) {
          clearTimeout(sleepTimer);
          set({sleepTimer: null, sleepTimerEnd: null});
        }
      },

      setPlaybackSpeed: async speed => {
        try {
          await TrackPlayer.setRate(speed);
          set({playbackSpeed: speed});
        } catch (error) {
          console.error('Error setting playback speed:', error);
        }
      },

      toggleRepeatMode: () => {
        const currentMode = get().repeatMode;
        let newMode: 'off' | 'all' | 'once';
        if (currentMode === 'off') {
          newMode = 'all';
        } else if (currentMode === 'all') {
          newMode = 'once';
        } else {
          newMode = 'off';
        }
        set({repeatMode: newMode});
        TrackPlayer.setRepeatMode(
          newMode === 'off'
            ? RepeatMode.Off
            : newMode === 'all'
              ? RepeatMode.Queue
              : RepeatMode.Track,
        );
      },

      handleTrackEnd: async () => {
        const {isEndOfSurahTimer, repeatMode} = get();
        if (isEndOfSurahTimer) {
          await TrackPlayer.stop();
          set({isEndOfSurahTimer: false});
        } else {
          switch (repeatMode) {
            case 'once':
              await TrackPlayer.seekTo(0);
              await TrackPlayer.play();
              break;
            case 'all': {
              const queue = await TrackPlayer.getQueue();
              const currentIndex = await TrackPlayer.getActiveTrackIndex();
              if (currentIndex !== null && currentIndex === queue.length - 1) {
                await TrackPlayer.skip(0);
              } else {
                await TrackPlayer.skipToNext();
              }
              await TrackPlayer.play();
              break;
            }
            case 'off': {
              const currentIndex = await TrackPlayer.getActiveTrackIndex();
              const queue = await TrackPlayer.getQueue();
              if (
                currentIndex !== undefined &&
                currentIndex < queue.length - 1
              ) {
                await TrackPlayer.skipToNext();
                await TrackPlayer.play();
              } else {
                await TrackPlayer.seekTo(0);
                await TrackPlayer.pause();
                set({isPlaying: false});
              }
              break;
            }
          }
        }
      },

      seekTo: async (position: number) => {
        try {
          await TrackPlayer.seekTo(position);
        } catch (error) {
          console.error('Error seeking:', error);
        }
      },

      skipToNext: async () => {
        try {
          await TrackPlayer.skipToNext();
        } catch (error) {
          console.error('Error skipping to next track:', error);
        }
      },

      addToQueue: async (track: Track) => {
        try {
          const queueManager = QueueManager.getInstance();
          await queueManager.addToQueue(track);
        } catch (error) {
          console.error('Error in addToQueue:', error);
          throw error;
        }
      },

      removeFromQueue: async (index: number) => {
        try {
          const queueManager = QueueManager.getInstance();
          await queueManager.removeFromQueue(index);
        } catch (error) {
          console.error('Error in removeFromQueue:', error);
          throw error;
        }
      },

      clearQueue: async () => {
        try {
          const queueManager = QueueManager.getInstance();
          await queueManager.clearQueue();
        } catch (error) {
          console.error('Error in clearQueue:', error);
          throw error;
        }
      },

      getQueue: async () => {
        try {
          const queueManager = QueueManager.getInstance();
          return await queueManager.getQueue();
        } catch (error) {
          console.error('Error in getQueue:', error);
          throw error;
        }
      },

      toggleFavoriteTrack: (favoriteKey: string) => {
        set(state => {
          const updatedFavorites = state.favoriteTrackIds.includes(favoriteKey)
            ? state.favoriteTrackIds.filter(id => id !== favoriteKey)
            : [...state.favoriteTrackIds, favoriteKey];
          return {favoriteTrackIds: updatedFavorites};
        });
      },

      setIsPlaying: (isPlaying: boolean) => {
        set({isPlaying});
      },
      setIsLoading: (isLoading: boolean) => {
        set({isLoading});
      },
      setCurrentTrack: (track: Track | null) => {
        if (track) {
          set({currentTrack: ensureTrackFields(track)});
        } else {
          set({currentTrack: null});
        }
      },

      updateCurrentTrack: async () => {
        const trackIndex = await TrackPlayer.getCurrentTrack();
        if (trackIndex !== null) {
          const libraryTrack = await TrackPlayer.getTrack(trackIndex);
          if (libraryTrack) {
            const track = ensureTrackFields(libraryTrack);
            set({currentTrack: track});
            await saveLastTrack(track);
            const position = await TrackPlayer.getPosition();
            await saveLastPosition(position);
          }
        }
      },

      cleanup: async () => {
        const {clearSleepTimer} = get();
        clearSleepTimer();
        await TrackPlayer.reset();
        set({
          activeTrackId: null,
          activeTrack: null,
          currentTrack: null,
          isPlaying: false,
          isLoading: false,
        });
      },
      setPlayerSheetVisible: (visible: boolean) =>
        set({isPlayerSheetVisible: visible}),

      setColors: (colors: PlayerColors) => {
        set({colors});
      },

      setCachedColors: (reciterName: string, colors: CachedReciterColors) => {
        set(state => ({
          cachedColors: {
            ...state.cachedColors,
            [reciterName]: colors,
          },
        }));
      },

      clearCachedColors: () => {
        set({cachedColors: {}});
      },
    }),
    {
      name: 'player-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: state => ({...state}),
    },
  ),
);
