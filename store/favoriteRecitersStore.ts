// store/favoriteRecitersStore.ts
import {create} from 'zustand';
import {RECITERS, Reciter} from '@/data/reciterData';
import {storage} from '@/utils/storage';

const FAVORITE_RECITERS_KEY = 'favoriteReciters';

interface FavoriteRecitersState {
  favoriteReciters: Reciter[];
  setFavoriteReciters: (reciters: Reciter[]) => void;
  toggleFavoriteReciter: (reciterId: string) => void;
  isFavoriteReciter: (reciterId: string) => boolean;
}

export const useFavoriteRecitersStore = create<FavoriteRecitersState>(
  (set, get) => ({
    favoriteReciters: [],
    setFavoriteReciters: reciters => set({favoriteReciters: reciters}),
    toggleFavoriteReciter: reciterId => {
      set(state => {
        const isCurrentlyFavorite = state.favoriteReciters.some(
          r => r.id === reciterId,
        );
        const newFavorites = isCurrentlyFavorite
          ? state.favoriteReciters.filter(r => r.id !== reciterId)
          : ([
              ...state.favoriteReciters,
              RECITERS.find(r => r.id === reciterId),
            ].filter(Boolean) as Reciter[]);

        const favoriteIds = newFavorites.map(r => r.id);
        storage.setItem(FAVORITE_RECITERS_KEY, JSON.stringify(favoriteIds));

        return {favoriteReciters: newFavorites};
      });
    },
    isFavoriteReciter: reciterId =>
      get().favoriteReciters.some(r => r.id === reciterId),
  }),
);
