import {useCallback, useMemo, useSyncExternalStore} from 'react'; // @ai
import {Reciter, getRecitersVersion} from '@/data/reciterData'; // @ai
import {getReciterByIdSync} from '@/services/dataService'; // @ai
import {useFavoriteRecitersStore} from '@/services/player/store/favoriteRecitersStore';
import {useReciterStore} from '@/store/reciterStore'; // @ai

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

  // @ai-start
  // The store saves a copy of each reciter as it was when it was favourited.
  // Shown as saved, a favourite kept its old photo, name and rewayat count
  // for good after the catalogue changed. So each one is read from the
  // catalogue by id, and the saved copy is only what is shown for a reciter
  // the catalogue no longer lists.
  //
  // The catalogue is a plain array, not React state. dataService tells the
  // reciter store each time it refills it, so that store is the signal to
  // read the catalogue again.
  const catalogVersion = useSyncExternalStore(
    useReciterStore.subscribe,
    getRecitersVersion,
  );
  const saved = store.favoriteReciters;
  const favoriteReciters = useMemo(
    () =>
      Object.values(saved).map(snapshot => {
        const live = getReciterByIdSync(snapshot.id);
        return live ? {...live, favoritedAt: snapshot.favoritedAt} : snapshot;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [saved, catalogVersion],
  );
  // @ai-end
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
