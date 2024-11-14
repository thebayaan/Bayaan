import {create} from 'zustand';
import {persist} from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {createJSONStorage} from 'zustand/middleware';

interface PlayCount {
  surahId: number;
  count: number;
  lastPlayed: number;
}

interface PlayCountState {
  playCounts: PlayCount[];
  incrementPlayCount: (surahId: number) => void;
  getMostPlayed: (limit?: number) => PlayCount[];
}

export const usePlayCountStore = create<PlayCountState>()(
  persist(
    (set, get) => ({
      playCounts: [],
      incrementPlayCount: (surahId: number) => {
        const currentCounts = get().playCounts;
        const existingCount = currentCounts.find(c => c.surahId === surahId);

        if (existingCount) {
          set({
            playCounts: currentCounts.map(c =>
              c.surahId === surahId
                ? {
                    ...c,
                    count: c.count + 1,
                    lastPlayed: Date.now(),
                  }
                : c,
            ),
          });
        } else {
          set({
            playCounts: [
              ...currentCounts,
              {surahId, count: 1, lastPlayed: Date.now()},
            ],
          });
        }
      },
      getMostPlayed: (limit = 5) => {
        return [...get().playCounts]
          .sort((a, b) => b.count - a.count)
          .slice(0, limit);
      },
    }),
    {
      name: 'play-count-storage',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
