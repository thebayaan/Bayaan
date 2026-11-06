// @ai-generated
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import {
  BayaanSettingsApiError,
  type AppStateSettingsKey,
  type RemoteSettingsDocument,
} from '@/services/settings/bayaanSettingsApiClient';
import {isLibraryId} from './qfLibraryDocuments';
import {appStateLifecycleError} from '@/services/sync/appStateErrors';

/**
 * The `settings/content` App State document lists the translation and tafsir
 * editions the user has installed on any device, so a new device can offer
 * to download them. Only the list syncs, never the content.
 *
 * The list is a union: each device adds what it has installed. Removing an
 * edition on one device does not remove it elsewhere, and a device only
 * offers each missing edition once.
 */
export interface InstalledContent {
  translations: string[];
  tafsirs: string[];
}

const MAX_EDITIONS = 100;
const CONTENT_KEY = 'content';

export interface QfInstalledContentApi {
  getDocument(
    sessionToken: string,
    key: typeof CONTENT_KEY,
  ): Promise<RemoteSettingsDocument<typeof CONTENT_KEY> | null>;
  putDocument(
    sessionToken: string,
    input: {
      key: AppStateSettingsKey;
      body: string;
      idempotencyKey: string;
      etag?: string;
    },
  ): Promise<string>;
}

export interface QfInstalledContentDeps {
  api: QfInstalledContentApi;
  /** Editions installed on this device. */
  readInstalled(): Promise<InstalledContent>;
  /** Asks the user about editions installed elsewhere; resolves when done. */
  offerDownloads(missing: InstalledContent): Promise<void>;
  offered: {
    load(accountId: string): Promise<InstalledContent>;
    save(accountId: string, offered: InstalledContent): Promise<void>;
  };
}

export interface QfInstalledContentResult {
  rerun: boolean;
  unavailable: boolean;
}

function editionList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isLibraryId).slice(0, MAX_EDITIONS);
}

function union(left: string[], right: string[]): string[] {
  return [...new Set([...left, ...right])].sort().slice(0, MAX_EDITIONS);
}

function sameList(left: string[], right: string[]): boolean {
  const a = [...left].sort();
  const b = [...right].sort();
  return a.length === b.length && a.every((item, index) => item === b[index]);
}

function isUnavailable(error: BayaanSettingsApiError): boolean {
  return (
    error.status === 403 ||
    error.status === 400 ||
    error.code === 'QF_SETTINGS_DISABLED'
  );
}

export async function syncInstalledContent(
  deps: QfInstalledContentDeps,
  input: {accountId: string; sessionToken: string; isCurrent: () => boolean},
): Promise<QfInstalledContentResult> {
  try {
    const remote = await deps.api.getDocument(input.sessionToken, CONTENT_KEY);
    if (!input.isCurrent()) return {rerun: false, unavailable: false};
    const installed = await deps.readInstalled();
    const remoteList: InstalledContent = {
      translations: editionList(remote?.value.translations),
      tafsirs: editionList(remote?.value.tafsirs),
    };
    const next: InstalledContent = {
      translations: union(remoteList.translations, installed.translations),
      tafsirs: union(remoteList.tafsirs, installed.tafsirs),
    };

    let rerun = false;
    const changed =
      !sameList(next.translations, remoteList.translations) ||
      !sameList(next.tafsirs, remoteList.tafsirs);
    // A newer schema elsewhere is read, never downgraded.
    if (changed && !remote?.readOnly) {
      try {
        await deps.api.putDocument(input.sessionToken, {
          key: CONTENT_KEY,
          body: JSON.stringify({schemaVersion: 1, value: next}),
          idempotencyKey: Crypto.randomUUID(),
          ...(remote ? {etag: remote.etag} : {}),
        });
      } catch (error) {
        if (
          error instanceof BayaanSettingsApiError &&
          [409, 412, 428].includes(error.status)
        ) {
          rerun = true;
        } else {
          throw error;
        }
      }
    }
    if (!input.isCurrent()) return {rerun, unavailable: false};

    const offered = await deps.offered.load(input.accountId);
    const missing: InstalledContent = {
      translations: remoteList.translations.filter(
        id =>
          !installed.translations.includes(id) &&
          !offered.translations.includes(id),
      ),
      tafsirs: remoteList.tafsirs.filter(
        id => !installed.tafsirs.includes(id) && !offered.tafsirs.includes(id),
      ),
    };
    if (missing.translations.length || missing.tafsirs.length) {
      // Record first, so a crash or a second round never asks twice.
      await deps.offered.save(input.accountId, {
        translations: union(offered.translations, missing.translations),
        tafsirs: union(offered.tafsirs, missing.tafsirs),
      });
      if (input.isCurrent()) await deps.offerDownloads(missing);
    }
    return {rerun, unavailable: false};
  } catch (error) {
    if (!(error instanceof BayaanSettingsApiError)) throw error;
    if (isUnavailable(error)) return {rerun: false, unavailable: true};
    throw appStateLifecycleError(error);
  }
}

const OFFERED_PREFIX = 'qf-content-offered-v1:';

export const offeredContentStorage: QfInstalledContentDeps['offered'] = {
  async load(accountId) {
    try {
      const raw = await AsyncStorage.getItem(`${OFFERED_PREFIX}${accountId}`);
      const parsed = raw ? (JSON.parse(raw) as Partial<InstalledContent>) : {};
      return {
        translations: editionList(parsed.translations),
        tafsirs: editionList(parsed.tafsirs),
      };
    } catch {
      return {translations: [], tafsirs: []};
    }
  },
  async save(accountId, offered) {
    await AsyncStorage.setItem(
      `${OFFERED_PREFIX}${accountId}`,
      JSON.stringify(offered),
    );
  },
};
