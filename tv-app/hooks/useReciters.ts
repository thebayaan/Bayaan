import {useSyncExternalStore} from 'react';
import {
  fallbackReciterList,
  fetchReciters,
  getCachedReciters,
} from '../services/tvDataService';
import type {Reciter} from '../types/reciter';

// One reciter list for the whole app: every screen, menu and the Router share
// it, so mounting a screen never parses the catalog again, and the network
// refresh runs once per launch instead of once per mount.
let current: Reciter[] | null = null;
let refresh: Promise<void> | null = null;
const listeners = new Set<() => void>();

export function currentReciters(): Reciter[] {
  if (!current) {
    const cached = getCachedReciters();
    current = cached && cached.length > 0 ? cached : fallbackReciterList();
  }
  return current;
}

/** Fetches the list once (refreshing a stale cache) and tells every reader. */
export function refreshReciters(): Promise<void> {
  refresh ??= fetchReciters()
    .then(fresh => {
      if (fresh.length === 0 || fresh === current) return;
      current = fresh;
      listeners.forEach(listener => listener());
    })
    .catch(() => {
      // Keep showing the cached or bundled list.
    });
  return refresh;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  void refreshReciters();
  return () => {
    listeners.delete(listener);
  };
}

/** Test hook: forget the shared list. */
export function resetRecitersForTest(): void {
  current = null;
  refresh = null;
  listeners.clear();
}

export function useReciters(): {reciters: Reciter[]; loading: boolean} {
  const reciters = useSyncExternalStore(subscribe, currentReciters);
  return {reciters, loading: false};
}
