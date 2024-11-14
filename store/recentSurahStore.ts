import {create} from 'zustand';
import {persist} from 'zustand/middleware';
import {Surah} from '@/data/surahData';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface RecentSurahsState {
  recentSurahs: Surah[];
  addRecentSurah: (surah: Surah) => void;
}

export const useRecentSurahsStore = create<RecentSurahsState>()(
  persist(
    (set, get) => ({
      recentSurahs: [],
      addRecentSurah: surah => {
        const existingSurahs = get().recentSurahs.filter(
          s => s.id !== surah.id,
        );
        set({
          recentSurahs: [surah, ...existingSurahs].slice(0, 10),
        });
      },
    }),
    {
      name: 'recent-surahs-storage',
      getStorage: () => AsyncStorage,
    },
  ),
);
