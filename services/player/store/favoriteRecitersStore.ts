import {create} from 'zustand';
import {persist} from 'zustand/middleware';
import {Reciter} from '@/data/reciterData';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface FavoriteReciterWithTimestamp extends Reciter {
  favoritedAt: number;
}

interface FavoriteRecitersState {
  favoriteReciterIds: string[];
  favoriteReciters: Record<string, FavoriteReciterWithTimestamp>;
  addFavoriteReciter: (reciter: Reciter) => void;
  removeFavoriteReciter: (reciterId: string) => void;
  toggleFavoriteReciter: (reciter: Reciter) => void;
  isFavoriteReciter: (reciterId: string) => boolean;
  getFavoriteReciter: (
    reciterId: string,
  ) => FavoriteReciterWithTimestamp | undefined;
  getFavoriteReciters: () => FavoriteReciterWithTimestamp[];
  reset: () => void;
}

export const useFavoriteRecitersStore = create<FavoriteRecitersState>()(
  persist(
    (set, get) => ({
      favoriteReciterIds: [],
      favoriteReciters: {},

      addFavoriteReciter: (reciter: Reciter) => {
        set(state => {
          if (state.favoriteReciterIds.includes(reciter.id)) {
            return state;
          }

          const reciterWithTimestamp: FavoriteReciterWithTimestamp = {
            ...reciter,
            favoritedAt: Date.now(),
          };

          return {
            favoriteReciterIds: [...state.favoriteReciterIds, reciter.id],
            favoriteReciters: {
              ...state.favoriteReciters,
              [reciter.id]: reciterWithTimestamp,
            },
          };
        });
      },

      removeFavoriteReciter: (reciterId: string) => {
        set(state => ({
          favoriteReciterIds: state.favoriteReciterIds.filter(
            id => id !== reciterId,
          ),
          favoriteReciters: Object.fromEntries(
            Object.entries(state.favoriteReciters).filter(
              ([id]) => id !== reciterId,
            ),
          ),
        }));
      },

      toggleFavoriteReciter: (reciter: Reciter) => {
        const state = get();
        if (state.isFavoriteReciter(reciter.id)) {
          state.removeFavoriteReciter(reciter.id);
        } else {
          state.addFavoriteReciter(reciter);
        }
      },

      isFavoriteReciter: (reciterId: string) => {
        return get().favoriteReciterIds.includes(reciterId);
      },

      getFavoriteReciter: (reciterId: string) => {
        return get().favoriteReciters[reciterId];
      },

      getFavoriteReciters: () => {
        const state = get();
        return Object.values(state.favoriteReciters);
      },

      reset: () => {
        set({
          favoriteReciterIds: [],
          favoriteReciters: {},
        });
      },
    }),
    {
      name: 'player-favorite-reciters-storage',
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
