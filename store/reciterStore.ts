import {create} from 'zustand';
import {persist} from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {Reciter} from '@/data/reciterData';
import {RECITERS} from '@/data/reciterData';

// Helper function to get the Hafs A'n Assem rewayat from a reciter
function getHafsRewayat(reciter: Reciter) {
  return reciter.rewayat.find(r => r.name === "Hafs A'n Assem");
}

// Default reciter - Mishary Alafasi with Hafs A'n Assem recitation
const misharyAlafasi = RECITERS.find(
  reciter =>
    reciter.name === 'Mishary Alafasi' &&
    reciter.rewayat.some(r => r.name === "Hafs A'n Assem"),
);

const anyHafsReciter = RECITERS.find(reciter =>
  reciter.rewayat.some(r => r.name === "Hafs A'n Assem"),
);

const DEFAULT_RECITER = misharyAlafasi || anyHafsReciter || RECITERS[0];

// Ensure the default rewayat is Hafs A'n Assem if available
if (DEFAULT_RECITER) {
  const hafsRewayat = getHafsRewayat(DEFAULT_RECITER);
  if (hafsRewayat) {
    DEFAULT_RECITER.rewayat = [
      hafsRewayat,
      ...DEFAULT_RECITER.rewayat.filter(r => r.id !== hafsRewayat.id),
    ];
  }
}

interface ReciterState {
  defaultReciter: Reciter;
  setDefaultReciter: (reciter: Reciter) => void;
}

export const useReciterStore = create<ReciterState>()(
  persist(
    set => ({
      defaultReciter: DEFAULT_RECITER,
      setDefaultReciter: reciter => {
        // When setting a new default reciter, ensure Hafs A'n Assem is the first rewayat if available
        const hafsRewayat = getHafsRewayat(reciter);
        if (hafsRewayat) {
          reciter = {
            ...reciter,
            rewayat: [
              hafsRewayat,
              ...reciter.rewayat.filter(r => r.id !== hafsRewayat.id),
            ],
          };
        }
        set({defaultReciter: reciter});
      },
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
