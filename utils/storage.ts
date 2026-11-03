import AsyncStorage from '@react-native-async-storage/async-storage';
// @ai-start
import * as Sentry from '@sentry/react-native';
import {createJSONStorage, type StateStorage} from 'zustand/middleware';
import {remapMergedReciterJson} from '@/utils/reciterMerges';
// @ai-end

export const storage = AsyncStorage;

// @ai-start
// The kinds of failure already reported to Sentry this session.
const reportedFailures = new Set<'read' | 'write'>();
// Keys whose last read resolved. Only these may be written (see
// hydrationGuardedStorage).
const readKeys = new Set<string>();

/**
 * Logs a failed read or write, and reports the first of each per session to
 * Sentry as a warning. A device that is out of space fails every write, and a
 * locked one fails every read, so one report of each is enough to see it
 * without flooding the issue stream.
 */
function reportStorageFailure(
  op: 'getItem' | 'setItem' | 'removeItem',
  key: string,
  error: unknown,
): void {
  console.warn(`[Storage] ${op} failed for "${key}":`, error);
  const kind = op === 'getItem' ? 'read' : 'write';
  if (reportedFailures.has(kind)) {
    return;
  }
  reportedFailures.add(kind);
  Sentry.captureMessage(
    kind === 'read' ? 'storage-read-failed' : 'storage-write-failed',
    {
      level: 'warning',
      tags: {storage_op: op},
      extra: {key, error: String(error)},
    },
  );
}

/**
 * Lets a test start a fresh session: the first failures report again, and no
 * key has been read.
 */
export function resetStorageForTests(): void {
  reportedFailures.clear();
  readKeys.clear();
}

/**
 * AsyncStorage with writes that never reject.
 *
 * zustand `persist` calls `setItem` on every state change and does not catch
 * the promise it returns. When a write fails (most often NSCocoaErrorDomain
 * 640, the device is out of space), each state change became an unhandled
 * rejection (BAYAAN-6J). A failed write here is logged and dropped instead:
 * the in-memory state stays correct, and the next successful write persists
 * it. Reads are not caught, because `persist` already handles a failed
 * hydration. A read moves anything saved under a merged reciter over to the
 * reciter it was merged into (see utils/reciterMerges), so every store
 * hydrates with the kept id; the next write saves it that way.
 */
export const safeAsyncStorage: StateStorage = {
  getItem: async name => {
    const value = await AsyncStorage.getItem(name);
    return value === null ? null : remapMergedReciterJson(value);
  },
  setItem: async (name, value) => {
    try {
      await AsyncStorage.setItem(name, value);
    } catch (error) {
      reportStorageFailure('setItem', name, error);
    }
  },
  removeItem: async name => {
    try {
      await AsyncStorage.removeItem(name);
    } catch (error) {
      reportStorageFailure('removeItem', name, error);
    }
  },
};

/**
 * safeAsyncStorage that writes a key only after a read of it has resolved.
 *
 * zustand `persist` writes the whole store on every state change, hydrated or
 * not. When the hydrating read fails (iOS file protection before the first
 * unlock, a full disk), the store keeps its defaults, and its next change
 * would write them over the saved data. So a write or remove before the read
 * resolves is dropped. A fresh install resolves with null, so it counts.
 * A read that rejects is reported and leaves the key read-only, and persist
 * keeps `hasHydrated()` false until a later `rehydrate()` reads it.
 *
 * When the read finds saved state, persist merges it into memory and does not
 * write, so the dropped write leaves memory and disk in step. The key turns
 * writable a few microtasks before that merge; no user event runs in between.
 */
const hydrationGuardedStorage: StateStorage = {
  getItem: async name => {
    try {
      const value = await safeAsyncStorage.getItem(name);
      readKeys.add(name);
      return value;
    } catch (error) {
      readKeys.delete(name);
      reportStorageFailure('getItem', name, error);
      throw error;
    }
  },
  setItem: async (name, value) => {
    if (readKeys.has(name)) {
      await safeAsyncStorage.setItem(name, value);
    }
  },
  removeItem: async name => {
    if (readKeys.has(name)) {
      await safeAsyncStorage.removeItem(name);
    }
  },
};

/**
 * The storage every persisted zustand store uses: JSON over safeAsyncStorage,
 * with no write to a key before it has been read (see above).
 * Generic so each store's `persist` options infer their own state type.
 */
export const persistStorage = <S>() =>
  createJSONStorage<S>(() => hydrationGuardedStorage);
// @ai-end

export const clearStorage = async () => {
  try {
    await AsyncStorage.clear();
    console.log('Storage successfully cleared!');
  } catch (error) {
    console.error('Error clearing storage:', error);
  }
};
