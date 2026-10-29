import {useSyncExternalStore} from 'react';
import {AppState} from 'react-native';
import {
  fallbackReciterList,
  fetchReciters,
  getCachedReciters,
} from '../services/tvDataService';
import type {Reciter} from '../types/reciter';

// One reciter list for the whole app: every screen, menu and the Router share
// it, so mounting a screen never parses the catalog again, and the network
// refresh is shared by everyone who asks while it runs. fetchReciters
// answers from the cache until it is RECITERS_TTL_MS old, so asking again
// (a screen mounting, the app coming back to the foreground) costs nothing
// until the list is due, and a TV process that lives for days still
// refreshes it.
let current: Reciter[] | null = null;
let refresh: Promise<void> | null = null;
let foregroundWatch: {remove: () => void} | null = null;
const listeners = new Set<() => void>();

export function currentReciters(): Reciter[] {
  if (!current) {
    const cached = getCachedReciters();
    current = cached && cached.length > 0 ? cached : fallbackReciterList();
  }
  return current;
}

/** Refreshes the list when it is due and tells every reader. */
export function refreshReciters(): Promise<void> {
  refresh ??= fetchReciters()
    .then(fresh => {
      if (fresh.length === 0 || fresh === current) return;
      current = fresh;
      listeners.forEach(listener => listener());
    })
    .catch(() => {
      // Keep showing the cached or bundled list.
    })
    .finally(() => {
      refresh = null;
    });
  return refresh;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  foregroundWatch ??= AppState.addEventListener('change', state => {
    if (state === 'active') void refreshReciters();
  });
  void refreshReciters();
  return () => {
    listeners.delete(listener);
  };
}

/** Test hook: forget the shared list. */
export function resetRecitersForTest(): void {
  current = null;
  refresh = null;
  foregroundWatch?.remove();
  foregroundWatch = null;
  listeners.clear();
}

export function useReciters(): {reciters: Reciter[]; loading: boolean} {
  const reciters = useSyncExternalStore(subscribe, currentReciters);
  return {reciters, loading: false};
}
