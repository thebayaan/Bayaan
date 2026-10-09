import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Vega storage. The app reads storage synchronously (MMKV-style), but Vega's
 * MMKV port for RN 0.83 links the RN 0.72 runtime and segfaults the app on
 * launch. So Vega keeps an in-memory copy that hydrateStorage() fills from
 * AsyncStorage before the app loads (see tv-vega/index.js), and writes go to
 * memory immediately and to AsyncStorage in the background.
 */

const PREFIX = 'bayaan-tv:';

const values = new Map<string, string>();
const listeners = new Set<(key: string) => void>();

function notify(key: string): void {
  listeners.forEach(cb => cb(key));
}

function persist(task: Promise<void>): void {
  task.catch((error: unknown) => {
    console.warn('[storage] AsyncStorage write failed', error);
  });
}

export async function hydrateStorage(): Promise<void> {
  const keys = (await AsyncStorage.getAllKeys()).filter(k =>
    k.startsWith(PREFIX),
  );
  const entries = await AsyncStorage.multiGet(keys);
  for (const [fullKey, value] of entries) {
    if (value !== null) values.set(fullKey.slice(PREFIX.length), value);
  }
}

export const storage = {
  getString: (key: string): string | undefined => values.get(key),
  set: (key: string, value: string | number | boolean): void => {
    const text = String(value);
    values.set(key, text);
    persist(AsyncStorage.setItem(PREFIX + key, text));
    notify(key);
  },
  remove: (key: string): void => {
    values.delete(key);
    persist(AsyncStorage.removeItem(PREFIX + key));
    notify(key);
  },
  clearAll: (): void => {
    const keys = [...values.keys()];
    values.clear();
    persist(AsyncStorage.multiRemove(keys.map(k => PREFIX + k)));
    keys.forEach(notify);
  },
  addOnValueChangedListener: (
    onValueChanged: (key: string) => void,
  ): {remove: () => void} => {
    listeners.add(onValueChanged);
    return {remove: (): void => void listeners.delete(onValueChanged)};
  },
};

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
