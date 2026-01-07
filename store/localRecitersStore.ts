import {create} from 'zustand';
import {Reciter} from '@/data/reciterData';
import {persist, createJSONStorage} from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface LocalRecitersState {
  localReciters: Reciter[];
  setLocalReciters: (reciters: Reciter[]) => void;

  addLocalReciter: (reciter: Reciter) => void;
  updateLocalReciter: (reciter: Reciter) => void;
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
