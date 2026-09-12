jest.mock('expo-crypto', () => {
  let counter = 0;
  return {
    randomUUID: () =>
      `00000000-0000-4000-8000-${String(++counter).padStart(12, '0')}`,
  };
});

jest.mock('../qfSettingsStoreBridge', () => ({
  qfSettingsStoreBridge: {
    waitForHydration: async () => undefined,
    subscribe: () => [],
    captureDocuments: () => ({}),
    capturePreferences: () => [],
    applyDocuments: () => undefined,
    applyPreferences: () => undefined,
    sanitizeDocument: (_key: string, value: Record<string, unknown>) => value,
  },
}));

import {
  BayaanSettingsApiError,
  type PreferenceMutation,
  type RemoteSettingsDocument,
  type SettingsDocumentKey,
} from '../bayaanSettingsApiClient';
import type {QfSettingsStoreBridge} from '../qfSettingsStoreBridge';
import {QfSettingsSyncCoordinator} from '../qfSettingsSyncCoordinator';
import type {
  PersistedSettingsSyncState,
  QfSettingsStorage,
} from '../qfSettingsStorage';
import type {SettingsDocuments} from '../qfSettingsSnapshot';

const KEYS: SettingsDocumentKey[] = [
  'appearance',
  'mushaf',
  'audio',
  'adhkar',
  'browsing',
];

function documents(color = 'Blue'): SettingsDocuments {
  return {
    appearance: {primaryColor: color},
    mushaf: {showTranslation: true},
    audio: {shuffle: false},
    adhkar: {showTranslation: true},
    browsing: {browseViewMode: 'card'},
  };
}

function preferences(): PreferenceMutation[] {
  return [
    {
      group: 'quranReaderStyles',
      key: 'quranTextFontScale',
      value: 5,
    },
    {
      group: 'quranReaderStyles',
      key: 'translationFontScale',
      value: 3,
    },
    {
      group: 'quranReaderStyles',
      key: 'showTajweedRules',
      value: false,
    },
    {group: 'tafsirs', key: 'selectedTafsirs', value: ['169']},
    {group: 'audio', key: 'playbackRate', value: 1},
  ];
}

