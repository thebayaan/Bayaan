import {create} from 'zustand';
import {persist} from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {Reciter} from '@/data/reciterData';
import {RECITERS} from '@/data/reciterData';
import {HAFS_REWAYAT_NAME} from '@/data/rewayat';

// Helper function to get the Hafs A'n Assem rewayat from a reciter
function getHafsRewayat(reciter: Reciter) {
  return reciter.rewayat.find(r => r.name === HAFS_REWAYAT_NAME);
}

// Lazy-computed default reciter — avoids .find() scans at module load time
let _defaultReciter: Reciter | null = null;
function getDefaultReciter(): Reciter {
  if (_defaultReciter) return _defaultReciter;

  // RECITERS is empty on first launch before API data loads — return placeholder
  if (RECITERS.length === 0) {
    return {id: '', name: '', date: null, image_url: null, rewayat: []};
  }

  const misharyAlafasi = RECITERS.find(
    reciter =>
      reciter.name === 'Mishary Alafasi' &&
      reciter.rewayat.some(r => r.name === HAFS_REWAYAT_NAME),
  );

  const anyHafsReciter = RECITERS.find(reciter =>
    reciter.rewayat.some(r => r.name === HAFS_REWAYAT_NAME),
  );

  const reciter = misharyAlafasi || anyHafsReciter || RECITERS[0];

  // Ensure the default rewayat is Hafs if available
  const hafsRewayat = getHafsRewayat(reciter);
  if (hafsRewayat) {
    _defaultReciter = {
      ...reciter,
      rewayat: [
        hafsRewayat,
        ...reciter.rewayat.filter(r => r.id !== hafsRewayat.id),
      ],
    };
  } else {
    _defaultReciter = reciter;
  }

  return _defaultReciter;
}

interface ReciterState {
  defaultReciter: Reciter;
  isInitialized: boolean;
  setDefaultReciter: (reciter: Reciter) => void;
  refreshDefaultReciter: () => void;
}

export const useReciterStore = create<ReciterState>()(
  persist(
    set => ({
      defaultReciter: getDefaultReciter(),
      isInitialized: false,
      refreshDefaultReciter: () => {
        _defaultReciter = null;
        set({defaultReciter: getDefaultReciter()});
      },
      setDefaultReciter: reciter => {
        // When setting a new default reciter, ensure Hafs is the first rewayat if available
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
      partialize: state => ({defaultReciter: state.defaultReciter}),
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
