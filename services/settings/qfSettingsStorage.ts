import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  PreferenceMutation,
  SettingsDocumentKey,
} from './bayaanSettingsApiClient';
import type {SettingsDocuments} from './qfSettingsSnapshot';
import type {SettingsChange} from './qfSettingsMerge';

const STORAGE_PREFIX = 'qf-settings-sync-v1:';
const DEVICE_CONTEXT_KEY = 'qf-settings-device-context-v1';
const STORAGE_VERSION = 1;

export interface PendingSettingsDocument {
  changes: SettingsChange[];
  localSnapshot: Record<string, unknown>;
  attempted?: boolean;
  body: string;
  idempotencyKey: string;
  etag?: string;
}

export interface PersistedSettingsDeviceContext {
  version: typeof STORAGE_VERSION;
  ownerAccountId: string;
  baselineDocuments: SettingsDocuments;
  baselinePreferences: PreferenceMutation[];
}

export interface PersistedSettingsSyncState {
  version: typeof STORAGE_VERSION;
  initialized: boolean;
  needsReconciliation: boolean;
  // Raw server value preserves fields this app version does not understand.
  syncedDocuments: Partial<SettingsDocuments>;
  // Full device projection at the last acknowledged synchronization.
  syncedLocalDocuments: Partial<SettingsDocuments>;
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
    needsReconciliation: false,
    syncedDocuments: {},
    syncedLocalDocuments: {},
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

function validPending(value: unknown): boolean {
  if (!isObject(value)) return false;
  return Object.values(value).every(
    item =>
      isObject(item) &&
      typeof item.body === 'string' &&
      typeof item.idempotencyKey === 'string' &&
      isObject(item.localSnapshot) &&
      Array.isArray(item.changes) &&
      item.changes.every(
        change =>
          isObject(change) &&
          Array.isArray(change.path) &&
          change.path.length > 0 &&
          change.path.every(
            segment =>
              typeof segment === 'string' &&
              !['__proto__', 'prototype', 'constructor'].includes(segment),
          ) &&
          (change.remove === true || Object.hasOwn(change, 'value')),
      ),
  );
}

export class QfSettingsStorage {
  async loadDeviceContext(): Promise<PersistedSettingsDeviceContext | null> {
    const raw = await AsyncStorage.getItem(DEVICE_CONTEXT_KEY);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (
        !isObject(parsed) ||
        parsed.version !== STORAGE_VERSION ||
        typeof parsed.ownerAccountId !== 'string' ||
        !isObject(parsed.baselineDocuments) ||
        !Array.isArray(parsed.baselinePreferences)
      ) {
        return null;
      }
      return parsed as unknown as PersistedSettingsDeviceContext;
    } catch {
      return null;
    }
  }

  async saveDeviceContext(
    context: PersistedSettingsDeviceContext,
  ): Promise<void> {
    await AsyncStorage.setItem(DEVICE_CONTEXT_KEY, JSON.stringify(context));
  }

  async load(accountId: string): Promise<PersistedSettingsSyncState> {
    const raw = await AsyncStorage.getItem(storageKey(accountId));
    if (!raw) return emptyState();
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!isObject(parsed) || parsed.version !== STORAGE_VERSION)
        return emptyState();
      const requiresMigration =
        !isObject(parsed.syncedDocuments) ||
        !isObject(parsed.syncedLocalDocuments) ||
        !validPending(parsed.pending);
      return {
        ...emptyState(),
        initialized: parsed.initialized === true,
        // v1 had neither raw baselines nor field intent. Do not replay its
        // stale full bodies: retain the local snapshot and ask at first sync.
        needsReconciliation:
          parsed.needsReconciliation === true ||
          (parsed.initialized === true && requiresMigration),
        syncedDocuments: isObject(parsed.syncedDocuments)
          ? (parsed.syncedDocuments as never)
          : {},
        syncedLocalDocuments: isObject(parsed.syncedLocalDocuments)
          ? (parsed.syncedLocalDocuments as never)
          : {},
        etags: isObject(parsed.etags) ? (parsed.etags as never) : {},
        pending: !requiresMigration ? (parsed.pending as never) : {},
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