function emptyState(): PersistedSettingsSyncState {
  return {
    version: 1,
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

class MemoryStorage {
  states = new Map<string, PersistedSettingsSyncState>();

  async load(accountId: string): Promise<PersistedSettingsSyncState> {
    return structuredClone(this.states.get(accountId) ?? emptyState());
  }

  async save(
    accountId: string,
    state: PersistedSettingsSyncState,
  ): Promise<void> {
    this.states.set(accountId, structuredClone(state));
  }
}

class MemoryBridge implements QfSettingsStoreBridge {
  currentDocuments = documents();
  currentPreferences = preferences();
  listeners: Array<() => void> = [];

  async waitForHydration(): Promise<void> {
    return undefined;
  }

  subscribe(onChange: () => void): Array<() => void> {
    this.listeners.push(onChange);
    return [
      () => (this.listeners = this.listeners.filter(item => item !== onChange)),
    ];
  }

  captureDocuments(): SettingsDocuments {
    return structuredClone(this.currentDocuments);
  }

  capturePreferences(): PreferenceMutation[] {
    return structuredClone(this.currentPreferences);
  }

  applyDocuments(remote: Partial<SettingsDocuments>): void {
    for (const key of KEYS) {
      if (remote[key]) {
        this.currentDocuments[key] = {
          ...this.currentDocuments[key],
          ...remote[key],
        };
      }
    }
  }

  applyPreferences(): void {
    return undefined;
  }

  sanitizeDocument(
    _key: SettingsDocumentKey,
    value: Record<string, unknown>,
  ): Record<string, unknown> {
    return structuredClone(value);
  }

  changeDocument(
    key: SettingsDocumentKey,
    value: Record<string, unknown>,
  ): void {
    this.currentDocuments[key] = value;
    this.listeners.forEach(listener => listener());
  }
}

interface PutCall {
  key: SettingsDocumentKey;
  body: string;
  idempotencyKey: string;
  etag?: string;
}

function fakeApi(
  remote: Partial<Record<SettingsDocumentKey, RemoteSettingsDocument>> = {},
) {
  const puts: PutCall[] = [];
  const preferencePuts: PreferenceMutation[][] = [];
  return {
    puts,
    preferencePuts,
    assertConfiguration: jest.fn(async () => undefined),
    getPreferences: jest.fn(async () => ({})),
    putPreferences: jest.fn(
      async (_token: string, value: PreferenceMutation[]) => {
        preferencePuts.push(structuredClone(value));
      },
    ),
    getDocument: jest.fn(
      async (_token: string, key: SettingsDocumentKey) => remote[key] ?? null,
    ),
    putDocument: jest.fn(async (_token: string, input: PutCall) => {
      puts.push({...input});
      return `"etag-${input.key}-${puts.length}"`;
    }),
  };
}

function coordinator(
  api: ReturnType<typeof fakeApi>,
  storage: MemoryStorage,
  bridge: MemoryBridge,
  choice: 'local' | 'cloud' = 'local',
) {
  const choose = jest.fn(async () => choice);
  return {
    choose,
    value: new QfSettingsSyncCoordinator({
      api: api as never,
      storage: storage as unknown as QfSettingsStorage,
      bridge,
      chooseFirstSyncConflict: choose,
      debounceMs: 1,
    }),
  };
}

describe('QfSettingsSyncCoordinator', () => {
  test('uploads local settings with durable create-only mutations on an empty account', async () => {
    const api = fakeApi();
    const storage = new MemoryStorage();
    const bridge = new MemoryBridge();
    const subject = coordinator(api, storage, bridge);

    await subject.value.activateLocal('account-a');
    await subject.value.syncRemote('account-a', 'opaque-session');

    expect(subject.choose).not.toHaveBeenCalled();
    expect(api.puts.map(call => call.key)).toEqual(KEYS);
    expect(api.puts.every(call => call.etag === undefined)).toBe(true);
    expect(api.preferencePuts).toHaveLength(1);
    expect(storage.states.get('account-a')).toMatchObject({
      initialized: true,
      pending: {},
      preferencePending: null,
    });
  });

  test('asks once and uses ETags when the user keeps local settings', async () => {
    const api = fakeApi({
      appearance: {
        key: 'appearance',
        value: {primaryColor: 'Green'},
        etag: '"remote-appearance"',
      },
    });
    const storage = new MemoryStorage();
    const bridge = new MemoryBridge();
    const subject = coordinator(api, storage, bridge, 'local');

    await subject.value.activateLocal('account-a');
    await subject.value.syncRemote('account-a', 'opaque-session');

    expect(subject.choose).toHaveBeenCalledTimes(1);
    expect(api.puts.find(call => call.key === 'appearance')?.etag).toBe(
      '"remote-appearance"',
    );
    expect(bridge.currentDocuments.appearance).toEqual({primaryColor: 'Blue'});
  });

  test('merges cloud values and uploads only documents absent from the server', async () => {
    const api = fakeApi({
      appearance: {
        key: 'appearance',
        value: {primaryColor: 'Green'},
        etag: '"remote-appearance"',
      },
    });
    const storage = new MemoryStorage();
    const bridge = new MemoryBridge();
    const subject = coordinator(api, storage, bridge, 'cloud');

    await subject.value.activateLocal('account-a');
    await subject.value.syncRemote('account-a', 'opaque-session');

    expect(bridge.currentDocuments.appearance).toEqual({primaryColor: 'Green'});
    expect(api.puts.map(call => call.key)).toEqual([
      'mushaf',
      'audio',
      'adhkar',
      'browsing',
    ]);
  });

  test('writes a merged replacement when an existing cloud document lacks local fields', async () => {
    const api = fakeApi({
      mushaf: {
        key: 'mushaf',
        value: {showTranslation: false},
        etag: '"partial-mushaf"',
      },
    });
    const storage = new MemoryStorage();
    const bridge = new MemoryBridge();
    bridge.currentDocuments.mushaf = {
      showTranslation: true,
      showWBW: true,
    };
    const subject = coordinator(api, storage, bridge, 'cloud');

    await subject.value.activateLocal('account-a');
    await subject.value.syncRemote('account-a', 'opaque-session');

    const mushaf = api.puts.find(call => call.key === 'mushaf');
    expect(mushaf?.etag).toBe('"partial-mushaf"');
    expect(JSON.parse(mushaf?.body ?? '{}')).toEqual({
      value: {showTranslation: false, showWBW: true},
      schemaVersion: 1,
    });
  });

  test('rebases a 412 without changing the pending request body', async () => {
    const api = fakeApi();
    const storage = new MemoryStorage();
    const bridge = new MemoryBridge();
    let attempts = 0;
    api.putDocument.mockImplementation(async (_token, input) => {
      api.puts.push({...input});
      if (input.key === 'appearance' && attempts++ === 0) {
        api.getDocument.mockImplementationOnce(async () => ({
          key: 'appearance',
          value: {primaryColor: 'Green'},
          etag: '"remote-after-conflict"',
        }));
        throw new BayaanSettingsApiError(412, 'QF_SETTINGS_CONFLICT');
      }
      return `"etag-${input.key}-${api.puts.length}"`;
    });
    const subject = coordinator(api, storage, bridge);

    await subject.value.activateLocal('account-a');
    await subject.value.syncRemote('account-a', 'opaque-session');

    const appearance = api.puts.filter(call => call.key === 'appearance');
    expect(appearance).toHaveLength(2);
    expect(appearance[1].body).toBe(appearance[0].body);
    expect(appearance[1].idempotencyKey).not.toBe(appearance[0].idempotencyKey);
    expect(appearance[1].etag).toBe('"remote-after-conflict"');
  });

  test('persists and pushes later local changes while remote sync is available', async () => {
    jest.useFakeTimers();
    const api = fakeApi();
    const storage = new MemoryStorage();
    const bridge = new MemoryBridge();
    const subject = coordinator(api, storage, bridge);

    subject.value.setRemoteAvailable(true);
    await subject.value.activateLocal('account-a');
    await subject.value.syncRemote('account-a', 'opaque-session');
    api.puts.length = 0;

    bridge.changeDocument('appearance', {primaryColor: 'Rose'});
    jest.advanceTimersByTime(2);
    await subject.value.waitForIdle();

    expect(api.puts).toHaveLength(1);
    expect(api.puts[0].key).toBe('appearance');
    expect(JSON.parse(api.puts[0].body)).toEqual({
      value: {primaryColor: 'Rose'},
      schemaVersion: 1,
    });
    jest.useRealTimers();
  });

  test('retries a transient local-change delivery with the durable mutation', async () => {
    jest.useFakeTimers();
    const api = fakeApi();
    const storage = new MemoryStorage();
    const bridge = new MemoryBridge();
    const subject = coordinator(api, storage, bridge);

    subject.value.setRemoteAvailable(true);
    await subject.value.activateLocal('account-a');
    await subject.value.syncRemote('account-a', 'opaque-session');
    api.puts.length = 0;
    let attempts = 0;
    api.putDocument.mockImplementation(async (_token, input) => {
      api.puts.push({...input});
      if (input.key === 'appearance' && attempts++ === 0) {
        throw new BayaanSettingsApiError(0, 'network_error');
      }
      return '"retry-success"';
    });

    bridge.changeDocument('appearance', {primaryColor: 'Green'});
    jest.advanceTimersByTime(2);
    await subject.value.waitForIdle();
    await Promise.resolve();
    jest.advanceTimersByTime(1_000);
    await subject.value.waitForIdle();

    const appearance = api.puts.filter(call => call.key === 'appearance');
    expect(appearance).toHaveLength(2);
    expect(appearance[1]).toMatchObject({
      body: appearance[0].body,
      idempotencyKey: appearance[0].idempotencyKey,
      etag: appearance[0].etag,
    });
    jest.useRealTimers();
  });

  test('preserves a local edit made while a remote pull is in flight', async () => {
    const api = fakeApi({
      appearance: {
        key: 'appearance',
        value: {primaryColor: 'Green'},
        etag: '"remote-appearance"',
      },
    });
    let releasePreferences: (() => void) | undefined;
    api.getPreferences.mockImplementation(
      () =>
        new Promise<Record<string, unknown>>(resolve => {
          releasePreferences = () => resolve({});
        }),
    );
    const storage = new MemoryStorage();
    const saved = emptyState();
    saved.initialized = true;
    saved.localDocuments = documents();
    saved.localPreferences = preferences();
    saved.localPreferenceFingerprint = JSON.stringify(saved.localPreferences);
    storage.states.set('account-a', saved);
    const bridge = new MemoryBridge();
    const subject = coordinator(api, storage, bridge);

    subject.value.setRemoteAvailable(true);
    await subject.value.activateLocal('account-a');
    const syncing = subject.value.syncRemote('account-a', 'opaque-session');
    for (let attempt = 0; attempt < 10 && !releasePreferences; attempt += 1) {
      await Promise.resolve();
    }
    expect(releasePreferences).toBeDefined();
    bridge.changeDocument('appearance', {primaryColor: 'Rose'});
    releasePreferences?.();
    await syncing;

    expect(bridge.currentDocuments.appearance).toEqual({primaryColor: 'Rose'});
    const appearance = api.puts.filter(call => call.key === 'appearance');
    expect(appearance).toHaveLength(1);
    expect(appearance[0].etag).toBe('"remote-appearance"');
    expect(JSON.parse(appearance[0].body)).toEqual({
      value: {primaryColor: 'Rose'},
      schemaVersion: 1,
    });
  });

  test('does not apply a completed pull after the account is deactivated', async () => {
    const api = fakeApi({
      appearance: {
        key: 'appearance',
        value: {primaryColor: 'Green'},
        etag: '"remote-appearance"',
      },
    });
    let releasePreferences: (() => void) | undefined;
    api.getPreferences.mockImplementation(
      () =>
        new Promise<Record<string, unknown>>(resolve => {
          releasePreferences = () => resolve({});
        }),
    );
    const storage = new MemoryStorage();
    const bridge = new MemoryBridge();
    const subject = coordinator(api, storage, bridge, 'cloud');

    await subject.value.activateLocal('account-a');
    const syncing = subject.value.syncRemote('account-a', 'opaque-session');
    await Promise.resolve();
    const deactivating = subject.value.deactivate();
    releasePreferences?.();
    await syncing;
    await deactivating;

    expect(bridge.currentDocuments.appearance).toEqual({primaryColor: 'Blue'});
    expect(subject.choose).not.toHaveBeenCalled();
  });

  test('does not capture new-account values into a stale account operation', async () => {
    const api = fakeApi();
    let releaseConfiguration: (() => void) | undefined;
    api.assertConfiguration.mockImplementation(
      () =>
        new Promise<undefined>(resolve => {
          releaseConfiguration = () => resolve(undefined);
        }),
    );
    const storage = new MemoryStorage();
    const saved = emptyState();
    saved.initialized = true;
    saved.localDocuments = documents();
    saved.localPreferences = preferences();
    saved.localPreferenceFingerprint = JSON.stringify(saved.localPreferences);
    storage.states.set('account-a', saved);
    const bridge = new MemoryBridge();
    const subject = coordinator(api, storage, bridge);

    await subject.value.activateLocal('account-a');
    const syncing = subject.value.syncRemote('account-a', 'opaque-session-a');
    await Promise.resolve();
    bridge.changeDocument('appearance', {primaryColor: 'Rose'});
    await new Promise(resolve => setTimeout(resolve, 5));
    const activating = subject.value.activateLocal('account-b');
    bridge.currentDocuments.appearance = {primaryColor: 'Green'};
    releaseConfiguration?.();
    await Promise.all([syncing, activating]);

    expect(storage.states.get('account-a')?.localDocuments.appearance).toEqual({
      primaryColor: 'Blue',
    });
  });

  test('restores an initialized account snapshot before subscribing', async () => {
    const api = fakeApi();
    const storage = new MemoryStorage();
    const saved = emptyState();
    saved.initialized = true;
    saved.localDocuments = documents('Emerald');
    storage.states.set('account-b', saved);
    const bridge = new MemoryBridge();
    saved.localPreferences = preferences();
    saved.localPreferenceFingerprint = JSON.stringify(saved.localPreferences);
    const subject = coordinator(api, storage, bridge, 'cloud');

    await subject.value.activateLocal('account-b');

    expect(bridge.currentDocuments.appearance).toEqual({
      primaryColor: 'Emerald',
    });
    expect(api.puts).toHaveLength(0);
  });
});
