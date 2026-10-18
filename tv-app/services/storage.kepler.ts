import AsyncStorage from '@react-native-async-storage/async-storage';
import {createVegaStorage} from './storageVega';

/**
 * Vega storage. The app reads storage synchronously (MMKV-style), but Vega's
 * MMKV port for RN 0.83 links the RN 0.72 runtime and segfaults the app on
 * launch. So Vega keeps an in-memory copy filled from AsyncStorage before
 * the app loads; the logic (hydrate retries, lazy caches, no writes after a
 * failed hydrate) is in services/storageVega.ts.
 */
const vega = createVegaStorage(AsyncStorage);

export const storage = vega.storage;
export const hydrateStorage = vega.hydrate;
export const preload = vega.preload;

export function readJSON<T>(key: string): T | null {
  const raw = storage.getString(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writeJSON<T>(key: string, value: T): void {
  storage.set(key, JSON.stringify(value));
}

export function remove(key: string): void {
  storage.remove(key);
}
