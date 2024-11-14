import {create} from 'zustand';
import {persist} from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {Reciter} from '@/data/reciterData';
import {RECITERS} from '@/data/reciterData';

// Default reciter - Mishari Rashid Al-Afasy
const DEFAULT_RECITER =
  RECITERS.find(reciter => reciter.name === 'Mishari Rashid Al-Afasy') ||
  RECITERS[0];

interface ReciterState {
  defaultReciter: Reciter;
  setDefaultReciter: (reciter: Reciter) => void;
}

export const useReciterStore = create<ReciterState>()(
  persist(
    set => ({
      defaultReciter: DEFAULT_RECITER,
      setDefaultReciter: reciter => set({defaultReciter: reciter}),
    }),
    {
      name: 'reciter-storage',
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
