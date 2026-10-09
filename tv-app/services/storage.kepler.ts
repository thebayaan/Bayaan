import {MMKV} from 'react-native-mmkv';

/**
 * Vega storage. Vega's MMKV port follows the react-native-mmkv v3 API
 * (`new MMKV()`, `delete()`), while the rest of the app uses the v4 surface
 * (`createMMKV()`, `remove()`), so this adapts v3 to the v4 methods in use.
 */

const mmkv = new MMKV({id: 'bayaan-tv'});

export const storage = {
  getString: (key: string): string | undefined => mmkv.getString(key),
  set: (key: string, value: string | number | boolean): void =>
    mmkv.set(key, value),
  remove: (key: string): void => mmkv.delete(key),
  clearAll: (): void => mmkv.clearAll(),
  addOnValueChangedListener: (
    onValueChanged: (key: string) => void,
  ): {remove: () => void} => mmkv.addOnValueChangedListener(onValueChanged),
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
