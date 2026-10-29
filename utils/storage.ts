import AsyncStorage from '@react-native-async-storage/async-storage';
// @ai-start
import * as Sentry from '@sentry/react-native';
import {createJSONStorage, type StateStorage} from 'zustand/middleware';
import {remapMergedReciterJson} from '@/utils/reciterMerges';
// @ai-end

export const storage = AsyncStorage;

// @ai-start
let reportedWriteFailure = false;

/**
 * Logs a failed write, and reports the first one per session to Sentry as a
 * warning. A device that is out of space fails every write, so one report is
 * enough to see it without flooding the issue stream.
 */
function reportWriteFailure(
  op: 'setItem' | 'removeItem',
  key: string,
  error: unknown,
): void {
  console.warn(`[Storage] ${op} failed for "${key}":`, error);
  if (reportedWriteFailure) {
    return;
  }
  reportedWriteFailure = true;
  Sentry.captureMessage('storage-write-failed', {
    level: 'warning',
    tags: {storage_op: op},
    extra: {key, error: String(error)},
  });
}

/** Lets a test start a fresh session, so the first failure reports again. */
export function resetWriteFailureReportForTests(): void {
  reportedWriteFailure = false;
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
      reportWriteFailure('setItem', name, error);
    }
  },
  removeItem: async name => {
    try {
      await AsyncStorage.removeItem(name);
    } catch (error) {
      reportWriteFailure('removeItem', name, error);
    }
  },
};

/**
 * The storage every persisted zustand store uses: JSON over safeAsyncStorage.
 * Generic so each store's `persist` options infer their own state type.
 */
export const persistStorage = <S>() =>
  createJSONStorage<S>(() => safeAsyncStorage);
// @ai-end

export const clearStorage = async () => {
  try {
    await AsyncStorage.clear();
    console.log('Storage successfully cleared!');
  } catch (error) {
    console.error('Error clearing storage:', error);
  }
};
