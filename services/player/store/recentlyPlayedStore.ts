import {create} from 'zustand';
import {persist} from 'zustand/middleware';
import {Reciter} from '@/data/reciterData';
import {Surah} from '@/data/surahData';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface RecentlyPlayedTrack {
  reciter: Reciter;
  surah: Surah;
  rewayatId: string;
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
    rewayatId: string,
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
  resetTrackProgress: (reciterId: string, surahId: number) => void;
}

export const useRecentlyPlayedStore = create<RecentlyPlayedState>()(
  persist(
    (set, get) => ({
      recentTracks: [],
      progressMap: {},
      durationMap: {},

      addRecentTrack: (reciter, surah, progress, duration, rewayatId) => {
        set(state => {
          const key = `${reciter.id}:${surah.id}`;
          const timestamp = Date.now();

          // Check if the first track is from the same reciter
          if (
            state.recentTracks.length > 0 &&
            state.recentTracks[0].reciter.id === reciter.id
          ) {
            // Update the first track in-place
            const updatedFirstTrack: RecentlyPlayedTrack = {
              ...state.recentTracks[0],
              surah: surah, // Update surah
              progress: progress, // Update progress
              duration: duration, // Update duration
              rewayatId: rewayatId, // Update rewayatId
              timestamp: timestamp, // Update timestamp
            };

            const updatedTracks = [
              updatedFirstTrack,
              ...state.recentTracks.slice(1),
            ];

            // Also update the maps for the *new* key (reciter + new surah)
            const newProgressMap = {...state.progressMap, [key]: progress};
            const newDurationMap = {...state.durationMap, [key]: duration};

            // It might be necessary to remove the map entry for the *old* surah of this reciter
            // if we want to strictly enforce one surah per reciter in the maps as well,
            // but let's keep it simple for now and only update the track list representation.

            return {
              ...state,
              recentTracks: updatedTracks,
              progressMap: newProgressMap,
              durationMap: newDurationMap,
            };
          }

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
                rewayatId,
                timestamp,
              },
              ...state.recentTracks.slice(0, existingIndex),
              ...state.recentTracks.slice(existingIndex + 1),
            ];
          } else {
            updates.recentTracks = [
              {reciter, surah, rewayatId, progress, duration, timestamp},
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

      resetTrackProgress: (reciterId, surahId) => {
        set(state => {
          const key = `${reciterId}:${surahId}`;
          if (
            state.progressMap[key] === undefined &&
            state.durationMap[key] === undefined
          ) {
            // Don't add entries if they don't exist
            return state;
          }

          const newProgressMap = {...state.progressMap, [key]: 0};
          // Keep the existing duration, just reset progress
          const newDurationMap = {...state.durationMap};

          // Find the track in the list and reset its progress
          const updatedTracks = state.recentTracks.map(item => {
            if (item.reciter.id === reciterId && item.surah.id === surahId) {
              return {...item, progress: 0, timestamp: Date.now()}; // Reset progress, update timestamp
            }
            return item;
          });

          // Sort tracks again to potentially bring the reset track to the top if needed?
          // No, let's keep the order, just reset progress where it is.

          return {
            recentTracks: updatedTracks,
            progressMap: newProgressMap,
            durationMap: newDurationMap,
          };
        });
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
