// RFC-010 — app-side catalog version polling.
//
// Reads `branding.catalogVersionEndpoint`. When set, polls on cold-start
// and AppState 'active' (debounced), and triggers a catalog refetch when
// the published version exceeds the AsyncStorage-tracked last-seen
// version.
//
// Fail-open: any poll failure (offline, 5xx, parse error, AbortError) is
// swallowed. The bundled (or last-cached) catalog always wins on
// cold-start; the poll only upgrades.
//
// Undefined endpoint → no-op. Bayaan ships undefined; forks set it when
// they have a runtime catalog publisher.

import {AppState, type AppStateStatus} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import branding from '../config/branding';

type CatalogVersion = {
  version: number;
  updated_at?: string;
  url?: string;
};

const LAST_SEEN_KEY = 'bayaan:lastSeenCatalogVersion';
const POLL_TIMEOUT_MS = 1500;
const FOREGROUND_DEBOUNCE_MS = 5 * 60 * 1000;

let lastPolledAt = 0;
let stateSubscription: {remove: () => void} | null = null;

export type RefetchCatalog = (
  newVersion: number,
  versionedUrl?: string,
) => Promise<void> | void;

export function initCatalogVersionPolling(refetch: RefetchCatalog): void {
  const endpoint = branding.catalogVersionEndpoint;
  if (!endpoint) return;

  void pollOnce(endpoint, refetch);

  if (stateSubscription) stateSubscription.remove();
  stateSubscription = AppState.addEventListener(
    'change',
    (s: AppStateStatus) => {
      if (
        s === 'active' &&
        Date.now() - lastPolledAt > FOREGROUND_DEBOUNCE_MS
      ) {
        void pollOnce(endpoint, refetch);
      }
    },
  );
}

// @ai-start
const versionListeners = new Set<(version: number) => void>();

/**
 * Calls `listener` after the poll has seen (and refetched for) a newer
 * catalog version. Caches derived from the catalog, such as the Moments
 * snippet list, use it to refresh. Returns the unsubscribe function.
 */
export function onCatalogVersionChange(
  listener: (version: number) => void,
): () => void {
  versionListeners.add(listener);
  return () => {
    versionListeners.delete(listener);
  };
}

/** The last catalog version the poll saw, or null when it has seen none. */
export async function getLastSeenCatalogVersion(): Promise<number | null> {
  try {
    const stored = await AsyncStorage.getItem(LAST_SEEN_KEY);
    const version = stored === null ? NaN : Number(stored);
    return Number.isFinite(version) ? version : null;
  } catch {
    return null;
  }
}
// @ai-end

export function teardownCatalogVersionPolling(): void {
  stateSubscription?.remove();
  stateSubscription = null;
  lastPolledAt = 0;
}

async function pollOnce(
  endpoint: string,
  refetch: RefetchCatalog,
): Promise<void> {
  lastPolledAt = Date.now();
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), POLL_TIMEOUT_MS);
  try {
    const res = await fetch(endpoint, {
      cache: 'no-store',
      signal: ctrl.signal,
    });
    if (!res.ok) return;
    const body = (await res.json()) as Partial<CatalogVersion>;
    if (typeof body.version !== 'number') return;

    const stored = await AsyncStorage.getItem(LAST_SEEN_KEY);
    const lastSeen = stored ? Number(stored) : 0;
    if (!Number.isFinite(lastSeen) || body.version > lastSeen) {
      await refetch(body.version, body.url);
      await AsyncStorage.setItem(LAST_SEEN_KEY, String(body.version));
      // @ai-start
      const version = body.version;
      versionListeners.forEach(listener => {
        try {
          listener(version);
        } catch {
          // a listener's failure must not stop the others
        }
      });
      // @ai-end
    }
  } catch {
    // fail-open by design
  } finally {
    clearTimeout(timeout);
  }
}
