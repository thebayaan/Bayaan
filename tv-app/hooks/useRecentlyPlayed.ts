import {useSyncExternalStore} from 'react';
import {
  RECENT_KEY,
  getRecent,
  storage,
  type RecentEntry,
} from '../services/recentlyPlayedStore';

let cachedSnapshot: RecentEntry[] = [];
let cachedRaw: string | undefined;

function getSnapshot(): RecentEntry[] {
  const raw = storage.getString(RECENT_KEY);
  if (raw === cachedRaw) return cachedSnapshot;
  cachedRaw = raw;
  cachedSnapshot = getRecent();
  return cachedSnapshot;
}

function subscribe(cb: () => void): () => void {
  const listener = storage.addOnValueChangedListener(key => {
    if (key === RECENT_KEY) cb();
  });
  return () => listener.remove();
}

export function useRecentlyPlayed(): RecentEntry[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
