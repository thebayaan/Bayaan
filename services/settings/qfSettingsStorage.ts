import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  PreferenceMutation,
  SettingsDocumentKey,
} from './bayaanSettingsApiClient';
import type {SettingsDocuments} from './qfSettingsSnapshot';

const STORAGE_PREFIX = 'qf-settings-sync-v1:';
const STORAGE_VERSION = 1;

export interface PendingSettingsDocument {
  body: string;
  idempotencyKey: string;
  etag?: string;
}

export interface PersistedSettingsSyncState {
  version: typeof STORAGE_VERSION;
  initialized: boolean;
  etags: Partial<Record<SettingsDocumentKey, string>>;
  pending: Partial<Record<SettingsDocumentKey, PendingSettingsDocument>>;
  localDocuments: Partial<SettingsDocuments>;
  preferencePending: PreferenceMutation[] | null;
  localPreferences: PreferenceMutation[];
  localPreferenceFingerprint: string | null;
  syncedPreferenceFingerprint: string | null;
}

function emptyState(): PersistedSettingsSyncState {
  return {
    version: STORAGE_VERSION,
    initialized: false,
    etags: {},
    pending: {},
    localDocuments: {},
    preferencePending: null,
    localPreferences: [],
    localPreferenceFingerprint: null,
    syncedPreferenceFingerprint: null,
  };
}

function storageKey(accountId: string): string {
  if (!accountId || accountId.length > 256)
    throw new Error('Invalid account id');
  return `${STORAGE_PREFIX}${accountId}`;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export class QfSettingsStorage {
  async load(accountId: string): Promise<PersistedSettingsSyncState> {
    const raw = await AsyncStorage.getItem(storageKey(accountId));
    if (!raw) return emptyState();
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!isObject(parsed) || parsed.version !== STORAGE_VERSION)
        return emptyState();
      return {
        ...emptyState(),
        initialized: parsed.initialized === true,
        etags: isObject(parsed.etags) ? (parsed.etags as never) : {},
        pending: isObject(parsed.pending) ? (parsed.pending as never) : {},
        localDocuments: isObject(parsed.localDocuments)
          ? (parsed.localDocuments as never)
          : {},
        preferencePending: Array.isArray(parsed.preferencePending)
          ? (parsed.preferencePending as PreferenceMutation[])
          : null,
        localPreferences: Array.isArray(parsed.localPreferences)
          ? (parsed.localPreferences as PreferenceMutation[])
          : [],
        localPreferenceFingerprint:
          typeof parsed.localPreferenceFingerprint === 'string'
            ? parsed.localPreferenceFingerprint
            : null,
        syncedPreferenceFingerprint:
          typeof parsed.syncedPreferenceFingerprint === 'string'
            ? parsed.syncedPreferenceFingerprint
            : null,
      };
    } catch {
      return emptyState();
    }
  }

  async save(
    accountId: string,
    state: PersistedSettingsSyncState,
  ): Promise<void> {
    await AsyncStorage.setItem(storageKey(accountId), JSON.stringify(state));
  }
}

export const qfSettingsStorage = new QfSettingsStorage();
