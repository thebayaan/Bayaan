import * as Crypto from 'expo-crypto';
import {
  BayaanSettingsApiClient,
  BayaanSettingsApiError,
  type PreferenceMutation,
  type RemoteSettingsDocument,
  type SettingsDocumentKey,
} from './bayaanSettingsApiClient';
import type {SettingsDocuments} from './qfSettingsSnapshot';
import {applySettingsChanges, settingsChanges} from './qfSettingsMerge';
import {
  qfSettingsStoreBridge,
  type QfSettingsStoreBridge,
} from './qfSettingsStoreBridge';
import {
  qfSettingsStorage,
  type PersistedSettingsDeviceContext,
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
  onSessionRevoked?: (accountId: string, sessionToken: string) => Promise<void>;
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
  add('quranReaderStyles', 'quranTextFontScale');
  add('quranReaderStyles', 'translationFontScale');
  add('quranReaderStyles', 'showTajweedRules');
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
  private localRevision = 0;
  private remoteAllowed = false;
  private remoteSessionToken: string | null = null;
  private backgroundBlocked = false;
  private generation = 0;
  private cancelChoice: (() => void) | null = null;

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
    this.cancelChoice?.();
    const departure = this.captureDeparture();
    const generation = ++this.generation;
    return this.exclusive(async () => {
      if (departure)
        await this.storage.save(departure.accountId, departure.state);
      if (generation !== this.generation) return;
      this.unsubscribe();
      this.remoteSessionToken = null;
      this.cancelRetry();
      await this.bridge.waitForHydration();
      const [state, storedDeviceContext] = await Promise.all([
        this.storage.load(accountId),
        this.storage.loadDeviceContext(),
      ]);
      if (generation !== this.generation) return;

      const deviceContext: PersistedSettingsDeviceContext =
        storedDeviceContext ?? {
          version: 1,
          ownerAccountId: accountId,
          baselineDocuments: this.bridge.captureDocuments(),
          baselinePreferences: this.bridge.capturePreferences(),
        };
      if (
        !departure &&
        deviceContext.signedOutDocuments &&
        deviceContext.signedOutPreferences
      ) {
        // Only changes since sign-out are guest intent. Do not copy the prior
        // account's unchanged settings into the account-neutral baseline.
        const current = this.bridge.captureDocuments();
        for (const key of DOCUMENT_KEYS) {
          deviceContext.baselineDocuments[key] = applySettingsChanges(
            deviceContext.baselineDocuments[key],
            settingsChanges(
              deviceContext.signedOutDocuments[key],
              current[key],
            ),
          );
        }
        deviceContext.baselinePreferences = remotePreferenceEntries(
          applySettingsChanges(
            preferencesRecord(deviceContext.baselinePreferences),
            settingsChanges(
              preferencesRecord(deviceContext.signedOutPreferences),
              preferencesRecord(this.bridge.capturePreferences()),
            ),
          ),
        );
      }
      delete deviceContext.signedOutDocuments;
      delete deviceContext.signedOutPreferences;
      if (
        storedDeviceContext &&
        storedDeviceContext.ownerAccountId !== accountId &&
        !state.initialized
      ) {
        // A new account must not inherit the previous account's values left in
        // the shared Zustand stores. Restore the device's pre-account baseline
        // before this account performs its first reconciliation.
        this.applyingRemote = true;
        try {
          await this.bridge.applyDocuments(
            deviceContext.baselineDocuments,
            () => generation === this.generation,
          );
          if (generation !== this.generation) return;
          this.bridge.applyPreferences(
            preferencesRecord(deviceContext.baselinePreferences),
          );
        } finally {
          this.applyingRemote = false;
        }
      }

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
          if (storedDeviceContext?.ownerAccountId === accountId) {
            // App upgrades/default migrations or a missed debounce are local
            // edits, not a first cloud reconciliation. Preserve leaf intent.
            await this.recordCurrent(accountId, generation);
          } else {
            // Re-entering a known account restores its own local snapshot;
            // another account's shared-store values are never its local edits.
            this.applyingRemote = true;
            try {
              await this.bridge.applyDocuments(state.localDocuments, () =>
                this.isCurrent(accountId, generation),
              );
              if (!this.isCurrent(accountId, generation)) return;
              this.bridge.applyPreferences(
                preferencesRecord(state.localPreferences),
              );
            } finally {
              this.applyingRemote = false;
            }
          }
        }
      }
      if (generation !== this.generation) return;
      deviceContext.ownerAccountId = accountId;
      await this.storage.saveDeviceContext(deviceContext);
      if (generation !== this.generation) return;
      this.subscribe();
    });
  }

  // Capture synchronously while the old account still owns the shared stores.
  // Persistence is serialized, but must not recapture a later account's values.
  private captureDeparture(): {
    accountId: string;
    state: PersistedSettingsSyncState;
  } | null {
    const accountId = this.accountId;
    if (!accountId || !this.state) return null;
    this.captureCurrent();
    this.unsubscribe();
    return {accountId, state: JSON.parse(JSON.stringify(this.state))};
  }

  deactivate(clearAccount = false): Promise<void> {
    this.cancelChoice?.();
    const departure = this.captureDeparture();
    const generation = ++this.generation;
    this.remoteAllowed = false;
    this.remoteSessionToken = null;
    this.cancelRetry();
    this.accountId = null;
    return this.exclusive(async () => {
      if (departure) {
        await this.storage.save(departure.accountId, departure.state);
        if (clearAccount) await this.storage.clear(departure.accountId);
        const context = await this.storage.loadDeviceContext();
        if (context) {
          await this.storage.saveDeviceContext({
            ...context,
            signedOutDocuments: departure.state
              .localDocuments as SettingsDocuments,
            signedOutPreferences: departure.state.localPreferences,
          });
        }
      }
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
      this.backgroundBlocked = false;
      await this.options.api.assertConfiguration(sessionToken);
      const state = this.state;
      if (!this.isCurrent(accountId, generation) || !state) return;
      if (!state.initialized || state.needsReconciliation) {
        await this.firstSync(accountId, sessionToken, generation);
      } else {
        await this.recordCurrent(accountId, generation);
        await this.flush(accountId, sessionToken, generation);
        // Capture edits made while uploads were in flight before a pull can
        // apply an older server snapshot over the live stores.
        await this.recordCurrent(accountId, generation);
        await this.pullCurrent(accountId, sessionToken, generation);
      }
      if (!this.isCurrent(accountId, generation)) return;
      await this.recordCurrent(accountId, generation);
      await this.flush(accountId, sessionToken, generation);
      this.retryAttempts = 0;
      this.cancelRetry();
    }).catch(error => {
      if (
        this.isCurrent(accountId, generation) &&
        error instanceof BayaanSettingsApiError &&
        error.status >= 400 &&
        error.status < 500 &&
        ![408, 412, 429].includes(error.status)
      ) {
        this.backgroundBlocked = true;
        this.cancelRetry();
      }
      throw error; // Direct run's lifecycle owns its revocation/error handling.
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
    this.unsubscribers = this.bridge.subscribe(() => {
      if (this.applyingRemote) return;
      this.localRevision += 1;
      this.scheduleCapture();
    });
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
      const sessionToken = this.remoteSessionToken;
      this.exclusive(async () => {
        if (!this.isCurrent(accountId, generation)) return;
        await this.recordCurrent(accountId, generation);
        if (
          this.remoteAllowed &&
          !this.backgroundBlocked &&
          sessionToken &&
          sessionToken === this.remoteSessionToken &&
          this.state?.initialized &&
          !this.state.needsReconciliation &&
          this.accountId === accountId
        ) {
          await this.flush(accountId, sessionToken, generation);
        }
      })
        .then(() => {
          this.retryAttempts = 0;
        })
        .catch(error =>
          this.handleBackgroundError(
            accountId,
            generation,
            sessionToken,
            error,
          ),
        );
    }, this.debounceMs);
  }

  private async handleBackgroundError(
    accountId: string,
    generation: number,
    sessionToken: string | null,
    error: unknown,
  ): Promise<void> {
    if (!this.isCurrent(accountId, generation)) return;
    if (error instanceof BayaanSettingsApiError && error.status === 401) {
      if (!sessionToken || sessionToken !== this.remoteSessionToken) return;
      this.remoteAllowed = false;
      this.remoteSessionToken = null;
      this.cancelRetry();
      // This path owns its debounce/retry promise, not a lifecycle run. Route
      // revocation to the same token-bound auth handler, even on cleanup error.
      await this.options
        .onSessionRevoked?.(accountId, sessionToken)
        .catch(() => undefined);
      return;
    }
    if (
      error instanceof BayaanSettingsApiError &&
      error.status >= 400 &&
      error.status < 500 &&
      ![408, 412, 429].includes(error.status)
    ) {
      this.backgroundBlocked = true;
      this.cancelRetry();
    }
    this.scheduleRetry(accountId, generation, error);
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
      error.status === 408 ||
      error.status === 429 ||
      error.status === 412 ||
      error.status >= 500;
    if (
      !retryable ||
      this.retryTimer ||
      !this.remoteAllowed ||
      this.backgroundBlocked ||
      !this.remoteSessionToken ||
      !this.state?.initialized ||
      this.state.needsReconciliation ||
      !this.isCurrent(accountId, generation)
    ) {
      return;
    }
    const exponentialDelay = 1_000 * 2 ** this.retryAttempts;
    const providerDelay =
      error instanceof BayaanSettingsApiError ? (error.retryAfterMs ?? 0) : 0;
    const delay = Math.max(
      Math.min(exponentialDelay, MAX_RETRY_MS),
      providerDelay,
    );
    this.retryAttempts += 1;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      const token = this.remoteSessionToken;
      if (
        !token ||
        !this.remoteAllowed ||
        this.backgroundBlocked ||
        !this.state?.initialized ||
        this.state.needsReconciliation ||
        !this.isCurrent(accountId, generation)
      )
        return;
      this.exclusive(() => this.flush(accountId, token, generation))
        .then(() => {
          this.retryAttempts = 0;
        })
        .catch(nextError =>
          this.handleBackgroundError(accountId, generation, token, nextError),
        );
    }, delay);
  }

  private async recordCurrent(
    accountId: string,
    generation = this.generation,
  ): Promise<void> {
    if (!this.isCurrent(accountId, generation) || !this.state) return;
    if (this.captureCurrent()) await this.storage.save(accountId, this.state);
  }

  // Synchronous by design: callers applying a remote snapshot must capture
  // again after their final persistence await, without yielding before apply.
  private captureCurrent(): boolean {
    if (!this.state) return false;
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
      this.queueDocument(key, documents[key]);
      changed = true;
    }
    const fingerprint = preferenceFingerprint(preferences);
    if (fingerprint !== this.state.localPreferenceFingerprint) {
      this.state.localPreferences = preferences;
      this.state.localPreferenceFingerprint = fingerprint;
      this.state.preferencePending = preferences;
      changed = true;
    }
    return changed;
  }

  private projectDocument(
    key: SettingsDocumentKey,
    raw: Record<string, unknown>,
    fallback: Record<string, unknown>,
  ): Record<string, unknown> {
    // Replace understood top-level values, including whole maps and empty
    // maps. Omitted/unprojectable values retain their device fallback; raw
    // unknown fields remain exclusively in syncedDocuments.
    return {...fallback, ...this.bridge.sanitizeDocument(key, raw)};
  }

  private queueDocument(
    key: SettingsDocumentKey,
    local: Record<string, unknown>,
  ): void {
    const state = this.state!;
    // An ambiguous delivery must be replayed byte-for-byte before the newer
    // device snapshot can become a separate mutation.
    if (state.pending[key]?.attempted) return;
    const changes = settingsChanges(
      state.syncedLocalDocuments[key] ?? {},
      local,
    );
    if (!changes.length) {
      delete state.pending[key];
      return;
    }
    state.pending[key] = {
      changes,
      localSnapshot: local,
      body: JSON.stringify({
        value: applySettingsChanges(state.syncedDocuments[key] ?? {}, changes),
        schemaVersion: 1,
      }),
      idempotencyKey: Crypto.randomUUID(),
      ...(state.etags[key] ? {etag: state.etags[key]} : {}),
    };
  }

  private async fetchRemote(sessionToken: string): Promise<{
    documents: Partial<Record<SettingsDocumentKey, RemoteSettingsDocument>>;
    preferences: Record<string, unknown>;
    failedDocuments: Set<SettingsDocumentKey>;
    preferencesFailed: boolean;
    errors: unknown[];
  }> {
    const [preferenceResults, documentResults] = await Promise.all([
      Promise.allSettled([this.options.api.getPreferences(sessionToken)]),
      Promise.allSettled(
        DOCUMENT_KEYS.map(key =>
          this.options.api.getDocument(sessionToken, key),
        ),
      ),
    ]);
    const byKey: Partial<Record<SettingsDocumentKey, RemoteSettingsDocument>> =
      {};
    const failedDocuments = new Set<SettingsDocumentKey>();
    const errors: unknown[] = [];
    documentResults.forEach((result, index) => {
      if (result.status === 'rejected') {
        failedDocuments.add(DOCUMENT_KEYS[index]);
        errors.push(result.reason);
      } else if (result.value) {
        byKey[result.value.key] = result.value;
      }
    });
    const preferenceResult = preferenceResults[0];
    const preferencesFailed = preferenceResult.status === 'rejected';
    if (preferenceResult.status === 'rejected') {
      errors.push(preferenceResult.reason);
    }
    // Revocation is account-wide, never a per-document failure to bypass.
    const revoked = errors.find(
      error => error instanceof BayaanSettingsApiError && error.status === 401,
    );
    if (revoked) throw revoked;
    return {
      documents: byKey,
      preferences:
        preferenceResult.status === 'fulfilled' ? preferenceResult.value : {},
      failedDocuments,
      preferencesFailed,
      errors,
    };
  }

  private async chooseConflict(): Promise<ConflictChoice | null> {
    let cancel!: () => void;
    const cancelled = new Promise<null>(resolve => {
      cancel = () => resolve(null);
    });
    this.cancelChoice = cancel;
    try {
      return await Promise.race([
        this.options.chooseFirstSyncConflict(),
        cancelled,
      ]);
    } finally {
      if (this.cancelChoice === cancel) this.cancelChoice = null;
    }
  }

  private async firstSync(
    accountId: string,
    sessionToken: string,
    generation: number,
  ): Promise<void> {
    if (!this.isCurrent(accountId, generation)) return;
    let localDocuments = this.bridge.captureDocuments();
    let localPreferences = this.bridge.capturePreferences();
    const revision = this.localRevision;
    const remote = await this.fetchRemote(sessionToken);
    const state = this.state;
    if (!this.isCurrent(accountId, generation) || !state) return;
    // Never establish first-sync baselines or replace pending intent from an
    // incomplete read. A retry must still reconcile the unavailable keys.
    if (remote.errors.length) throw remote.errors[0];
    if (revision !== this.localRevision) {
      localDocuments = this.bridge.captureDocuments();
      localPreferences = this.bridge.capturePreferences();
    }
    const remoteDocuments: Partial<SettingsDocuments> = {};
    let conflict = hasPreferenceConflict(localPreferences, remote.preferences);
    for (const key of DOCUMENT_KEYS) {
      const document = remote.documents[key];
      if (!document) continue;
      const sanitized = this.bridge.sanitizeDocument(key, document.value);
      remoteDocuments[key] = sanitized;
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
    const decisionRevision = this.localRevision;
    let choice: ConflictChoice | null =
      hasRemote && conflict
        ? await this.chooseConflict()
        : hasRemote
          ? 'cloud'
          : 'local';
    if (!choice || !this.isCurrent(accountId, generation)) return;
    if (decisionRevision !== this.localRevision) {
      // A setting changed while the conflict UI was open. Preserve that newer
      // device edit rather than applying the older fetched snapshot over it.
      localDocuments = this.bridge.captureDocuments();
      localPreferences = this.bridge.capturePreferences();
      choice = 'local';
    }

    if (choice === 'cloud') {
      this.applyingRemote = true;
      let applied: SettingsDocuments | void;
      const preferencesBefore = this.bridge.capturePreferences();
      try {
        applied = await this.bridge.applyDocuments(remoteDocuments, () =>
          this.isCurrent(accountId, generation),
        );
        if (!this.isCurrent(accountId, generation)) return;
        this.bridge.applyPreferences(
          applySettingsChanges(
            remote.preferences,
            settingsChanges(
              preferencesRecord(preferencesBefore),
              preferencesRecord(this.bridge.capturePreferences()),
            ),
          ),
        );
      } catch (error) {
        this.applyingRemote = false;
        this.scheduleCapture();
        throw error;
      } finally {
        this.applyingRemote = false;
      }
      this.establishRemoteBaselines(state, remote.documents);
      const mergedDocuments = this.bridge.captureDocuments();
      const appliedDocuments = applied ?? mergedDocuments;
      const mergedPreferences = this.bridge.capturePreferences();
      state.localDocuments = mergedDocuments;
      for (const key of DOCUMENT_KEYS) {
        const raw = remote.documents[key]?.value ?? {};
        // Present-but-unsupported remote values are NOT missing fields. Use
        // their actual device fallback as baseline so only a later user edit
        // replaces the opaque raw value. Truly absent keys can still be added.
        state.syncedLocalDocuments[key] = Object.fromEntries(
          Object.entries(appliedDocuments[key]).filter(([field]) =>
            Object.hasOwn(raw, field),
          ),
        );
        this.queueDocument(key, mergedDocuments[key]);
      }
      state.localPreferences = mergedPreferences;
      state.localPreferenceFingerprint =
        preferenceFingerprint(mergedPreferences);
      state.preferencePending = mergedPreferences;
    } else {
      this.establishRemoteBaselines(state, remote.documents);
      state.localDocuments = localDocuments;
      for (const key of DOCUMENT_KEYS) {
        this.queueDocument(key, localDocuments[key]);
      }
      state.localPreferences = localPreferences;
      state.localPreferenceFingerprint =
        preferenceFingerprint(localPreferences);
      state.preferencePending = localPreferences;
    }
    state.initialized = true;
    state.needsReconciliation = false;
    await this.storage.save(accountId, state);
    await this.flush(accountId, sessionToken, generation);
  }

  private establishRemoteBaselines(
    state: PersistedSettingsSyncState,
    documents: Partial<Record<SettingsDocumentKey, RemoteSettingsDocument>>,
  ): void {
    // Commit reconciliation evidence only after the chosen application has
    // succeeded, never after a failed cache load or an obsolete account await.
    state.pending = {};
    state.readOnlyDocuments ??= {};
    for (const key of DOCUMENT_KEYS) {
      const document = documents[key];
      state.readOnlyDocuments[key] = document?.readOnly === true;
      state.syncedDocuments[key] = document?.value ?? {};
      state.syncedLocalDocuments[key] = document
        ? this.bridge.sanitizeDocument(key, document.value)
        : {};
      if (document) state.etags[key] = document.etag;
      else delete state.etags[key];
    }
  }

  private async flush(
    accountId: string,
    sessionToken: string,
    generation: number,
  ): Promise<void> {
    const state = this.state;
    // Legacy baselines and ETags cannot authorize delivery. Only a successful
    // syncRemote/firstSync decision can clear the reconciliation barrier.
    if (
      !this.isCurrent(accountId, generation) ||
      !state?.initialized ||
      state.needsReconciliation
    )
      return;
    for (const key of DOCUMENT_KEYS) {
      if (!this.isCurrent(accountId, generation)) return;
      let pending = state.pending[key];
      if (!pending || state.readOnlyDocuments?.[key]) continue;
      const localAtSend = pending.localSnapshot;
      const previouslyAttempted = pending.attempted === true;
      pending.attempted = true;
      await this.storage.save(accountId, state);
      if (!this.isCurrent(accountId, generation)) return;
      let etag: string;
      try {
        etag = await this.options.api.putDocument(sessionToken, {
          key,
          ...pending,
        });
      } catch (error) {
        if (
          !(error instanceof BayaanSettingsApiError) ||
          error.status !== 412
        ) {
          if (
            error instanceof BayaanSettingsApiError &&
            error.status >= 400 &&
            error.status < 500 &&
            ![408, 429].includes(error.status) &&
            !previouslyAttempted
          ) {
            // A first-attempt rejection is definitive. A rejection on replay
            // does not prove earlier ambiguous bytes never landed, so keep
            // their immutable evidence until receipt/precondition recovery.
            pending.attempted = false;
            await this.storage.save(accountId, state);
          }
          throw error;
        }
        const remote = await this.options.api.getDocument(sessionToken, key);
        if (!this.isCurrent(accountId, generation)) return;
        if (remote?.readOnly) {
          // The old request was rejected, not ambiguously delivered. Retain
          // local leaf intent, but never PUT a v1 downgrade of a future schema.
          state.readOnlyDocuments ??= {};
          state.readOnlyDocuments[key] = true;
          state.syncedDocuments[key] = remote.value;
          state.etags[key] = remote.etag;
          state.pending[key] = {...pending, attempted: false};
          await this.storage.save(accountId, state);
          continue;
        }
        // A 412 definitively rejected the old bytes. Only its local leaf intent
        // can be rebased, never the stale complete-document body.
        pending = {
          changes: pending.changes,
          localSnapshot: pending.localSnapshot,
          attempted: true,
          body: JSON.stringify({
            value: applySettingsChanges(remote?.value ?? {}, pending.changes),
            schemaVersion: 1,
          }),
          idempotencyKey: Crypto.randomUUID(),
          ...(remote ? {etag: remote.etag} : {}),
        };
        state.pending[key] = pending;
        state.syncedDocuments[key] = remote?.value ?? {};
        if (remote) state.etags[key] = remote.etag;
        else delete state.etags[key];
        await this.storage.save(accountId, state);
        if (!this.isCurrent(accountId, generation)) return;
        etag = await this.options.api.putDocument(sessionToken, {
          key,
          ...pending,
        });
      }
      if (!this.isCurrent(accountId, generation)) return;
      const uploaded = JSON.parse(pending.body).value as Record<
        string,
        unknown
      >;
      const newer = settingsChanges(
        localAtSend,
        this.bridge.captureDocuments()[key],
      );
      this.applyingRemote = true;
      let baseline: Record<string, unknown>;
      try {
        const applied = await this.bridge.applyDocuments(
          {[key]: this.projectDocument(key, uploaded, localAtSend)},
          () => this.isCurrent(accountId, generation),
        );
        if (!this.isCurrent(accountId, generation)) return;
        baseline = (applied ?? this.bridge.captureDocuments())[key];
        const duringApply = settingsChanges(
          baseline,
          this.bridge.captureDocuments()[key],
        );
        await this.bridge.applyDocuments(
          {
            [key]: applySettingsChanges(
              applySettingsChanges(baseline, newer),
              duringApply,
            ),
          },
          () => this.isCurrent(accountId, generation),
        );
        if (!this.isCurrent(accountId, generation)) return;
      } catch (error) {
        this.applyingRemote = false;
        this.scheduleCapture();
        throw error;
      } finally {
        this.applyingRemote = false;
      }
      state.etags[key] = etag;
      state.syncedDocuments[key] = uploaded;
      state.syncedLocalDocuments[key] = baseline;
      delete state.pending[key];
      state.localDocuments[key] = this.bridge.captureDocuments()[key];
      this.queueDocument(key, state.localDocuments[key]!);
      // A muted await may also contain edits to other documents. Capture them
      // before processing the next key, not after a stale projection replaces it.
      this.captureCurrent();
      await this.storage.save(accountId, state);
      if (state.pending[key]) this.scheduleCapture();
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
    // Capture edits made during the fetch before applying any remote values.
    await this.recordCurrent(accountId, generation);
    if (!this.isCurrent(accountId, generation)) return;
    // save() can yield while the UI changes again. Recompute intent now and
    // do not await between this capture and the remote application below.
    this.captureCurrent();
    this.applyingRemote = true;
    try {
      for (const key of DOCUMENT_KEYS) {
        // A failed read is not a missing document. Keep its raw baseline,
        // ETag, read-only status and pending local intent unchanged.
        if (remote.failedDocuments.has(key)) continue;
        const document = remote.documents[key];
        const changes = state.pending[key]?.changes ?? [];
        const projected = this.projectDocument(
          key,
          document?.value ?? {},
          state.syncedLocalDocuments[key] ??
            this.bridge.captureDocuments()[key],
        );
        const projection = await this.bridge.applyDocuments(
          {[key]: projected},
          () => this.isCurrent(accountId, generation),
        );
        if (!this.isCurrent(accountId, generation)) return;
        // Missing remote fields are supplied locally on first creation only;
        // existing unknown/unsupported remote values are not rewritten.
        const applied = (projection ?? this.bridge.captureDocuments())[key];
        const duringApply = settingsChanges(
          applied,
          this.bridge.captureDocuments()[key],
        );
        await this.bridge.applyDocuments(
          {
            [key]: applySettingsChanges(
              applySettingsChanges(applied, changes),
              duringApply,
            ),
          },
          () => this.isCurrent(accountId, generation),
        );
        if (!this.isCurrent(accountId, generation)) return;
        state.readOnlyDocuments ??= {};
        state.readOnlyDocuments[key] = document?.readOnly === true;
        state.syncedDocuments[key] = document?.value ?? {};
        if (document) state.etags[key] = document.etag;
        else delete state.etags[key];
        state.syncedLocalDocuments[key] = document ? applied : {};
        const local = this.bridge.captureDocuments()[key];
        this.queueDocument(key, local);
        this.captureCurrent();
      }
      if (!remote.preferencesFailed && !state.preferencePending) {
        this.bridge.applyPreferences(remote.preferences);
      }
    } catch (error) {
      this.applyingRemote = false;
      this.scheduleCapture();
      throw error;
    } finally {
      this.applyingRemote = false;
    }
    state.localDocuments = this.bridge.captureDocuments();
    const preferences = this.bridge.capturePreferences();
    const fingerprint = preferenceFingerprint(preferences);
    state.localPreferences = preferences;
    state.localPreferenceFingerprint = fingerprint;
    if (!remote.preferencesFailed) {
      if (
        remotePreferenceEntries(remote.preferences).length < preferences.length
      ) {
        state.preferencePending = preferences;
      } else {
        state.syncedPreferenceFingerprint = fingerprint;
      }
    }
    await this.storage.save(accountId, state);
    // Healthy documents progress, but the lifecycle still sees the failure
    // and owns bounded retry/revocation rather than reporting false success.
    if (remote.errors.length) throw remote.errors[0];
  }
}
