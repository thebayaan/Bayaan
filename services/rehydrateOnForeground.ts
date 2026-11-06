// @ai-generated
/**
 * Retries a failed store hydration each time the app comes back to the
 * foreground.
 *
 * utils/storage lets `persist` write a key only after a read of it resolved.
 * When the read rejects (iOS file protection before the first unlock, a full
 * disk), the store keeps its defaults and does not save. The cause often goes
 * away, so on each foreground every store that has not hydrated reads its key
 * again. When that read resolves, the saved state merges in and the store
 * saves again. The stores come from services/persistedStores.
 */
import {AppState, type AppStateStatus} from 'react-native';

/** The part of a store's `persist` API that the retry uses. */
export interface PersistedStore {
  persist: {
    hasHydrated: () => boolean;
    rehydrate: () => Promise<void> | void;
  };
}

// Stores with a retry in flight, so a quick second foreground does not start
// another read of the same key.
const rehydrating = new Set<PersistedStore>();

/** Reads the key again for each store that has not hydrated. */
export function rehydrateUnhydratedStores(
  stores: readonly PersistedStore[],
): void {
  for (const store of stores) {
    if (store.persist.hasHydrated() || rehydrating.has(store)) {
      continue;
    }
    rehydrating.add(store);
    const done = () => rehydrating.delete(store);
    // persist catches a failed read itself; `done` runs either way.
    Promise.resolve(store.persist.rehydrate()).then(done, done);
  }
}

let stateSubscription: {remove: () => void} | null = null;

/**
 * Retries a failed hydration of these stores each time the app comes back to
 * the foreground. A second call does nothing until the teardown.
 */
export function initForegroundRehydration(
  stores: readonly PersistedStore[],
): void {
  if (stateSubscription) {
    return;
  }
  stateSubscription = AppState.addEventListener(
    'change',
    (state: AppStateStatus) => {
      if (state === 'active') {
        rehydrateUnhydratedStores(stores);
      }
    },
  );
}

export function teardownForegroundRehydration(): void {
  stateSubscription?.remove();
  stateSubscription = null;
  rehydrating.clear();
}
