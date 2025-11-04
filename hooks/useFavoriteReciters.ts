import {useCallback} from 'react';
import {Reciter} from '@/data/reciterData';
import {useFavoriteRecitersStore} from '@/services/player/store/favoriteRecitersStore';

interface FavoriteReciterWithTimestamp extends Reciter {
  favoritedAt: number;
}

interface UseFavoriteRecitersReturn {
  favoriteReciters: FavoriteReciterWithTimestamp[];
  isFavoriteReciter: (reciterId: string) => boolean;
  toggleFavorite: (reciter: Reciter) => void;
  addFavorite: (reciter: Reciter) => void;
  removeFavorite: (reciterId: string) => void;
}

export function useFavoriteReciters(): UseFavoriteRecitersReturn {
  const store = useFavoriteRecitersStore();

  const favoriteReciters = store.getFavoriteReciters();
  const isFavoriteReciter = useCallback(
    (reciterId: string) => store.isFavoriteReciter(reciterId),
    [store],
  );

  const toggleFavorite = useCallback(
    (reciter: Reciter) => {
      store.toggleFavoriteReciter(reciter);
    },
    [store],
  );

  const addFavorite = useCallback(
    (reciter: Reciter) => {
      store.addFavoriteReciter(reciter);
    },
    [store],
  );

  const removeFavorite = useCallback(
    (reciterId: string) => {
      store.removeFavoriteReciter(reciterId);
    },
    [store],
  );

  return {
    favoriteReciters,
    isFavoriteReciter,
    toggleFavorite,
    addFavorite,
    removeFavorite,
  };
}
