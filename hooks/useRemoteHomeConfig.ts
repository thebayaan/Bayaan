// RFC-016: remote Listen-tab row config.
//
// Reads the row config served by the backend's GET /v1/home-config, with an
// MMKV-backed cache so first-render after a cold-start is synchronous (no
// flash of default then remote).
//
// Fail-open: any error (no env, offline, 5xx, parse error) keeps the cache
// (or returns null so the caller can fall back to branding.homeRowConfig).
//
// Companion to:
//   - bayaan-backend GET /v1/home-config
//   - PR #260 (branding.homeRowConfig, the bundled fallback)
//   - RFC-010 (catalogVersionPoll, same polling idiom, applied to catalog)

import {useEffect, useState} from 'react';
import {AppState, type AppStateStatus} from 'react-native';
import {createMMKV} from 'react-native-mmkv';
import type {HomeRow} from '@/config/branding';

const mmkv = createMMKV({id: 'home-config'});
const CACHE_KEY = 'home-config.cached';
const POLL_TIMEOUT_MS = 1500;
const FOREGROUND_DEBOUNCE_MS = 5 * 60 * 1000;

interface CachedConfig {
  version: number;
  rows: HomeRow[];
}

interface RemoteConfigResponse {
  data: {
    version: number;
    updated_at: string;
    rows: HomeRow[];
  };
}

function readCache(): CachedConfig | null {
  const raw = mmkv.getString(CACHE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as CachedConfig;
    if (typeof parsed.version === 'number' && Array.isArray(parsed.rows)) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function writeCache(config: CachedConfig): void {
  mmkv.set(CACHE_KEY, JSON.stringify(config));
}

let lastPolledAt = 0;

/** Test-only: reset module state between tests. */
export function __resetHomeConfigPollForTesting(): void {
  lastPolledAt = 0;
  mmkv.remove(CACHE_KEY);
}

async function pollOnce(
  endpoint: string,
  apiKey: string | undefined,
  onUpdate: (cfg: CachedConfig) => void,
): Promise<void> {
  if (Date.now() - lastPolledAt < FOREGROUND_DEBOUNCE_MS) return;
  lastPolledAt = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), POLL_TIMEOUT_MS);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
    const res = await fetch(endpoint, {signal: controller.signal, headers});
    clearTimeout(timeout);
    if (!res.ok) return;
    const body = (await res.json()) as RemoteConfigResponse;
    const next = body.data;
    if (
      !next ||
      typeof next.version !== 'number' ||
      !Array.isArray(next.rows)
    ) {
      return;
    }
    const cached = readCache();
    if (!cached || next.version > cached.version) {
      const fresh: CachedConfig = {version: next.version, rows: next.rows};
      writeCache(fresh);
      onUpdate(fresh);
    }
  } catch {
    // fail-open: keep cached / bundled fallback
  }
}

/**
 * Returns the remote Listen-tab row config, or `null` if no cached value
 * exists yet (the caller should fall back to `branding.homeRowConfig`).
 *
 * Behaviour:
 *   - Cold-mount: returns whatever MMKV cached on the prior session (sync).
 *   - In an effect: fires a background fetch; if the response is newer than
 *     the cached version, the cache is updated and the hook re-renders.
 *   - AppState `active`: re-polls (debounced at 5 min).
 *   - Env vars missing: hook is a no-op, returns the cached value forever.
 */
export function useRemoteHomeConfig(): HomeRow[] | null {
  const [rows, setRows] = useState<HomeRow[] | null>(
    () => readCache()?.rows ?? null,
  );

  useEffect(() => {
    const apiUrl = process.env.EXPO_PUBLIC_BAYAAN_API_URL;
    const apiKey = process.env.EXPO_PUBLIC_BAYAAN_API_KEY;
    if (!apiUrl) return;
    const endpoint = `${apiUrl}/v1/home-config`;

    const onUpdate = (cfg: CachedConfig): void => setRows(cfg.rows);

    void pollOnce(endpoint, apiKey, onUpdate);

    const sub = AppState.addEventListener(
      'change',
      (s: AppStateStatus): void => {
        if (s === 'active') void pollOnce(endpoint, apiKey, onUpdate);
      },
    );
    return () => sub.remove();
  }, []);

  return rows;
}
