// @ai-start
/**
 * Loads the Moments snippet list from the Bayaan backend.
 *
 * The list is cached in AsyncStorage with its version. A cached list is used
 * at once and fetched again in the background when the catalog version the
 * poll has seen moved past the one it was fetched under, or when it is a day
 * old. With nothing cached the fetch is awaited (with a short timeout). An
 * empty result means "no server snippets": the feed then builds its moments
 * on the device from timestamps, as it did before the endpoint existed.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getLastSeenCatalogVersion,
  onCatalogVersionChange,
} from '@/services/catalogVersionPoll';
import {
  CachedSnippetList,
  parseCachedSnippetList,
  parseSnippetResponse,
  shouldRefreshSnippets,
  Snippet,
} from './snippets';

export const SNIPPETS_CACHE_KEY = 'moments-snippets';
/** Refetch a list this old even when no catalog version was published. */
export const SNIPPETS_MAX_AGE_MS = 24 * 60 * 60 * 1000;
/** After a failed fetch, wait this long before trying again. */
export const SNIPPETS_RETRY_AFTER_MS = 5 * 60 * 1000;
const FETCH_TIMEOUT_MS = 3000;

let lastFailureAt = 0;
let inFlight: Promise<CachedSnippetList | null> | null = null;
let unsubscribe: (() => void) | null = null;

function apiConfig(): {base: string; key: string} | null {
  const base = process.env.EXPO_PUBLIC_BAYAAN_API_URL;
  const key = process.env.EXPO_PUBLIC_BAYAAN_API_KEY;
  if (!base || !key) return null;
  return {base: base.replace(/\/+$/, ''), key};
}

async function readCache(): Promise<CachedSnippetList | null> {
  try {
    return parseCachedSnippetList(
      await AsyncStorage.getItem(SNIPPETS_CACHE_KEY),
    );
  } catch {
    return null;
  }
}

async function fetchSnippets(): Promise<CachedSnippetList | null> {
  const api = apiConfig();
  if (!api) return null;
  if (lastFailureAt && Date.now() - lastFailureAt < SNIPPETS_RETRY_AFTER_MS) {
    return null;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${api.base}/v1/snippets`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${api.key}`,
      },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Bayaan API error: ${res.status}`);
    const list = parseSnippetResponse(await res.json());
    if (!list) throw new Error('Unexpected snippets response');
    const cached: CachedSnippetList = {
      ...list,
      catalogVersion: await getLastSeenCatalogVersion(),
      fetchedAt: Date.now(),
    };
    try {
      await AsyncStorage.setItem(SNIPPETS_CACHE_KEY, JSON.stringify(cached));
    } catch {
      // Still usable for this session.
    }
    lastFailureAt = 0;
    return cached;
  } catch (error) {
    lastFailureAt = Date.now();
    if (__DEV__) console.warn('[MomentsSnippets] Fetch failed:', error);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/** Fetches the list again, sharing a fetch that is already running. */
export function refreshMomentSnippets(): Promise<CachedSnippetList | null> {
  if (!inFlight) {
    inFlight = fetchSnippets().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

function watchCatalogVersion(): void {
  if (unsubscribe) return;
  unsubscribe = onCatalogVersionChange(() => {
    lastFailureAt = 0;
    void refreshMomentSnippets();
  });
}

/**
 * The snippets to build the feed from. Empty when the backend has none, is
 * not configured, or cannot be reached and nothing is cached.
 */
export async function loadMomentSnippets(): Promise<Snippet[]> {
  watchCatalogVersion();
  const cache = await readCache();
  const due = shouldRefreshSnippets(cache, {
    now: Date.now(),
    lastSeenCatalogVersion: await getLastSeenCatalogVersion(),
    maxAgeMs: SNIPPETS_MAX_AGE_MS,
  });
  if (cache) {
    if (due) void refreshMomentSnippets();
    return cache.snippets;
  }
  const fresh = await refreshMomentSnippets();
  return fresh?.snippets ?? [];
}

/** Test helper: forgets the in-memory fetch state. */
export function resetMomentSnippetsForTests(): void {
  lastFailureAt = 0;
  inFlight = null;
  unsubscribe?.();
  unsubscribe = null;
}
// @ai-end
