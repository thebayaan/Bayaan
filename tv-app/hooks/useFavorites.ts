import {useSyncExternalStore} from 'react';
import {
  FAVORITES_KEY,
  getFavorites,
  storage,
  type FavoriteEntry,
} from '../services/favoritesStore';

let cachedSnapshot: FavoriteEntry[] = [];
let cachedRaw: string | undefined;

function getSnapshot(): FavoriteEntry[] {
  const raw = storage.getString(FAVORITES_KEY);
  if (raw === cachedRaw) return cachedSnapshot;
  cachedRaw = raw;
  cachedSnapshot = getFavorites();
  return cachedSnapshot;
}

function subscribe(cb: () => void): () => void {
  const listener = storage.addOnValueChangedListener(key => {
    if (key === FAVORITES_KEY) cb();
  });
  return () => listener.remove();
}

export function useFavorites(): FavoriteEntry[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
