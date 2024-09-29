import {useCallback} from 'react';
import {usePlayerStore} from '@/store/playerStore';

export const useTrackPlayerFavorite = () => {
  const {favoriteTrackIds, toggleFavoriteTrack} = usePlayerStore(state => ({
    favoriteTrackIds: state.favoriteTrackIds,
    toggleFavoriteTrack: state.toggleFavoriteTrack,
  }));

  const isFavorite = useCallback(
    (reciterId: string, surahId: string) => {
      const favoriteKey = `${reciterId}:${surahId}`;
      return favoriteTrackIds.includes(favoriteKey);
    },
    [favoriteTrackIds],
  );

  const toggleFavorite = useCallback(
    (reciterId: string, surahId: string) => {
      const favoriteKey = `${reciterId}:${surahId}`;
      toggleFavoriteTrack(favoriteKey);
    },
    [toggleFavoriteTrack],
  );

  return {isFavorite, toggleFavorite};
};
