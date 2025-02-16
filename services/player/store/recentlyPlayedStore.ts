import {create} from 'zustand';
import {persist} from 'zustand/middleware';
import {Reciter} from '@/data/reciterData';
import {Surah} from '@/data/surahData';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface RecentlyPlayedTrack {
  reciter: Reciter;
  surah: Surah;
  progress: number;
  duration: number;
  timestamp: number;
}

interface RecentlyPlayedState {
  recentTracks: RecentlyPlayedTrack[];
  progressMap: Record<string, number>;
  durationMap: Record<string, number>;
  addRecentTrack: (
    reciter: Reciter,
    surah: Surah,
    progress: number,
    duration: number,
  ) => void;
  updateProgress: (
    reciterId: string,
    surahId: number,
    progress: number,
    duration: number,
  ) => void;
  getProgress: (reciterId: string, surahId: number) => number;
  getDuration: (reciterId: string, surahId: number) => number;
  reset: () => void;
}

export const useRecentlyPlayedStore = create<RecentlyPlayedState>()(
  persist(
    (set, get) => ({
      recentTracks: [],
      progressMap: {},
      durationMap: {},

      addRecentTrack: (reciter, surah, progress, duration) => {
        set(state => {
          const key = `${reciter.id}:${surah.id}`;
          const timestamp = Date.now();

          // Batch all updates
          const updates = {
            recentTracks: [] as RecentlyPlayedTrack[],
            progressMap: {...state.progressMap},
            durationMap: {...state.durationMap},
          };

          // Update maps first
          updates.progressMap[key] = progress;
          updates.durationMap[key] = duration;

          // Update track list
          const existingIndex = state.recentTracks.findIndex(
            item =>
              item.reciter.id === reciter.id && item.surah.id === surah.id,
          );

          if (existingIndex !== -1) {
            updates.recentTracks = [
              {
                ...state.recentTracks[existingIndex],
                progress,
                duration,
                timestamp,
              },
              ...state.recentTracks.slice(0, existingIndex),
              ...state.recentTracks.slice(existingIndex + 1),
            ];
          } else {
            updates.recentTracks = [
              {reciter, surah, progress, duration, timestamp},
              ...state.recentTracks,
            ].slice(0, 7); // Keep only last 7 tracks
          }

          return updates;
        });
      },

      updateProgress: (reciterId, surahId, progress, duration) => {
        set(state => {
          const key = `${reciterId}:${surahId}`;
          const newProgressMap = {...state.progressMap, [key]: progress};
          const newDurationMap = {...state.durationMap, [key]: duration};

          // Update the most recent track's progress if it matches
          const updatedTracks = state.recentTracks.map((item, index) => {
            if (
              index === 0 &&
              item.reciter.id === reciterId &&
              item.surah.id === surahId
            ) {
              return {...item, progress, duration};
            }
            return item;
          });

          return {
            recentTracks: updatedTracks,
            progressMap: newProgressMap,
            durationMap: newDurationMap,
          };
        });
      },

      getProgress: (reciterId, surahId) => {
        const state = get();
        const key = `${reciterId}:${surahId}`;
        return state.progressMap[key] || 0;
      },

      getDuration: (reciterId, surahId) => {
        return get().durationMap[`${reciterId}:${surahId}`] || 0;
      },

      reset: () => {
        set({
          recentTracks: [],
          progressMap: {},
          durationMap: {},
        });
      },
    }),
    {
      name: 'player-recently-played-storage',
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
