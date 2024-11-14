import {create} from 'zustand';
import {persist} from 'zustand/middleware';
import {Reciter} from '@/data/reciterData';
import {Surah} from '@/data/surahData';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface RecentReciterItem {
  reciter: Reciter;
  surah: Surah;
  progress: number;
  timestamp: number;
}

interface RecentRecitersState {
  recentReciters: RecentReciterItem[];
  progressMap: Record<string, number>;
  addRecentReciter: (reciter: Reciter, surah: Surah, progress: number) => void;
  updateProgress: (
    reciterId: string,
    surahId: number,
    progress: number,
  ) => void;
  getProgress: (reciterId: string, surahId: number) => number;
}

export const useRecentRecitersStore = create<RecentRecitersState>()(
  persist(
    (set, get) => ({
      recentReciters: [],
      progressMap: {},

      addRecentReciter: (reciter, surah, progress) => {
        set(state => {
          const newItem = {
            reciter,
            surah,
            timestamp: Date.now(),
            progress,
          };

          // Remove existing entry for this reciter/surah combo
          const filtered = state.recentReciters.filter(
            item =>
              !(item.reciter.id === reciter.id && item.surah.id === surah.id),
          );

          // Add new item at the beginning
          const updatedReciters = [newItem, ...filtered].slice(0, 10);

          return {
            recentReciters: updatedReciters,
            progressMap: {
              ...state.progressMap,
              [`${reciter.id}:${surah.id}`]: progress,
            },
          };
        });
      },

      updateProgress: (reciterId, surahId, progress) => {
        set(state => {
          const key = `${reciterId}:${surahId}`;
          const updatedReciters = state.recentReciters.map(item => {
            if (item.reciter.id === reciterId && item.surah.id === surahId) {
              return {
                ...item,
                progress,
                timestamp: Date.now(),
              };
            }
            return item;
          });

          return {
            recentReciters: updatedReciters,
            progressMap: {
              ...state.progressMap,
              [key]: progress,
            },
          };
        });
      },

      getProgress: (reciterId, surahId) => {
        const key = `${reciterId}:${surahId}`;
        return get().progressMap[key] || 0;
      },
    }),
    {
      name: 'recent-reciters-storage',
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
