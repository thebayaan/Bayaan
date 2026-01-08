import {create} from 'zustand';
import {Reciter} from '@/data/reciterData';
import {persist, createJSONStorage} from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface LocalRecitersState {
  localReciters: Reciter[];
  setLocalReciters: (reciters: Reciter[]) => void;

  addLocalReciter: (reciter: Reciter) => void;
  updateLocalReciter: (reciter: Reciter) => void;
  bulkAddSurahsToReciter: (reciterId: string, surahIds: number[], fileExtension?: string) => void;
  removeLocalReciter: (reciterId: string) => void;
  getLocalReciter: (reciterId: string) => Reciter | undefined;
  getLocalReciters: () => Reciter[];
  clearLocalReciters: () => void;
}

export const useLocalRecitersStore = create<LocalRecitersState>()(
  persist(
    (set, get) => ({
      localReciters: [],
      setLocalReciters: (reciters: Reciter[]) => {
        set({localReciters: reciters});
      },
      addLocalReciter: (reciter: Reciter) => {
        set({localReciters: [...get().localReciters, reciter]});
      },
      updateLocalReciter: (reciter: Reciter) => {
        set({
          localReciters: get().localReciters.map(r =>
            r.id === reciter.id ? reciter : r,
          ),
        });
      },
      bulkAddSurahsToReciter: (reciterId: string, surahIds: number[], fileExtension: string = 'mp3') => {
        set({
          localReciters: get().localReciters.map(reciter => {
            if (reciter.id !== reciterId) return reciter;

            // Update rewayat (assuming local reciters have one rewayat or we update the first one/all local ones)
            const updatedRewayat = reciter.rewayat.map(rewayat => {
              if (!rewayat.isLocal) return rewayat;

              const currentSurahs = new Set(
                (rewayat.surah_list || []).filter((id): id is number => id !== null)
              );
              
              surahIds.forEach(id => currentSurahs.add(id));
              
              return {
                ...rewayat,
                surah_list: Array.from(currentSurahs).sort((a, b) => a - b),
                surah_total: currentSurahs.size,
                fileExtension: fileExtension // Update extension if provided, assuming uniform
              };
            });

            return {
              ...reciter,
              rewayat: updatedRewayat
            };
          }),
        });
      },
      removeLocalReciter: (reciterId: string) => {
        set({localReciters: get().localReciters.filter(reciter => reciter.id !== reciterId)});
      },
      getLocalReciter: (reciterId: string) => {
        return get().localReciters.find(reciter => reciter.id === reciterId);
      },
      getLocalReciters: () => {
        return get().localReciters;
      },
      clearLocalReciters: () => {
        set({localReciters: []});
      },
    }),
    {
      name: 'local-reciters-storage',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
