// @ai-generated
import * as Crypto from 'expo-crypto';
import {
  BayaanSettingsApiError,
  type LibraryCollection,
  type RemoteLibraryDocument,
} from '@/services/settings/bayaanSettingsApiClient';
import {fitsDocumentLimit, libraryCodec} from './qfLibraryDocuments';
import {
  EMPTY_ENTRIES,
  mergeDocument,
  mergeEntries,
  sameEntries,
  type LibraryEntries,
} from './qfLibraryMerge';
import type {
  QfLibrarySyncStorage,
  SyncedLibraryDocument,
} from './qfLibrarySyncStorage';
import {
  appStateLifecycleError,
  isAppStateConflict,
} from '@/services/sync/appStateErrors';

export interface QfLibrarySyncApi {
  getAppStateCollections(sessionToken: string): Promise<string[]>;
  listLibrary(
    sessionToken: string,
    collection: LibraryCollection,
  ): Promise<RemoteLibraryDocument[]>;
  putLibrary(
    sessionToken: string,
    input: {
      collection: LibraryCollection;
      key: string;
      value: unknown;
      idempotencyKey: string;
      etag?: string;
    },
  ): Promise<string>;
  deleteLibrary(
    sessionToken: string,
    input: {
      collection: LibraryCollection;
      key: string;
      idempotencyKey: string;
      etag: string;
    },
  ): Promise<void>;
}

/**
 * How one collection's documents map onto this device's own stores.
 * `readLocal` returns every document the device has, keyed like the remote
 * ones; documents with no items may be left out.
 */
export interface QfLibraryLocalAdapter {
  collection: LibraryCollection;
  /** Documents can be deleted (playlists); others are emptied instead. */
  deletable: boolean;
  readLocal(
    synced: ReadonlyMap<string, LibraryEntries>,
  ): Promise<Map<string, LibraryEntries>>;
  /**
   * Replace one document's local items, only if they still equal `expected`
   * (`null`: absent). Returns false if the user edited them meanwhile.
   */
  applyLocal(
    key: string,
    expected: LibraryEntries | null,
    next: LibraryEntries | null,
  ): Promise<boolean>;
}

export interface QfLibrarySyncInput {
  accountId: string;
  sessionToken: string;
  isCurrent: () => boolean;
}

export interface QfLibrarySyncResult {
  /** A document could not settle this round (a 412 or an edit mid-sync). */
  rerun: boolean;
  /** Collections QF hasn't enabled for this client; they were skipped. */
  unavailable: LibraryCollection[];
}

interface RemoteDocument {
  etag: string;
  entries: LibraryEntries;
}

/** QF hasn't enabled the collection for this client, or App State is off. */
function isUnavailable(error: BayaanSettingsApiError): boolean {
  return (
    error.status === 403 ||
    error.status === 404 ||
    error.code === 'QF_SETTINGS_DISABLED'
  );
}

/** QF or the BFF refused this document alone (e.g. a 400). */
function isRejectedDocument(error: unknown): boolean {
  return (
    error instanceof BayaanSettingsApiError &&
    error.status >= 400 &&
    error.status < 500 &&
    ![401, 403, 404, 408, 409, 412, 428, 429].includes(error.status) &&
    error.code !== 'QF_SETTINGS_DISABLED'
  );
}

/**
 * Syncs Bayaan's library collections through QF App State. Each round lists
 * every document of a collection, three-way merges it per item with this
 * device's copy against the copy last synced, writes the merge locally and,
 * when it differs, back to QF with the document's precondition. This is the
 * same model as highlights (see qfHighlightSync.ts).
 */
export async function syncQfLibrary(
  deps: {
    api: QfLibrarySyncApi;
    storage: QfLibrarySyncStorage;
    adapters: QfLibraryLocalAdapter[];
  },
  input: QfLibrarySyncInput,
): Promise<QfLibrarySyncResult> {
  const result: QfLibrarySyncResult = {rerun: false, unavailable: []};
  // The library stores are shared by every account on the device. If another
  // account left synced items behind (its session expired rather than an
  // explicit sign-out), clear them first so they are not merged into this one.
  for (const other of await deps.storage.accounts()) {
    if (other !== input.accountId) await purgeSyncedLibrary(deps, other);
  }
  if (!input.isCurrent()) return result;
  let enabled: string[];
  try {
    enabled = await deps.api.getAppStateCollections(input.sessionToken);
  } catch (error) {
    if (!(error instanceof BayaanSettingsApiError)) throw error;
    if (!isUnavailable(error)) throw appStateLifecycleError(error);
    enabled = [];
  }
  for (const adapter of deps.adapters) {
    if (!input.isCurrent()) return result;
    // Skip a collection QF hasn't enabled yet rather than failing sync.
    if (!enabled.includes(adapter.collection)) {
      result.unavailable.push(adapter.collection);
      continue;
    }
    try {
      const rerun = await syncCollection(deps, adapter, input);
      result.rerun ||= rerun;
    } catch (error) {
      if (!(error instanceof BayaanSettingsApiError)) throw error;
      if (isUnavailable(error)) {
        result.unavailable.push(adapter.collection);
        continue;
      }
      throw appStateLifecycleError(error);
    }
  }
  return result;
}

