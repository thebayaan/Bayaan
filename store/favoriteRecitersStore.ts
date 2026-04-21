// store/favoriteRecitersStore.ts
import {create} from 'zustand';
import {RECITERS, Reciter} from '@/data/reciterData';
import {storage} from '@/utils/storage';

const FAVORITE_RECITERS_KEY = 'favoriteReciters';
const FAVORITE_RECITERS_TIMESTAMPS_KEY = 'favoriteRecitersTimestamps';

interface FavoriteReciterWithTimestamp extends Reciter {
  favoritedAt: number;
}

interface FavoriteRecitersState {
  favoriteReciters: FavoriteReciterWithTimestamp[];
  setFavoriteReciters: (reciters: Reciter[]) => Promise<void>;
  toggleFavoriteReciter: (reciterId: string) => Promise<void>;
  isFavoriteReciter: (reciterId: string) => boolean;
}

export const useFavoriteRecitersStore = create<FavoriteRecitersState>(
  (set, get) => ({
    favoriteReciters: [],
    setFavoriteReciters: async reciters => {
      // When setting reciters (e.g., on app load), load timestamps from storage
      const timestampsJson = await storage.getItem(
        FAVORITE_RECITERS_TIMESTAMPS_KEY,
      );
      const timestamps: Record<string, number> = timestampsJson
        ? JSON.parse(timestampsJson)
        : {};

      const recitersWithTimestamps = reciters.map(r => ({
        ...r,
        favoritedAt: timestamps[r.id] || Date.now(),
      }));

      set({favoriteReciters: recitersWithTimestamps});
    },
    toggleFavoriteReciter: async reciterId => {
      const state = get();
      const isCurrentlyFavorite = state.favoriteReciters.some(
        r => r.id === reciterId,
      );

      let newFavorites: FavoriteReciterWithTimestamp[];
      let timestamps: Record<string, number> = {};

      // Load existing timestamps
      const timestampsJson = await storage.getItem(
        FAVORITE_RECITERS_TIMESTAMPS_KEY,
      );
      if (timestampsJson) {
        timestamps = JSON.parse(timestampsJson);
      }

      if (isCurrentlyFavorite) {
        // Remove from favorites
        newFavorites = state.favoriteReciters.filter(r => r.id !== reciterId);
        delete timestamps[reciterId];
      } else {
        // Add to favorites
        const reciter = RECITERS.find(r => r.id === reciterId);
        if (reciter) {
          const favoritedAt = Date.now();
          newFavorites = [...state.favoriteReciters, {...reciter, favoritedAt}];
          timestamps[reciterId] = favoritedAt;
        } else {
          newFavorites = state.favoriteReciters;
        }
      }

      // Save to storage
      const favoriteIds = newFavorites.map(r => r.id);
      await storage.setItem(FAVORITE_RECITERS_KEY, JSON.stringify(favoriteIds));
      await storage.setItem(
        FAVORITE_RECITERS_TIMESTAMPS_KEY,
        JSON.stringify(timestamps),
      );

      set({favoriteReciters: newFavorites});
    },
    isFavoriteReciter: reciterId =>
      get().favoriteReciters.some(r => r.id === reciterId),
  }),
);
