import * as Crypto from 'expo-crypto';
import {
  BayaanSettingsApiClient,
  BayaanSettingsApiError,
  type PreferenceMutation,
  type RemoteSettingsDocument,
  type SettingsDocumentKey,
} from './bayaanSettingsApiClient';
import type {SettingsDocuments} from './qfSettingsSnapshot';
import {
  qfSettingsStoreBridge,
  type QfSettingsStoreBridge,
} from './qfSettingsStoreBridge';
import {
  qfSettingsStorage,
  type PersistedSettingsSyncState,
  type QfSettingsStorage,
} from './qfSettingsStorage';

const DOCUMENT_KEYS: SettingsDocumentKey[] = [
  'appearance',
  'mushaf',
  'audio',
  'adhkar',
  'browsing',
];
const CAPTURE_DEBOUNCE_MS = 350;
const MAX_RETRY_MS = 60_000;

type ConflictChoice = 'local' | 'cloud';

interface CoordinatorOptions {
  api: BayaanSettingsApiClient;
  storage?: QfSettingsStorage;
  bridge?: QfSettingsStoreBridge;
  chooseFirstSyncConflict: () => Promise<ConflictChoice>;
  debounceMs?: number;
}

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, canonicalValue(item)]),
  );
}

function documentFingerprint(value: Record<string, unknown>): string {
  return JSON.stringify(canonicalValue(value));
}

