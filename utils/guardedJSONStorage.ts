// @ai-generated
/**
 * A drop-in replacement for `createJSONStorage(() => AsyncStorage)` that will
 * not overwrite stored data it could not read.
 *
 * Why: zustand's `persist` middleware writes the whole store on every `set()`.
 * When the hydrating read fails (the device is out of space, iOS file
 * protection keeps the file locked until the first unlock after a reboot, or
 * the native storage layer errors), the store stays at its defaults. The next
 * `set()` of any kind then writes those defaults over the user's real data.
 * The loss is silent and permanent.
 *
 * What this adds:
 *   - When a read of a key REJECTS, writes and removes for that key are
 *     skipped. The stored bytes stay as they are, so a later read can still
 *     get them back.
 *   - A write made while a read of the same key is in flight is held until
 *     that read settles. If the read succeeds, the newest held write is sent
 *     (the same bytes zustand would have sent, a few milliseconds later). If
 *     the read fails, it is dropped.
 *   - The next read of the key that resolves (for example from
 *     `useStore.persist.rehydrate()`) merges the stored state into the store
 *     and lets writes through again.
 *   - The read error is re-thrown, so zustand behaves as before: the store
 *     keeps its defaults, `onRehydrateStorage` receives the error and
 *     `persist.hasHydrated()` stays false.
 *
 * What does not change:
 *   - A read that resolves with `null` (a fresh install) is a successful read.
 *     Writes go through.
 *   - JSON handling is the same as `createJSONStorage`.
 *   - A stored value that is not valid JSON is not guarded. The read itself
 *     succeeded, the value cannot be recovered, and the next write replaces
 *     it. Treating it like a failed read would block that store from saving
 *     on every launch.
 *
 * Apps can report these failures with `setPersistStorageErrorHandler`.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  PersistStorage,
  StateStorage,
  StorageValue,
} from 'zustand/middleware';

export type PersistStorageErrorKind = 'read' | 'parse' | 'write';

export type PersistStorageErrorHandler = (
  kind: PersistStorageErrorKind,
  name: string,
  error: unknown,
) => void;

const defaultErrorHandler: PersistStorageErrorHandler = (kind, name, error) => {
  if (__DEV__) {
    console.warn(`[persist] ${kind} failed for "${name}":`, error);
  }
};

let errorHandler: PersistStorageErrorHandler = defaultErrorHandler;

/**
 * Sets the function that receives storage failures from every store that uses
 * `createGuardedJSONStorage`. Pass `null` to restore the default, which warns
 * in development only.
 */
export function setPersistStorageErrorHandler(
  handler: PersistStorageErrorHandler | null,
): void {
  errorHandler = handler ?? defaultErrorHandler;
}

function report(
  kind: PersistStorageErrorKind,
  name: string,
  error: unknown,
): void {
  try {
    errorHandler(kind, name, error);
  } catch {
    // A failing reporter must not change how storage behaves.
  }
}

/**
 * Use as the `storage` option of `persist`:
 *
 *   persist(creator, {name: 'my-store', storage: createGuardedJSONStorage()})
 *
 * Each call returns an independent adapter, and the guard is tracked for each
 * key, so one unreadable store never blocks writes to another.
 */
export function createGuardedJSONStorage<S>(
  storage: StateStorage = AsyncStorage,
): PersistStorage<S> {
  // Number of reads in flight for each key.
  const pendingReads = new Map<string, number>();
  // The newest write made while a read of the key was in flight.
  const heldWrites = new Map<string, string>();
  // Keys whose most recent read rejected.
  const unreadable = new Set<string>();

  const write = (name: string, json: string) =>
    Promise.resolve(storage.setItem(name, json)).catch(error => {
      report('write', name, error);
      throw error;
    });

  const finishRead = (name: string, succeeded: boolean): void => {
    const remaining = (pendingReads.get(name) ?? 1) - 1;
    if (remaining > 0) {
      pendingReads.set(name, remaining);
    } else {
      pendingReads.delete(name);
    }

    if (!succeeded) {
      unreadable.add(name);
      // On the first read, the held write carries the store's defaults.
      // Sending it is the overwrite this adapter exists to prevent.
      heldWrites.delete(name);
      return;
    }

    unreadable.delete(name);
    const held = heldWrites.get(name);
    if (remaining === 0 && held !== undefined) {
      heldWrites.delete(name);
      // `write` already reports a failure, and nothing awaits this call.
      write(name, held).catch(() => undefined);
    }
  };

  return {
    getItem: name => {
      pendingReads.set(name, (pendingReads.get(name) ?? 0) + 1);
      let read: Promise<string | null>;
      try {
        read = Promise.resolve(storage.getItem(name));
      } catch (error) {
        read = Promise.reject(error);
      }
      return read.then(
        raw => {
          finishRead(name, true);
          if (raw == null) {
            return null;
          }
          try {
            return JSON.parse(raw) as StorageValue<S>;
          } catch (error) {
            report('parse', name, error);
            throw error;
          }
        },
        error => {
          finishRead(name, false);
          report('read', name, error);
          throw error;
        },
      );
    },
    setItem: (name, value) => {
      if (unreadable.has(name)) {
        return;
      }
      const json = JSON.stringify(value);
      if (pendingReads.has(name)) {
        heldWrites.set(name, json);
        return;
      }
      return write(name, json);
    },
    removeItem: name => {
      if (unreadable.has(name)) {
        return;
      }
      // A held write must not land after this remove.
      heldWrites.delete(name);
      return storage.removeItem(name);
    },
  };
}
