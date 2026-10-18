import {createMMKV} from 'react-native-mmkv';

export const storage = createMMKV({id: 'bayaan-tv'});

/**
 * MMKV reads every key synchronously already. Vega reads its large per-surah
 * caches on demand, so callers of those await this before reading (see
 * services/storageVega.ts).
 */
export async function preload(_key: string): Promise<void> {}

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