async function syncCollection(
  deps: {api: QfLibrarySyncApi; storage: QfLibrarySyncStorage},
  adapter: QfLibraryLocalAdapter,
  input: QfLibrarySyncInput,
): Promise<boolean> {
  const {collection} = adapter;
  const listed = await deps.api.listLibrary(input.sessionToken, collection);
  if (!input.isCurrent()) return false;

  const remote = new Map<string, RemoteDocument>();
  const untouchable = new Set<string>();
  for (const document of listed) {
    const codec = libraryCodec(collection, document.key);
    const entries =
      codec && !document.readOnly ? codec.decode(document.value) : undefined;
    if (entries) {
      remote.set(document.key, {etag: document.etag, entries});
    } else {
      // Newer schema or a key this version doesn't use: leave it alone.
      untouchable.add(document.key);
    }
  }

  const synced = await deps.storage.load(input.accountId, collection);
  const syncedEntries = new Map(
    [...synced].map(([key, document]) => [key, document.entries]),
  );
  const local = await adapter.readLocal(syncedEntries);
  if (!input.isCurrent()) return false;

  let rerun = false;
  const keys = [
    ...new Set([...remote.keys(), ...local.keys(), ...synced.keys()]),
  ]
    .filter(key => !untouchable.has(key) && libraryCodec(collection, key))
    .sort();
  for (const key of keys) {
    if (!input.isCurrent()) return rerun;
    try {
      const settled = await syncDocument(deps, adapter, input, {
        key,
        base: synced.get(key),
        local: local.get(key),
        remote: remote.get(key),
      });
      rerun ||= settled;
    } catch (error) {
      if (!isRejectedDocument(error)) throw error;
      console.warn(`[QfLibrarySync] ${collection}/${key} was rejected`);
    }
  }
  return rerun;
}

/** Returns true when the document must be retried on a later round. */
async function syncDocument(
  deps: {api: QfLibrarySyncApi; storage: QfLibrarySyncStorage},
  adapter: QfLibraryLocalAdapter,
  input: QfLibrarySyncInput,
  document: {
    key: string;
    base: SyncedLibraryDocument | undefined;
    local: LibraryEntries | undefined;
    remote: RemoteDocument | undefined;
  },
): Promise<boolean> {
  const {collection} = adapter;
  const {key, base, local, remote} = document;
  const codec = libraryCodec(collection, key)!;

  // Non-deletable documents treat absence as empty.
  const localEntries = local ?? (adapter.deletable ? null : EMPTY_ENTRIES);
  const merged = adapter.deletable
    ? mergeDocument(
        base?.entries ?? null,
        localEntries,
        remote?.entries ?? null,
      )
    : mergeEntries(
        base?.entries ?? EMPTY_ENTRIES,
        localEntries ?? EMPTY_ENTRIES,
        remote?.entries ?? EMPTY_ENTRIES,
      );

  const localChanged =
    merged === null
      ? localEntries !== null && Object.keys(localEntries).length > 0
      : localEntries === null || !sameEntries(merged, localEntries);
  if (localChanged) {
    const applied = await adapter.applyLocal(key, localEntries, merged);
    // An edit landed mid-sync; merge it on the next round.
    if (!applied) return true;
  }
  if (!input.isCurrent()) return false;

  if (merged === null) {
    if (remote) {
      try {
        await deps.api.deleteLibrary(input.sessionToken, {
          collection,
          key,
          idempotencyKey: Crypto.randomUUID(),
          etag: remote.etag,
        });
      } catch (error) {
        if (isAppStateConflict(error)) return true;
        throw error;
      }
      if (!input.isCurrent()) return false;
    }
    await deps.storage.save(input.accountId, collection, key, null);
    return false;
  }

  const mustWrite = remote
    ? !sameEntries(merged, remote.entries)
    : Object.keys(merged).length > 0;
  if (!mustWrite) {
    const next = remote ? {etag: remote.etag, entries: merged} : null;
    const unchanged =
      next === null
        ? base === undefined
        : base?.etag === next.etag && sameEntries(base.entries, merged);
    if (!unchanged) {
      await deps.storage.save(input.accountId, collection, key, next);
    }
    return false;
  }

  const value = codec.encode(merged);
  if (!fitsDocumentLimit(value)) {
    // Too big to sync; it stays on this device only.
    console.warn(`[QfLibrarySync] ${collection}/${key} is over 16 KB`);
    return false;
  }
  let etag: string;
  try {
    etag = await deps.api.putLibrary(input.sessionToken, {
      collection,
      key,
      value,
      idempotencyKey: Crypto.randomUUID(),
      ...(remote ? {etag: remote.etag} : {}),
    });
  } catch (error) {
    // Another device wrote first; the next round merges its document.
    if (isAppStateConflict(error)) return true;
    throw error;
  }
  if (!input.isCurrent()) return false;
  await deps.storage.save(input.accountId, collection, key, {
    etag,
    entries: merged,
  });
  return false;
}

/**
 * On explicit sign-out, removes from this device every library item that is
 * exactly as last synced with the account, since QF holds a copy, and
 * forgets the account's sync state. Items never synced or edited since stay,
 * so nothing is lost; like highlights, they don't trigger the sign-out
 * warning. The next sign-in pulls the account again.
 */
export async function purgeSyncedLibrary(
  deps: {storage: QfLibrarySyncStorage; adapters: QfLibraryLocalAdapter[]},
  accountId: string,
): Promise<void> {
  for (const adapter of deps.adapters) {
    const synced = await deps.storage.load(accountId, adapter.collection);
    const syncedEntries = new Map(
      [...synced].map(([key, document]) => [key, document.entries]),
    );
    const local = await adapter.readLocal(syncedEntries);
    for (const [key, document] of synced) {
      const current = local.get(key) ?? null;
      if (current === null) continue;
      let next: LibraryEntries | null;
      if (adapter.deletable) {
        next = sameEntries(current, document.entries) ? null : current;
      } else {
        const kept: Record<string, string> = {};
        for (const [item, value] of Object.entries(current)) {
          if (document.entries[item] !== value) kept[item] = value;
        }
        next = kept;
      }
      if (next === null || !sameEntries(next, current)) {
        await adapter.applyLocal(key, current, next);
      }
    }
    await deps.storage.clear(accountId, adapter.collection);
  }
}
