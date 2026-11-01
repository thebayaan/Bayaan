// @ai-generated
/**
 * Line fits across launches (RFC-023 step 4).
 *
 * SkiaLine builds a justified line, measures it, and builds it again with its
 * fit (justifiedSpace.ts). The session map there holds a fit for one launch, so
 * the first page after each launch builds every justified line twice. This
 * store keeps each fit for the next launch of the same bundle.
 *
 * Each bundle has its own MMKV instance. Its name holds LINE_FIT_FORMAT and the
 * update id (with updates off, the build version), so an OTA update that
 * changes the shaping or a font starts empty. MMKV cannot list its instances,
 * so a small pointer instance holds the name of the store in use. When that
 * name changes, the old store is deleted.
 *
 * This is a cache only. After any failure here, the line is measured again.
 */
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import {createMMKV, deleteMMKV, type MMKV} from 'react-native-mmkv';

/**
 * Change this when the fit pass (SkiaLine), JustificationService or a font
 * changes the drawn width of a line.
 */
export const LINE_FIT_FORMAT = 1;

/**
 * Fits kept: about three whole Mushafs of 9,046 lines, about 1.5 MB. A store
 * over this limit starts again at the next launch.
 */
export const LINE_FIT_STORE_LIMIT = 30000;

/**
 * An empty path keeps an instance in MMKV's own directory on both platforms.
 * With no path, iOS puts it in the App Group directory that Info.plist names,
 * and deleteMMKV takes no path, so it does not look there.
 */
const MMKV_OWN_DIRECTORY = '';

const POINTER_ID = 'mushaf-line-fits';
const POINTER_KEY = 'store';

export interface StoredLineFit {
  wordSize: number;
  spaceExtra: number;
}

export function lineFitStoreName(format: number, bundle: string): string {
  return `${POINTER_ID}-${format}-${bundle}`;
}

/** The update id, or with updates off the build version; null without both. */
function currentBundle(): string | null {
  if (Updates.updateId) return Updates.updateId;
  const version: unknown = Constants.expoConfig?.extra?.version;
  if (version == null || typeof version !== 'object') return null;
  const {semanticVersion, buildNumber} = version as Record<string, unknown>;
  if (typeof semanticVersion !== 'string') return null;
  if (typeof buildNumber !== 'string' && typeof buildNumber !== 'number') {
    return null;
  }
  return `${semanticVersion}-${buildNumber}`;
}

function openStore(): MMKV | null {
  // A dev bundle changes with no new update id or build version.
  if (__DEV__) return null;
  const bundle = currentBundle();
  if (!bundle) return null;
  const name = lineFitStoreName(LINE_FIT_FORMAT, bundle);
  const pointer = createMMKV({id: POINTER_ID, path: MMKV_OWN_DIRECTORY});
  const last = pointer.getString(POINTER_KEY);
  if (last !== name) {
    // The pointer moves after the delete: if the delete fails or the app stops
    // here, the next launch deletes the old store again. Never delete a store
    // with an open handle: MMKV frees the instance under that handle.
    if (last) deleteMMKV(last);
    pointer.set(POINTER_KEY, name);
  }
  const kv = createMMKV({id: name, path: MMKV_OWN_DIRECTORY});
  if (kv.length > LINE_FIT_STORE_LIMIT) kv.clearAll();
  return kv;
}

let store: MMKV | null | undefined;

function lineFitStore(): MMKV | null {
  if (store === undefined) {
    try {
      store = openStore();
    } catch {
      store = null;
    }
  }
  return store;
}

/* eslint-disable no-bitwise */
/**
 * cyrb53, a 53-bit string hash. A fit key holds the line text and its font
 * features, so the store keeps the hash and not the key. With 30,000 lines, the
 * chance of one collision is about 1 in 20 million. A collision can only give
 * one line the wrong width, and only until the next bundle.
 */
function hashKey(key: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < key.length; i++) {
    const ch = key.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}
/* eslint-enable no-bitwise */

/**
 * A valid fit has a positive word size. spaceExtra is 0 on a line that fits and
 * negative on a line that overshoots (spaceFitExtra), so it only has to be
 * finite.
 */
function isUsableFit(wordSize: number, spaceExtra: number): boolean {
  return (
    Number.isFinite(wordSize) && wordSize > 0 && Number.isFinite(spaceExtra)
  );
}

/** The fit that an earlier launch of this bundle stored for `key`. */
export function readStoredLineFit(key: string): StoredLineFit | undefined {
  const kv = lineFitStore();
  if (!kv) return undefined;
  try {
    const parts = kv.getString(hashKey(key))?.split(',');
    if (parts?.length !== 2) return undefined;
    const wordSize = parseFloat(parts[0]);
    const spaceExtra = parseFloat(parts[1]);
    return isUsableFit(wordSize, spaceExtra)
      ? {wordSize, spaceExtra}
      : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Fits wait here for the end of the render. A set is cheap, but MMKV runs
 * msync when its file must grow, and that must not hold a frame.
 */
const pendingWrites = new Map<string, string>();

function flushWrites(): void {
  const kv = lineFitStore();
  try {
    for (const [key, value] of pendingWrites) kv?.set(hashKey(key), value);
  } catch {
    // A cache only: the line is measured again at the next launch.
  }
  pendingWrites.clear();
}

/** Keeps a fit for the next launch. A fit that is not valid is not kept. */
export function storeLineFit(key: string, fit: StoredLineFit): void {
  if (!isUsableFit(fit.wordSize, fit.spaceExtra) || !lineFitStore()) return;
  if (pendingWrites.size === 0) setTimeout(flushWrites, 0);
  pendingWrites.set(key, `${fit.wordSize},${fit.spaceExtra}`);
}
