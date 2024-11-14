import {useEffect} from 'react';
import {storage} from '@/utils/storage';
import {RECITERS} from '@/data/reciterData';
import {useFavoriteRecitersStore} from '@/store/favoriteRecitersStore';

const FAVORITE_RECITERS_KEY = 'favoriteReciters';

export const useFavoriteReciters = () => {
  const {
    favoriteReciters,
    setFavoriteReciters,
    toggleFavoriteReciter,
    isFavoriteReciter,
  } = useFavoriteRecitersStore();

  useEffect(() => {
    const loadFavorites = async () => {
      const storedFavorites = await storage.getItem(FAVORITE_RECITERS_KEY);
      if (storedFavorites) {
        const favoriteIds = JSON.parse(storedFavorites) as string[];
        const favorites = RECITERS.filter(reciter =>
          favoriteIds.includes(reciter.id),
        );
        setFavoriteReciters(favorites);
      }
    };
    loadFavorites();
  }, [setFavoriteReciters]);

  return {favoriteReciters, toggleFavoriteReciter, isFavoriteReciter};
};
