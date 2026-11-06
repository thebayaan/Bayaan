// @ai-generated
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {LibraryCollection} from '@/services/settings/bayaanSettingsApiClient';
import type {LibraryEntries} from './qfLibraryMerge';

/** The copy of a document last synced with QF, and its ETag. */
export interface SyncedLibraryDocument {
  etag: string;
  entries: LibraryEntries;
}

export interface QfLibrarySyncStorage {
  load(
    accountId: string,
    collection: LibraryCollection,
  ): Promise<Map<string, SyncedLibraryDocument>>;
  save(
    accountId: string,
    collection: LibraryCollection,
    key: string,
    document: SyncedLibraryDocument | null,
  ): Promise<void>;
  clear(accountId: string, collection: LibraryCollection): Promise<void>;
  /** Accounts that have library sync state on this device. */
  accounts(): Promise<string[]>;
}

const PREFIX = 'qf-library-sync-v1:';

function storageKey(accountId: string, collection: LibraryCollection) {
  return `${PREFIX}${accountId}:${collection}`;
}

function isSyncedDocument(value: unknown): value is SyncedLibraryDocument {
  if (!value || typeof value !== 'object') return false;
  const document = value as Record<string, unknown>;
  return (
    typeof document.etag === 'string' &&
    Boolean(document.entries) &&
    typeof document.entries === 'object' &&
    Object.values(document.entries as object).every(
      item => typeof item === 'string',
    )
  );
}

/**
 * Last-synced copies per account and collection, in AsyncStorage. Writes for
 * one collection are serialised so concurrent saves can't drop each other.
 */
export function createQfLibrarySyncStorage(
  store: Pick<
    typeof AsyncStorage,
    'getItem' | 'setItem' | 'removeItem' | 'getAllKeys'
  > = AsyncStorage,
): QfLibrarySyncStorage {
  const queues = new Map<string, Promise<unknown>>();
  const serial = <T>(key: string, task: () => Promise<T>): Promise<T> => {
    const next = (queues.get(key) ?? Promise.resolve()).then(task, task);
    queues.set(
      key,
      next.catch(() => undefined),
    );
    return next;
  };

  const read = async (key: string) => {
    const raw = await store.getItem(key);
    const documents = new Map<string, SyncedLibraryDocument>();
    if (!raw) return documents;
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      for (const [name, document] of Object.entries(parsed)) {
        if (isSyncedDocument(document)) documents.set(name, document);
      }
    } catch {
      // A corrupt record only costs a fresh merge against QF.
    }
    return documents;
  };

  return {
    load: (accountId, collection) => read(storageKey(accountId, collection)),
    save: (accountId, collection, key, document) => {
      const name = storageKey(accountId, collection);
      return serial(name, async () => {
        const documents = await read(name);
        if (document) documents.set(key, document);
        else documents.delete(key);
        await store.setItem(
          name,
          JSON.stringify(Object.fromEntries(documents)),
        );
      });
    },
    clear: (accountId, collection) => {
      const name = storageKey(accountId, collection);
      return serial(name, () => store.removeItem(name));
    },
    accounts: async () => {
      const keys = await store.getAllKeys();
      const accounts = new Set<string>();
      for (const key of keys) {
        if (!key.startsWith(PREFIX)) continue;
        const rest = key.slice(PREFIX.length);
        accounts.add(rest.slice(0, rest.lastIndexOf(':')));
      }
      return [...accounts];
    },
  };
}

export const qfLibrarySyncStorage = createQfLibrarySyncStorage();
