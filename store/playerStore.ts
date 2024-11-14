import {create} from 'zustand';
import {persist} from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import TrackPlayer, {
  Event,
  State,
  Track,
  RepeatMode,
} from 'react-native-track-player';

interface PlayerState {
  activeTrackId: string | null;
  activeTrack: {
    id: string;
    reciterId: string;
    title: string;
    artist: string;
    artwork: string;
  } | null;
  progress: number;
  duration: number;
  isPlaying: boolean;
  sleepTimer: NodeJS.Timeout | null;
  sleepTimerEnd: number | 'END_OF_SURAH' | null;
  playbackSpeed: number;
  repeatMode: 'off' | 'all' | 'once';
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
  queue: Track[];
  addToQueue: (track: Track) => Promise<void>;
  removeFromQueue: (index: number) => Promise<void>;
  clearQueue: () => Promise<void>;
  getQueue: () => Promise<Track[]>;
  setIsPlaying: (isPlaying: boolean) => void;
  currentTrack: Track | null;
  setCurrentTrack: (track: Track | null) => void;
  updateCurrentTrack: () => Promise<void>;
  cleanup: () => Promise<void>;
}

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set, get) => ({
      activeTrackId: null,
      activeTrack: null,
      progress: 0,
      duration: 0,
      isPlaying: false,
      sleepTimer: null,
      sleepTimerEnd: null,
      playbackSpeed: 1,
      repeatMode: 'off',
      isEndOfSurahTimer: false,
      favoriteTrackIds: [],
      setActiveTrack: async track => {
        set({activeTrackId: track.id});
      },

      togglePlayback: async () => {
        const {isPlaying} = get();
        try {
          if (isPlaying) {
            await TrackPlayer.pause();
          } else {
            await TrackPlayer.play();
          }
          set({isPlaying: !isPlaying});
        } catch (error) {
          console.error('Error in togglePlayback:', error);
        }
      },

      loadAndPlayTrack: async track => {
        try {
          await TrackPlayer.reset();
          await TrackPlayer.add([track]);
          const queue = await TrackPlayer.getQueue();

          // Wait for the track to be loaded
          await new Promise<void>(resolve => {
            const listener = TrackPlayer.addEventListener(
              Event.PlaybackState,
              async ({state}) => {
                if (state === State.Ready) {
                  listener.remove();
                  resolve();
                }
              },
            );
          });

          await TrackPlayer.play();
          set({activeTrackId: track.id, isPlaying: true, queue});
        } catch (error) {
          console.error('Error in loadAndPlayTrack:', error);
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

      toggleFavoriteTrack: (favoriteKey: string) => {
        set(state => {
          const updatedFavorites = state.favoriteTrackIds.includes(favoriteKey)
            ? state.favoriteTrackIds.filter(id => id !== favoriteKey)
            : [...state.favoriteTrackIds, favoriteKey];
          return {favoriteTrackIds: updatedFavorites};
        });
      },

      queue: [],

      addToQueue: async (track: Track) => {
        const {queue} = get();
        const newQueue = [...queue, track];
        await TrackPlayer.add(track);
        set({queue: newQueue});
      },

      removeFromQueue: async (index: number) => {
        const {queue} = get();
        const newQueue = queue.filter((_, i) => i !== index);
        await TrackPlayer.remove(index);
        set({queue: newQueue});
      },

      clearQueue: async () => {
        await TrackPlayer.reset();
        set({queue: []});
      },

      getQueue: async () => {
        const queue = await TrackPlayer.getQueue();
        set({queue});
        return queue;
      },
      setIsPlaying: (isPlaying: boolean) => {
        set({isPlaying});
      },
      currentTrack: null,

      setCurrentTrack: track => {
        set({currentTrack: track});
      },

      updateCurrentTrack: async () => {
        const trackIndex = await TrackPlayer.getCurrentTrack();
        if (trackIndex !== null) {
          const track = await TrackPlayer.getTrack(trackIndex);
          set({currentTrack: track || null});
        } else {
          set({currentTrack: null});
        }
      },

      cleanup: async () => {
        try {
          await TrackPlayer.reset();
          await TrackPlayer.stop();
          set({
            activeTrackId: null,
            activeTrack: null,
            progress: 0,
            duration: 0,
            isPlaying: false,
            sleepTimer: null,
            sleepTimerEnd: null,
            currentTrack: null,
            queue: [],
          });
        } catch (error) {
          console.error('Error cleaning up player:', error);
        }
      },
    }),
    {
      name: 'player-storage',
      storage: {
        getItem: async name => {
          const value = await AsyncStorage.getItem(name);
          return value ? JSON.parse(value) : null;
        },
        setItem: async (name, value) => {
          await AsyncStorage.setItem(name, JSON.stringify(value));
        },
        removeItem: async name => {
          await AsyncStorage.removeItem(name);
        },
      },
    },
  ),
);
