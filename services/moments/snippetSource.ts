// @ai-start
/**
 * Loads the Moments snippet list from the Bayaan backend (`GET /v1/snippets`).
 *
 * The list is cached in AsyncStorage with its version and ETag. A cached list
 * is used at once and revalidated in the background once it is an hour old:
 * the request carries `If-None-Match`, so an unchanged list costs a 304 and
 * the cache is kept. With nothing cached the fetch is awaited (with a short
 * timeout). An empty result means "no server snippets": the feed then builds
 * its moments on the device from timestamps, as it did before the endpoint
 * existed.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  CachedSnippetList,
  parseCachedSnippetList,
  parseSnippetResponse,
  shouldRefreshSnippets,
  Snippet,
} from './snippets';

export const SNIPPETS_CACHE_KEY = 'moments-snippets';
/** Revalidate a cached list once it was last checked this long ago. */
export const SNIPPETS_MAX_AGE_MS = 60 * 60 * 1000;
/** After a failed fetch, wait this long before trying again. */
export const SNIPPETS_RETRY_AFTER_MS = 5 * 60 * 1000;
const FETCH_TIMEOUT_MS = 3000;

let lastFailureAt = 0;
let inFlight: Promise<CachedSnippetList | null> | null = null;

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

async function writeCache(list: CachedSnippetList): Promise<void> {
  try {
    await AsyncStorage.setItem(SNIPPETS_CACHE_KEY, JSON.stringify(list));
  } catch {
    // Still usable for this session.
  }
}

async function fetchSnippets(
  cache: CachedSnippetList | null,
): Promise<CachedSnippetList | null> {
  const api = apiConfig();
  if (!api) return null;
  if (lastFailureAt && Date.now() - lastFailureAt < SNIPPETS_RETRY_AFTER_MS) {
    return null;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${api.key}`,
    };
    if (cache?.etag) headers['If-None-Match'] = cache.etag;
    const res = await fetch(`${api.base}/v1/snippets`, {
      headers,
      signal: controller.signal,
    });
    let next: CachedSnippetList;
    if (res.status === 304 && cache) {
      next = {...cache, fetchedAt: Date.now()};
    } else {
      if (!res.ok) throw new Error(`Bayaan API error: ${res.status}`);
      const list = parseSnippetResponse(await res.json());
      if (!list) throw new Error('Unexpected snippets response');
      // Never step back to an older list (a stale edge or replica).
      if (cache && list.version < cache.version) {
        next = {...cache, fetchedAt: Date.now()};
      } else {
        next = {
          ...list,
          etag: res.headers?.get?.('ETag') ?? null,
          fetchedAt: Date.now(),
        };
      }
    }
    await writeCache(next);
    lastFailureAt = 0;
    return next;
  } catch (error) {
    lastFailureAt = Date.now();
    if (__DEV__) console.warn('[MomentsSnippets] Fetch failed:', error);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/** Fetches or revalidates the list, sharing a request already running. */
export function refreshMomentSnippets(
  cache: CachedSnippetList | null,
): Promise<CachedSnippetList | null> {
  if (!inFlight) {
    inFlight = fetchSnippets(cache).finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

/**
 * The snippets to build the feed from. Empty when the backend has none, is
 * not configured, or cannot be reached and nothing is cached.
 */
export async function loadMomentSnippets(): Promise<Snippet[]> {
  const cache = await readCache();
  if (cache) {
    if (shouldRefreshSnippets(cache, Date.now(), SNIPPETS_MAX_AGE_MS)) {
      void refreshMomentSnippets(cache);
    }
    return cache.snippets;
  }
  const fresh = await refreshMomentSnippets(null);
  return fresh?.snippets ?? [];
}

/** Test helper: forgets the in-memory fetch state. */
export function resetMomentSnippetsForTests(): void {
  lastFailureAt = 0;
  inFlight = null;
}
// @ai-end
