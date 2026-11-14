// @ai-generated
import {createMMKV, type MMKV} from 'react-native-mmkv';

export interface VersionedMMKVOptions {
  id: string;
  /** The key that holds the version. Name it so no data key can have it. */
  versionKey: string;
  version: number | string;
  /** Clear a store that holds more keys than this (the version key too). */
  maxKeys?: number;
}

/**
 * Opens the MMKV cache `id`. When its version is not `version`, or it holds
 * more than `maxKeys` keys, every key is cleared and the version is written
 * again. If the app stops between the two, the version key is gone, so the
 * next open clears again. `cleared` tells the caller that it started empty.
 */
export function openVersionedMMKV({
  id,
  versionKey,
  version,
  maxKeys,
}: VersionedMMKVOptions): {mmkv: MMKV; cleared: boolean} {
  const mmkv = createMMKV({id});
  const stored =
    typeof version === 'number'
      ? mmkv.getNumber(versionKey)
      : mmkv.getString(versionKey);
  const cleared =
    stored !== version || (maxKeys !== undefined && mmkv.length > maxKeys);
  if (cleared) {
    mmkv.clearAll();
    mmkv.set(versionKey, version);
  }
  return {mmkv, cleared};
}
