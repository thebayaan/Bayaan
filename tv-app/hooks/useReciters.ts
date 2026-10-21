import {useSyncExternalStore} from 'react';
import {AppState} from 'react-native';
import {fetchReciters, getCachedReciters} from '../services/tvDataService';
import type {Reciter} from '../types/reciter';

// One reciter list for the whole app: every screen, menu and the Router share
// it, so mounting a screen never parses the catalog again, and the network
// refresh is shared by everyone who asks while it runs. fetchReciters
// answers from the cache until it is RECITERS_TTL_MS old, so asking again
// (a screen mounting, the app coming back to the foreground) costs nothing
// until the list is due, and a TV process that lives for days still
// refreshes it. Nothing is bundled: before the first load the list is empty
// and the app shows its loading or offline screen (CatalogGate).
const NO_RECITERS: Reciter[] = [];
let current: Reciter[] | null = null;
/** Whether the last load of an empty list failed (no network, no copy). */
let failed = false;
let refresh: Promise<void> | null = null;
let foregroundWatch: {remove: () => void} | null = null;
const listeners = new Set<() => void>();

export function currentReciters(): Reciter[] {
  if (!current) {
    const cached = getCachedReciters();
    current = cached && cached.length > 0 ? cached : NO_RECITERS;
  }
  return current;
}

/** True when there is no list and the last attempt to load one failed. */
export function recitersFailed(): boolean {
  return failed;
}

function notify(): void {
  listeners.forEach(listener => listener());
}

/** Refreshes the list when it is due and tells every reader. */
export function refreshReciters(): Promise<void> {
  if (failed) {
    failed = false;
    notify();
  }
  refresh ??= fetchReciters()
    .then(fresh => {
      if (fresh.length === 0 || fresh === current) return;
      current = fresh;
      notify();
    })
    .catch(() => {
      // Keep showing the stored list; with none, say the load failed.
      if (currentReciters().length === 0) {
        failed = true;
        notify();
      }
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
  failed = false;
  refresh = null;
  foregroundWatch?.remove();
  foregroundWatch = null;
  listeners.clear();
}

export function useReciters(): {reciters: Reciter[]; loading: boolean} {
  const reciters = useSyncExternalStore(subscribe, currentReciters);
  return {reciters, loading: reciters.length === 0 && !recitersFailed()};
}

/**
 * The catalog's state for the app's first screen: `ready` once there is a
 * list, `failed` when there is none and it couldn't be loaded.
 */
export function useCatalogState(): 'loading' | 'ready' | 'failed' {
  const reciters = useSyncExternalStore(subscribe, currentReciters);
  const hasFailed = useSyncExternalStore(subscribe, recitersFailed);
  if (reciters.length > 0) return 'ready';
  return hasFailed ? 'failed' : 'loading';
}
