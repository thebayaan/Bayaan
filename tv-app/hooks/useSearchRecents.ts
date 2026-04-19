import {useSyncExternalStore} from 'react';
import {
  SEARCH_RECENTS_KEY,
  getRecentSearches,
  storage,
} from '../services/searchRecentsStore';

let cachedSnapshot: string[] = [];
let cachedRaw: string | undefined;

function getSnapshot(): string[] {
  const raw = storage.getString(SEARCH_RECENTS_KEY);
  if (raw === cachedRaw) return cachedSnapshot;
  cachedRaw = raw;
  cachedSnapshot = getRecentSearches();
  return cachedSnapshot;
}

function subscribe(cb: () => void): () => void {
  const listener = storage.addOnValueChangedListener(key => {
    if (key === SEARCH_RECENTS_KEY) cb();
  });
  return () => listener.remove();
}

export function useSearchRecents(): string[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