function preferenceFingerprint(value: PreferenceMutation[]): string {
  return JSON.stringify(value);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function remotePreferenceEntries(
  preferences: Record<string, unknown>,
): PreferenceMutation[] {
  const entries: PreferenceMutation[] = [];
  const add = (group: string, key: string) => {
    const groupValue = preferences[group];
    if (isObject(groupValue) && key in groupValue) {
      entries.push({group, key, value: groupValue[key]});
    }
  };
  add('theme', 'type');
  add('quranReaderStyles', 'quranTextFontScale');
  add('quranReaderStyles', 'translationFontScale');
  add('quranReaderStyles', 'showTajweedRules');
  add('reading', 'selectedReadingTranslation');
  add('tafsirs', 'selectedTafsirs');
  add('audio', 'playbackRate');
  return entries;
}

function preferencesRecord(
  preferences: PreferenceMutation[],
): Record<string, unknown> {
  const result: Record<string, Record<string, unknown>> = {};
  for (const preference of preferences) {
    result[preference.group] = {
      ...(result[preference.group] ?? {}),
      [preference.key]: preference.value,
    };
  }
  return result;
}

function documentsDiffer(
  left: SettingsDocuments,
  right: Partial<SettingsDocuments>,
): boolean {
  return DOCUMENT_KEYS.some(
    key =>
      documentFingerprint(left[key]) !== documentFingerprint(right[key] ?? {}),
  );
}

function hasPreferenceConflict(
  local: PreferenceMutation[],
  remote: Record<string, unknown>,
): boolean {
  const localByKey = new Map(
    local.map(item => [`${item.group}.${item.key}`, item.value]),
  );
  return remotePreferenceEntries(remote).some(
    item =>
      JSON.stringify(localByKey.get(`${item.group}.${item.key}`)) !==
      JSON.stringify(item.value),
  );
}

export class QfSettingsSyncCoordinator {
  private readonly storage: QfSettingsStorage;
  private readonly bridge: QfSettingsStoreBridge;
  private readonly debounceMs: number;
  private accountId: string | null = null;
  private state: PersistedSettingsSyncState | null = null;
  private unsubscribers: Array<() => void> = [];
  private captureTimer: ReturnType<typeof setTimeout> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private retryAttempts = 0;
  private operation: Promise<unknown> = Promise.resolve();
  private applyingRemote = false;
  private remoteAllowed = false;
  private remoteSessionToken: string | null = null;
  private generation = 0;

  constructor(private readonly options: CoordinatorOptions) {
    this.storage = options.storage ?? qfSettingsStorage;
    this.bridge = options.bridge ?? qfSettingsStoreBridge;
    this.debounceMs = options.debounceMs ?? CAPTURE_DEBOUNCE_MS;
  }

  private exclusive<T>(task: () => Promise<T>): Promise<T> {
    const result = this.operation.then(task, task);
    this.operation = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  setRemoteAvailable(available: boolean): void {
    this.remoteAllowed = available;
    if (!available) this.cancelRetry();
  }

  activateLocal(accountId: string): Promise<void> {
    if (this.accountId === accountId && this.state) return Promise.resolve();
    const generation = ++this.generation;
    return this.exclusive(async () => {
      if (generation !== this.generation) return;
      this.unsubscribe();
      this.remoteSessionToken = null;
      this.cancelRetry();
      await this.bridge.waitForHydration();
      const state = await this.storage.load(accountId);
      if (generation !== this.generation) return;
      this.accountId = accountId;
      this.state = state;
      if (state.initialized && Object.keys(state.localDocuments).length > 0) {
        const deviceDocuments = this.bridge.captureDocuments();
        const devicePreferences = this.bridge.capturePreferences();
        const deviceDiffers =
          documentsDiffer(deviceDocuments, state.localDocuments) ||
          preferenceFingerprint(devicePreferences) !==
            state.localPreferenceFingerprint;
        if (deviceDiffers) {
          const choice = await this.options.chooseFirstSyncConflict();
          if (generation !== this.generation) return;
          if (choice === 'cloud') {
            this.applyingRemote = true;
            try {
              this.bridge.applyDocuments(state.localDocuments);
              this.bridge.applyPreferences(
                preferencesRecord(state.localPreferences),
              );
            } finally {
              this.applyingRemote = false;
            }
            state.localDocuments = this.bridge.captureDocuments();
            state.localPreferences = this.bridge.capturePreferences();
            state.localPreferenceFingerprint = preferenceFingerprint(
              state.localPreferences,
            );
          } else {
            state.localDocuments = deviceDocuments;
            state.localPreferences = devicePreferences;
            state.localPreferenceFingerprint =
              preferenceFingerprint(devicePreferences);
            state.preferencePending = devicePreferences;
            for (const key of DOCUMENT_KEYS) {
              state.pending[key] = {
                body: JSON.stringify({
                  value: deviceDocuments[key],
                  schemaVersion: 1,
                }),
                idempotencyKey: Crypto.randomUUID(),
                ...(state.etags[key] ? {etag: state.etags[key]} : {}),
              };
            }
          }
          await this.storage.save(accountId, state);
        }
      }
      this.subscribe();
    });
  }

  deactivate(): Promise<void> {
    const generation = ++this.generation;
    this.remoteAllowed = false;
    this.remoteSessionToken = null;
    this.cancelRetry();
    this.accountId = null;
    return this.exclusive(async () => {
      if (generation !== this.generation) return;
      this.unsubscribe();
      this.state = null;
    });
  }

  syncRemote(accountId: string, sessionToken: string): Promise<void> {
    const generation = this.generation;
    return this.exclusive(async () => {
      if (!this.isCurrent(accountId, generation)) return;
      this.remoteSessionToken = sessionToken;
      await this.options.api.assertConfiguration(sessionToken);
      const state = this.state;
      if (!this.isCurrent(accountId, generation) || !state) return;
      if (!state.initialized) {
        await this.firstSync(accountId, sessionToken, generation);
      } else {
        await this.recordCurrent(accountId);
        await this.flush(accountId, sessionToken, generation);
        await this.pullCurrent(accountId, sessionToken, generation);
      }
      if (!this.isCurrent(accountId, generation)) return;
      await this.recordCurrent(accountId);
      await this.flush(accountId, sessionToken, generation);
      this.retryAttempts = 0;
      this.cancelRetry();
    });
  }

  waitForIdle(): Promise<unknown> {
    return this.operation;
  }

  private isCurrent(accountId: string, generation: number): boolean {
    return (
      generation === this.generation &&
      this.accountId === accountId &&
      this.state !== null
    );
  }

  private subscribe(): void {
    this.unsubscribers = this.bridge.subscribe(() => this.scheduleCapture());
  }

  private unsubscribe(): void {
    this.unsubscribers.forEach(unsubscribe => unsubscribe());
    this.unsubscribers = [];
    if (this.captureTimer) clearTimeout(this.captureTimer);
    this.captureTimer = null;
  }

  private scheduleCapture(): void {
    if (this.applyingRemote || !this.accountId) return;
    if (this.captureTimer) clearTimeout(this.captureTimer);
    this.captureTimer = setTimeout(() => {
      this.captureTimer = null;
      const accountId = this.accountId;
      const generation = this.generation;
      if (!accountId) return;
      this.exclusive(async () => {
        await this.recordCurrent(accountId);
        if (
          this.remoteAllowed &&
          this.remoteSessionToken &&
          this.state?.initialized &&
          this.accountId === accountId
        ) {
          await this.flush(accountId, this.remoteSessionToken, generation);
        }
      })
        .then(() => {
          this.retryAttempts = 0;
        })
        .catch(error => this.scheduleRetry(accountId, generation, error));
    }, this.debounceMs);
  }

  private cancelRetry(): void {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
  }

  private scheduleRetry(
    accountId: string,
    generation: number,
    error: unknown,
  ): void {
    const retryable =
      !(error instanceof BayaanSettingsApiError) ||
      error.status === 0 ||
      error.status === 429 ||
      error.status >= 500;
    if (
      !retryable ||
      this.retryTimer ||
      !this.remoteAllowed ||
      !this.remoteSessionToken ||
      !this.isCurrent(accountId, generation)
    ) {
      return;
    }
    const exponentialDelay = 1_000 * 2 ** this.retryAttempts;
    const providerDelay =
      error instanceof BayaanSettingsApiError ? (error.retryAfterMs ?? 0) : 0;
    const delay = Math.min(
      Math.max(exponentialDelay, providerDelay),
      MAX_RETRY_MS,
    );
    this.retryAttempts += 1;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      const token = this.remoteSessionToken;
      if (
        !token ||
        !this.remoteAllowed ||
        !this.isCurrent(accountId, generation)
      )
        return;
      this.exclusive(() => this.flush(accountId, token, generation))
        .then(() => {
          this.retryAttempts = 0;
        })
        .catch(nextError =>
          this.scheduleRetry(accountId, generation, nextError),
        );
    }, delay);
  }

  private async recordCurrent(accountId: string): Promise<void> {
    if (this.accountId !== accountId || !this.state) return;
    const documents = this.bridge.captureDocuments();
    const preferences = this.bridge.capturePreferences();
    let changed = false;
    for (const key of DOCUMENT_KEYS) {
      if (
        documentFingerprint(documents[key]) ===
        documentFingerprint(this.state.localDocuments[key] ?? {})
      )
        continue;
      this.state.localDocuments[key] = documents[key];
      this.state.pending[key] = {
        body: JSON.stringify({value: documents[key], schemaVersion: 1}),
        idempotencyKey: Crypto.randomUUID(),
        ...(this.state.etags[key] ? {etag: this.state.etags[key]} : {}),
      };
      changed = true;
    }
    const fingerprint = preferenceFingerprint(preferences);
    if (fingerprint !== this.state.localPreferenceFingerprint) {
      this.state.localPreferences = preferences;
      this.state.localPreferenceFingerprint = fingerprint;
      this.state.preferencePending = preferences;
      changed = true;
    }
    if (changed) await this.storage.save(accountId, this.state);
  }

  private async fetchRemote(sessionToken: string): Promise<{
    documents: Partial<Record<SettingsDocumentKey, RemoteSettingsDocument>>;
    preferences: Record<string, unknown>;
  }> {
    const [preferences, ...documents] = await Promise.all([
      this.options.api.getPreferences(sessionToken),
      ...DOCUMENT_KEYS.map(key =>
        this.options.api.getDocument(sessionToken, key),
      ),
    ]);
    const byKey: Partial<Record<SettingsDocumentKey, RemoteSettingsDocument>> =
      {};
    for (const document of documents) {
      if (document) byKey[document.key] = document;
    }
    return {documents: byKey, preferences};
  }

  private async firstSync(
    accountId: string,
    sessionToken: string,
    generation: number,
  ): Promise<void> {
    if (!this.isCurrent(accountId, generation)) return;
    const localDocuments = this.bridge.captureDocuments();
    const localPreferences = this.bridge.capturePreferences();
    const remote = await this.fetchRemote(sessionToken);
    const state = this.state;
    if (!this.isCurrent(accountId, generation) || !state) return;
    const remoteDocuments: Partial<SettingsDocuments> = {};
    let conflict = hasPreferenceConflict(localPreferences, remote.preferences);
    for (const key of DOCUMENT_KEYS) {
      const document = remote.documents[key];
      if (!document) continue;
      const sanitized = this.bridge.sanitizeDocument(key, document.value);
      remoteDocuments[key] = sanitized;
      state.etags[key] = document.etag;
      if (
        documentFingerprint(sanitized) !==
        documentFingerprint(localDocuments[key])
      ) {
        conflict = true;
      }
    }
    const hasRemote =
      Object.keys(remoteDocuments).length > 0 ||
      remotePreferenceEntries(remote.preferences).length > 0;
    const choice =
      hasRemote && conflict
        ? await this.options.chooseFirstSyncConflict()
        : hasRemote
          ? 'cloud'
          : 'local';
    if (!this.isCurrent(accountId, generation)) return;

    if (choice === 'cloud') {
      this.applyingRemote = true;
      try {
        this.bridge.applyDocuments(remoteDocuments);
        this.bridge.applyPreferences(remote.preferences);
      } finally {
        this.applyingRemote = false;
      }
      const mergedDocuments = this.bridge.captureDocuments();
      const mergedPreferences = this.bridge.capturePreferences();
      state.localDocuments = mergedDocuments;
      for (const key of DOCUMENT_KEYS) {
        const remoteDocument = remote.documents[key];
        const remoteValue = remoteDocuments[key];
        if (
          !remoteDocument ||
          documentFingerprint(remoteValue ?? {}) !==
            documentFingerprint(mergedDocuments[key])
        ) {
          state.pending[key] = {
            body: JSON.stringify({
              value: mergedDocuments[key],
              schemaVersion: 1,
            }),
            idempotencyKey: Crypto.randomUUID(),
            ...(remoteDocument ? {etag: remoteDocument.etag} : {}),
          };
        }
      }
      state.localPreferences = mergedPreferences;
      state.localPreferenceFingerprint =
        preferenceFingerprint(mergedPreferences);
      state.preferencePending = mergedPreferences;
    } else {
      state.localDocuments = localDocuments;
      for (const key of DOCUMENT_KEYS) {
        const remoteDocument = remote.documents[key];
        state.pending[key] = {
          body: JSON.stringify({value: localDocuments[key], schemaVersion: 1}),
          idempotencyKey: Crypto.randomUUID(),
          ...(remoteDocument ? {etag: remoteDocument.etag} : {}),
        };
      }
      state.localPreferences = localPreferences;
      state.localPreferenceFingerprint =
        preferenceFingerprint(localPreferences);
      state.preferencePending = localPreferences;
    }
    state.initialized = true;
    await this.storage.save(accountId, state);
    await this.flush(accountId, sessionToken, generation);
  }

  private async flush(
    accountId: string,
    sessionToken: string,
    generation: number,
  ): Promise<void> {
    const state = this.state;
    if (!this.isCurrent(accountId, generation) || !state) return;
    for (const key of DOCUMENT_KEYS) {
      if (!this.isCurrent(accountId, generation)) return;
      let pending = state.pending[key];
      if (!pending) continue;
      try {
        const etag = await this.options.api.putDocument(sessionToken, {
          key,
          ...pending,
        });
        if (!this.isCurrent(accountId, generation)) return;
        state.etags[key] = etag;
        delete state.pending[key];
        await this.storage.save(accountId, state);
      } catch (error) {
        if (!(error instanceof BayaanSettingsApiError) || error.status !== 412)
          throw error;
        const remote = await this.options.api.getDocument(sessionToken, key);
        if (!this.isCurrent(accountId, generation)) return;
        pending = {
          body: pending.body,
          idempotencyKey: Crypto.randomUUID(),
          ...(remote ? {etag: remote.etag} : {}),
        };
        state.pending[key] = pending;
        if (remote) state.etags[key] = remote.etag;
        else delete state.etags[key];
        await this.storage.save(accountId, state);
        if (!this.isCurrent(accountId, generation)) return;
        const etag = await this.options.api.putDocument(sessionToken, {
          key,
          ...pending,
        });
        if (!this.isCurrent(accountId, generation)) return;
        state.etags[key] = etag;
        delete state.pending[key];
        await this.storage.save(accountId, state);
      }
    }
    if (!this.isCurrent(accountId, generation)) return;
    if (state.preferencePending) {
      const pending = state.preferencePending;
      await this.options.api.putPreferences(sessionToken, pending);
      if (!this.isCurrent(accountId, generation)) return;
      state.syncedPreferenceFingerprint = preferenceFingerprint(pending);
      state.preferencePending = null;
      await this.storage.save(accountId, state);
    }
  }

  private async pullCurrent(
    accountId: string,
    sessionToken: string,
    generation: number,
  ): Promise<void> {
    if (!this.isCurrent(accountId, generation)) return;
    const remote = await this.fetchRemote(sessionToken);
    const state = this.state;
    if (!this.isCurrent(accountId, generation) || !state) return;
    const documents: Partial<SettingsDocuments> = {};
    for (const key of DOCUMENT_KEYS) {
      if (state.pending[key]) continue;
      const document = remote.documents[key];
      if (document) {
        documents[key] = this.bridge.sanitizeDocument(key, document.value);
        state.etags[key] = document.etag;
      } else if (state.localDocuments[key]) {
        state.pending[key] = {
          body: JSON.stringify({
            value: state.localDocuments[key],
            schemaVersion: 1,
          }),
          idempotencyKey: Crypto.randomUUID(),
        };
        delete state.etags[key];
      }
    }
    this.applyingRemote = true;
    try {
      this.bridge.applyDocuments(documents);
      if (!state.preferencePending) {
        this.bridge.applyPreferences(remote.preferences);
      }
    } finally {
      this.applyingRemote = false;
    }
    const localDocuments = this.bridge.captureDocuments();
    state.localDocuments = localDocuments;
    for (const key of DOCUMENT_KEYS) {
      const remoteDocument = remote.documents[key];
      if (
        remoteDocument &&
        !state.pending[key] &&
        documentFingerprint(documents[key] ?? {}) !==
          documentFingerprint(localDocuments[key])
      ) {
        state.pending[key] = {
          body: JSON.stringify({
            value: localDocuments[key],
            schemaVersion: 1,
          }),
          idempotencyKey: Crypto.randomUUID(),
          etag: remoteDocument.etag,
        };
      }
    }
    const preferences = this.bridge.capturePreferences();
    const fingerprint = preferenceFingerprint(preferences);
    state.localPreferences = preferences;
    state.localPreferenceFingerprint = fingerprint;
    if (
      remotePreferenceEntries(remote.preferences).length < preferences.length
    ) {
      state.preferencePending = preferences;
    } else {
      state.syncedPreferenceFingerprint = fingerprint;
    }
    await this.storage.save(accountId, state);
  }
}
