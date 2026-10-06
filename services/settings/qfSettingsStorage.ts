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
const DOCUMENT_KEYS: SettingsDocumentKey[] = [
  'appearance',
  'mushaf',
  'audio',
  'adhkar',
  'browsing',
];

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
  signedOutDocuments?: SettingsDocuments;
  signedOutPreferences?: PreferenceMutation[];
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
  readOnlyDocuments?: Partial<Record<SettingsDocumentKey, boolean>>;
  pending: Partial<Record<SettingsDocumentKey, PendingSettingsDocument>>;
  localDocuments: Partial<SettingsDocuments>;
  preferencePending: PreferenceMutation[] | null;
  // Immutable submitted delta batch; retries replay every submitted key.
  preferenceInFlight?: PreferenceMutation[] | null;
  syncedPreferences?: Record<string, unknown>;
  syncedLocalPreferences?: PreferenceMutation[];
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
    preferenceInFlight: null,
    syncedPreferences: {},
    syncedLocalPreferences: [],
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

function validDocuments(value: unknown): value is Partial<SettingsDocuments> {
  return (
    isObject(value) &&
    Object.entries(value).every(
      ([key, document]) =>
        DOCUMENT_KEYS.includes(key as SettingsDocumentKey) &&
        isObject(document),
    )
  );
}

function validCompleteDocuments(value: unknown): value is SettingsDocuments {
  if (!validDocuments(value)) return false;
  return DOCUMENT_KEYS.every(key => isObject(value[key]));
}

function validPreferences(value: unknown): value is PreferenceMutation[] {
  return (
    Array.isArray(value) &&
    value.every(
      item =>
        isObject(item) &&
        typeof item.group === 'string' &&
        typeof item.key === 'string' &&
        Object.hasOwn(item, 'value') &&
        !['__proto__', 'prototype', 'constructor'].includes(item.group) &&
        !['__proto__', 'prototype', 'constructor'].includes(item.key),
    )
  );
}

function validPending(
  value: unknown,
): value is PersistedSettingsSyncState['pending'] {
  if (!isObject(value)) return false;
  return Object.entries(value).every(([key, item]) => {
    if (
      !DOCUMENT_KEYS.includes(key as SettingsDocumentKey) ||
      !isObject(item) ||
      typeof item.body !== 'string' ||
      typeof item.idempotencyKey !== 'string' ||
      !item.idempotencyKey ||
      (item.etag !== undefined && typeof item.etag !== 'string') ||
      (item.attempted !== undefined && typeof item.attempted !== 'boolean') ||
      !isObject(item.localSnapshot) ||
      !Array.isArray(item.changes)
    )
      return false;
    try {
      const body: unknown = JSON.parse(item.body);
      if (!isObject(body) || body.schemaVersion !== 1 || !isObject(body.value))
        return false;
    } catch {
      return false;
    }
    return item.changes.every(
      change =>
        isObject(change) &&
        Array.isArray(change.path) &&
        change.path.length > 0 &&
        change.path.every(
          segment =>
            typeof segment === 'string' &&
            !['__proto__', 'prototype', 'constructor'].includes(segment),
        ) &&
        (change.remove === undefined || change.remove === true) &&
        (change.remove === true || Object.hasOwn(change, 'value')),
    );
  });
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
        !validCompleteDocuments(parsed.baselineDocuments) ||
        !validPreferences(parsed.baselinePreferences) ||
        (parsed.signedOutDocuments !== undefined &&
          !validCompleteDocuments(parsed.signedOutDocuments)) ||
        (parsed.signedOutPreferences !== undefined &&
          !validPreferences(parsed.signedOutPreferences))
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
      const preferencesRequireReconciliation =
        !isObject(parsed.syncedPreferences) ||
        !validPreferences(parsed.syncedLocalPreferences);
      const requiresMigration =
        !validDocuments(parsed.syncedDocuments) ||
        !validDocuments(parsed.syncedLocalDocuments) ||
        !validPending(parsed.pending);
      return {
        ...emptyState(),
        initialized: parsed.initialized === true,
        // v1 had neither raw baselines nor field intent. Do not replay its
        // stale full bodies: retain the local snapshot and ask at first sync.
        needsReconciliation:
          parsed.needsReconciliation === true ||
          (parsed.initialized === true &&
            (requiresMigration || preferencesRequireReconciliation)),
        syncedDocuments: validDocuments(parsed.syncedDocuments)
          ? parsed.syncedDocuments
          : {},
        syncedLocalDocuments: validDocuments(parsed.syncedLocalDocuments)
          ? parsed.syncedLocalDocuments
          : {},
        etags: isObject(parsed.etags)
          ? Object.fromEntries(
              Object.entries(parsed.etags).filter(
                ([key, etag]) =>
                  DOCUMENT_KEYS.includes(key as SettingsDocumentKey) &&
                  typeof etag === 'string',
              ),
            )
          : {},
        readOnlyDocuments: isObject(parsed.readOnlyDocuments)
          ? Object.fromEntries(
              Object.entries(parsed.readOnlyDocuments).filter(
                ([key, flag]) =>
                  DOCUMENT_KEYS.includes(key as SettingsDocumentKey) &&
                  typeof flag === 'boolean',
              ),
            )
          : {},
        pending:
          !requiresMigration && validPending(parsed.pending)
            ? parsed.pending
            : {},
        localDocuments: validDocuments(parsed.localDocuments)
          ? parsed.localDocuments
          : {},
        preferencePending: validPreferences(parsed.preferencePending)
          ? parsed.preferencePending
          : null,
        preferenceInFlight: validPreferences(parsed.preferenceInFlight)
          ? parsed.preferenceInFlight
          : null,
        syncedPreferences: isObject(parsed.syncedPreferences)
          ? parsed.syncedPreferences
          : {},
        syncedLocalPreferences: validPreferences(parsed.syncedLocalPreferences)
          ? parsed.syncedLocalPreferences
          : undefined,
        localPreferences: validPreferences(parsed.localPreferences)
          ? parsed.localPreferences
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

  async clear(accountId: string): Promise<void> {
    await AsyncStorage.removeItem(storageKey(accountId));
  }

  async save(
    accountId: string,
    state: PersistedSettingsSyncState,
  ): Promise<void> {
    await AsyncStorage.setItem(storageKey(accountId), JSON.stringify(state));
  }
}

export const qfSettingsStorage = new QfSettingsStorage();
