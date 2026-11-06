import * as Crypto from 'expo-crypto';
import {
  BayaanSettingsApiError,
  type RemoteHighlightsDocument,
} from '@/services/settings/bayaanSettingsApiClient';
import {
  decodeHighlightDocument,
  encodeHighlightDocument,
  mergeHighlights,
  sameHighlights,
  type QfHighlightEntries,
} from './qfHighlightMerge';
import type {
  QfHighlightSyncSnapshot,
  QfSyncedHighlights,
} from './qfSyncDatabaseService';
import {appStateLifecycleError, isAppStateConflict} from './appStateErrors';

export interface QfHighlightSyncApi {
  listHighlights(sessionToken: string): Promise<RemoteHighlightsDocument[]>;
  putHighlights(
    sessionToken: string,
    input: {
      surahNumber: number;
      value: unknown;
      idempotencyKey: string;
      etag?: string;
    },
  ): Promise<string>;
}

export interface QfHighlightSyncStore {
  getHighlightSyncSnapshot(accountId: string): Promise<QfHighlightSyncSnapshot>;
  applySyncedHighlights(input: {
    accountId: string;
    surahNumber: number;
    expected: QfHighlightEntries;
    next: QfHighlightEntries;
  }): Promise<boolean>;
  saveSyncedHighlights(input: {
    accountId: string;
    surahNumber: number;
    synced: QfSyncedHighlights | null;
  }): Promise<void>;
}

export interface QfHighlightSyncInput {
  accountId: string;
  sessionToken: string;
  isCurrent: () => boolean;
}

export interface QfHighlightSyncResult {
  /** Local highlights changed, so loaded views should reload. */
  changedLocal: boolean;
  /** A surah could not settle this round (a 412 or an edit mid-sync). */
  rerun: boolean;
  /** App State is not available to this client; nothing was synced. */
  unavailable: boolean;
}

interface RemoteSurah {
  etag: string;
  entries: QfHighlightEntries;
}

const EMPTY: QfHighlightEntries = {};

/**
 * App State being off for the client (403, or the BFF reporting it disabled)
 * is not an error for the rest of sync, so it reports `unavailable` instead.
 */
function isUnavailable(error: BayaanSettingsApiError): boolean {
  return (
    error.status === 403 ||
    error.code === 'QF_SETTINGS_DISABLED' ||
    (error.status >= 400 &&
      error.status < 500 &&
      ![401, 408, 409, 412, 428, 429].includes(error.status))
  );
}

/**
 * A write QF or the BFF refuses for this document alone (e.g. a 400). The
 * surah stays unsynced, so sign-out keeps it, and the other surahs go on.
 */
function isRejectedDocument(error: unknown): boolean {
  return (
    error instanceof BayaanSettingsApiError &&
    error.status >= 400 &&
    error.status < 500 &&
    ![401, 403, 408, 409, 412, 428, 429].includes(error.status) &&
    error.code !== 'QF_SETTINGS_DISABLED'
  );
}

/**
 * Highlights live in QF App State, one `highlights` document per surah. Each
 * round lists every document, three-way merges it per verse with this
 * device's highlights against the last synced copy, writes the merge locally
 * and, when it differs, back to QF with the document's precondition.
 */
export async function syncQfHighlights(
  deps: {api: QfHighlightSyncApi; store: QfHighlightSyncStore},
  input: QfHighlightSyncInput,
): Promise<QfHighlightSyncResult> {
  const result: QfHighlightSyncResult = {
    changedLocal: false,
    rerun: false,
    unavailable: false,
  };
  try {
    const listed = await deps.api.listHighlights(input.sessionToken);
    if (!input.isCurrent()) return result;
    const remote = new Map<number, RemoteSurah>();
    const readOnly = new Set<number>();
    for (const document of listed) {
      const entries = document.readOnly
        ? undefined
        : decodeHighlightDocument(document.value);
      if (entries) {
        remote.set(document.surahNumber, {etag: document.etag, entries});
      } else {
        readOnly.add(document.surahNumber);
      }
    }
    const {local, synced} = await deps.store.getHighlightSyncSnapshot(
      input.accountId,
    );
    const surahs = new Set([
      ...remote.keys(),
      ...local.keys(),
      ...synced.keys(),
    ]);
    for (const surahNumber of [...surahs].sort((a, b) => a - b)) {
      if (!input.isCurrent()) return result;
      // A document this version cannot write back is left untouched.
      if (readOnly.has(surahNumber)) continue;
      let settled: {changedLocal: boolean; rerun: boolean};
      try {
        settled = await syncSurah(deps, input, {
          surahNumber,
          base: synced.get(surahNumber),
          local: local.get(surahNumber) ?? EMPTY,
          remote: remote.get(surahNumber),
        });
      } catch (error) {
        if (!isRejectedDocument(error)) throw error;
        console.warn(`[QfHighlightSync] Surah ${surahNumber} was rejected`);
        // Its merge may already be on the device; reload views to be safe.
        result.changedLocal = true;
        continue;
      }
      result.changedLocal ||= settled.changedLocal;
      result.rerun ||= settled.rerun;
    }
    return result;
  } catch (error) {
    if (!(error instanceof BayaanSettingsApiError)) throw error;
    if (isUnavailable(error)) return {...result, unavailable: true};
    throw appStateLifecycleError(error);
  }
}

async function syncSurah(
  deps: {api: QfHighlightSyncApi; store: QfHighlightSyncStore},
  input: QfHighlightSyncInput,
  surah: {
    surahNumber: number;
    base: QfSyncedHighlights | undefined;
    local: QfHighlightEntries;
    remote: RemoteSurah | undefined;
  },
): Promise<{changedLocal: boolean; rerun: boolean}> {
  const {surahNumber, base, local, remote} = surah;
  const remoteEntries = remote?.entries ?? EMPTY;
  const merged = mergeHighlights(base?.entries ?? EMPTY, local, remoteEntries);
  let changedLocal = false;
  if (!sameHighlights(merged, local)) {
    const applied = await deps.store.applySyncedHighlights({
      accountId: input.accountId,
      surahNumber,
      expected: local,
      next: merged,
    });
    // An edit landed mid-sync; merge it on the next round.
    if (!applied) return {changedLocal: false, rerun: true};
    changedLocal = true;
  }
  if (!input.isCurrent()) return {changedLocal, rerun: false};

  const mustWrite = remote
    ? !sameHighlights(merged, remoteEntries)
    : Object.keys(merged).length > 0;
  if (!mustWrite) {
    const next = remote ? {etag: remote.etag, entries: merged} : null;
    const unchanged =
      next === null
        ? base === undefined
        : base?.etag === next.etag && sameHighlights(base.entries, merged);
    if (!unchanged) {
      await deps.store.saveSyncedHighlights({
        accountId: input.accountId,
        surahNumber,
        synced: next,
      });
    }
    return {changedLocal, rerun: false};
  }

  let etag: string;
  try {
    etag = await deps.api.putHighlights(input.sessionToken, {
      surahNumber,
      value: encodeHighlightDocument(merged),
      idempotencyKey: Crypto.randomUUID(),
      ...(remote ? {etag: remote.etag} : {}),
    });
  } catch (error) {
    // Another device wrote first; the next round merges its document.
    if (isAppStateConflict(error)) return {changedLocal, rerun: true};
    throw error;
  }
  if (!input.isCurrent()) return {changedLocal, rerun: false};
  await deps.store.saveSyncedHighlights({
    accountId: input.accountId,
    surahNumber,
    synced: {etag, entries: merged},
  });
  return {changedLocal, rerun: false};
}
