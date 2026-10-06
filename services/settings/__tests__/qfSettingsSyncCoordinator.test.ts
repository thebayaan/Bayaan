jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

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
import {QfSettingsSyncLifecycle} from '../qfSettingsSyncLifecycle';
import type {
  PersistedSettingsDeviceContext,
  PersistedSettingsSyncState,
  QfSettingsStorage,
} from '../qfSettingsStorage';
// Keep the real sanitizer and theme catalog; native playback stores are not
// involved in these bridge-based coordinator tests.
jest.mock('@/services/player/store/playerStore', () => ({usePlayerStore: {}}));
jest.mock('@/store/ambientStore', () => ({useAmbientStore: {}}));
jest.mock('@/store/mushafPlayerStore', () => ({useMushafPlayerStore: {}}));

import {
  sanitizeRemoteDocument,
  type SettingsDocuments,
} from '../qfSettingsSnapshot';

const KEYS: SettingsDocumentKey[] = [
  'appearance',
  'mushaf',
  'audio',
  'adhkar',
  'browsing',
];

function documents(themeMode = 'system'): SettingsDocuments {
  return {
    appearance: {themeMode},
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
    needsReconciliation: false,
    syncedDocuments: documents(),
    syncedLocalDocuments: documents(),
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
  deviceContext: PersistedSettingsDeviceContext | null = null;

  async loadDeviceContext(): Promise<PersistedSettingsDeviceContext | null> {
    return this.deviceContext ? structuredClone(this.deviceContext) : null;
  }

  async saveDeviceContext(
    context: PersistedSettingsDeviceContext,
  ): Promise<void> {
    this.deviceContext = structuredClone(context);
  }

  async load(accountId: string): Promise<PersistedSettingsSyncState> {
    return structuredClone(this.states.get(accountId) ?? emptyState());
  }

  async clear(accountId: string): Promise<void> {
    this.states.delete(accountId);
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
      const etag = `"etag-${input.key}-${puts.length}"`;
      remote[input.key] = {
        key: input.key,
        value: JSON.parse(input.body).value,
        etag,
      };
      return etag;
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
  test.each([false, true])(
    'retains guest edits for a new account without copying unchanged account settings (restart=%s)',
    async restart => {
      const api = fakeApi();
      const storage = new MemoryStorage();
      const bridge = new MemoryBridge();
      const first = coordinator(api, storage, bridge);
      await first.value.activateLocal('account-a');
      await first.value.syncRemote('account-a', 'session-a');
      bridge.changeDocument('appearance', {themeMode: 'dark'});
      bridge.changeDocument('audio', {shuffle: true});
      await first.value.deactivate();
      bridge.changeDocument('appearance', {themeMode: 'light'});
      const next = restart ? coordinator(api, storage, bridge) : first;
      await next.value.activateLocal('account-b');
      expect(bridge.currentDocuments.appearance).toEqual({themeMode: 'light'});
      expect(bridge.currentDocuments.audio).toEqual({shuffle: false});
      expect(storage.deviceContext?.baselineDocuments.appearance).toEqual({
        themeMode: 'light',
      });
      await next.value.deactivate();
    },
  );

  test.each(['deactivate', 'switch'])(
    'persists edits before the capture debounce on %s without capturing the next account',
    async action => {
      jest.useFakeTimers();
      const api = fakeApi();
      const storage = new MemoryStorage();
      const bridge = new MemoryBridge();
      const subject = coordinator(api, storage, bridge);
      await subject.value.activateLocal('account-a');
      await subject.value.syncRemote('account-a', 'session');
      api.puts.length = 0;
      bridge.changeDocument('appearance', {themeMode: 'dark'});
      const departure =
        action === 'deactivate'
          ? subject.value.deactivate()
          : subject.value.activateLocal('account-b');
      // Shared stores can change again while serialized persistence is pending.
      bridge.currentDocuments.appearance = {themeMode: 'light'};
      await departure;
      expect(
        storage.states.get('account-a')?.localDocuments.appearance,
      ).toEqual({themeMode: 'dark'});
      expect(
        storage.states.get('account-a')?.pending.appearance?.changes,
      ).toEqual([{path: ['themeMode'], value: 'dark'}]);
      expect(api.puts).toHaveLength(0);
      await subject.value.deactivate();
    },
  );
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test.each(['success', 'offline', 'background', 'account', 'signout', 'stop'])(
    'lifecycle retries resumed offline intent after repeated 412, or cancels on %s',
    async outcome => {
      jest.useFakeTimers();
      jest.spyOn(console, 'warn').mockImplementation(() => undefined);
      const baseline = {
        showTranslation: true,
        showWBW: false,
        pageLayout: 'fullscreen',
      };
      const remote = {
        mushaf: {
          key: 'mushaf' as const,
          value: {...baseline, futureOption: {revision: 0}},
          etag: 'original',
        },
      };
      const api = fakeApi(remote);
      const storage = new MemoryStorage();
      const bridge = new MemoryBridge();
      bridge.currentDocuments.mushaf = {...baseline};
      bridge.sanitizeDocument = sanitizeRemoteDocument;
      const first = coordinator(api, storage, bridge, 'cloud');
      await first.value.activateLocal('account-a');
      await first.value.syncRemote('account-a', 'session-a');
      // Persist an offline edit, then dispose this coordinator as on restart.
      bridge.changeDocument('mushaf', {...baseline, showWBW: true});
      jest.advanceTimersByTime(2);
      await first.value.waitForIdle();
      const intent = storage.states.get('account-a')?.pending.mushaf;
      expect(intent?.changes).toEqual([{path: ['showWBW'], value: true}]);
      await first.value.deactivate();
      api.puts.length = 0;
      const normalPut = api.putDocument.getMockImplementation()!;
      let conflicts = 0;
      api.putDocument.mockImplementation(async (token, input) => {
        if (input.key === 'mushaf' && conflicts < 2) {
          conflicts += 1;
          remote.mushaf = {
            key: 'mushaf',
            value: {
              ...baseline,
              showTranslation: false,
              pageLayout: 'book',
              futureOption: {revision: conflicts},
            },
            etag: `device-a-${conflicts}`,
          };
          api.puts.push({...input});
          throw new BayaanSettingsApiError(412, 'QF_SETTINGS_CONFLICT');
        }
        // The retry first replays the persisted bytes. Its stale ETag must
        // trigger a fresh GET/rebase, not overwrite the other device's value.
        if (input.key === 'mushaf' && input.etag !== remote.mushaf.etag) {
          api.puts.push({...input});
          throw new BayaanSettingsApiError(412, 'QF_SETTINGS_CONFLICT');
        }
        return normalPut(token, input);
      });
      const resumed = coordinator(api, storage, bridge, 'cloud');
      const lifecycle = new QfSettingsSyncLifecycle({
        enabled: true,
        coordinator: resumed.value,
        getSession: jest.fn(async () => ({
          token: 'session-a',
          profile: {accountId: 'account-a'},
        })) as never,
        onSessionRevoked: jest.fn(async () => undefined),
      });
      const context = {
        authStatus: 'authenticated' as const,
        accountId: 'account-a',
        online: false,
        appActive: true,
      };
      const settle = async () => {
        for (let i = 0; i < 100; i++) await Promise.resolve();
        await resumed.value.waitForIdle();
        for (let i = 0; i < 20; i++) await Promise.resolve();
      };
      try {
        lifecycle.updateContext(context);
        await settle();
        expect(api.puts).toHaveLength(0);
        lifecycle.updateContext({...context, online: true});
        await settle();
        expect(api.puts).toHaveLength(2);
        expect(storage.states.get('account-a')?.pending.mushaf).toMatchObject({
          changes: intent?.changes,
          attempted: true,
          etag: 'device-a-1',
        });
        expect(jest.getTimerCount()).toBe(1);
        // No edit or context change is needed to deliver the retry, and there
        // is no tight loop while the first lifecycle backoff has not elapsed.
        jest.advanceTimersByTime(999);
        await settle();
        expect(api.puts).toHaveLength(2);
        if (outcome === 'success') {
          jest.advanceTimersByTime(1);
          await settle();
          expect(api.puts).toHaveLength(4);
          expect(api.puts[2]).toMatchObject({
            body: api.puts[1].body,
            idempotencyKey: api.puts[1].idempotencyKey,
            etag: api.puts[1].etag,
          });
          expect(api.puts[3].etag).toBe('device-a-2');
          expect(api.puts[3].idempotencyKey).not.toBe(
            api.puts[2].idempotencyKey,
          );
          expect(remote.mushaf.value).toEqual({
            ...baseline,
            showTranslation: false,
            showWBW: true,
            pageLayout: 'book',
            futureOption: {revision: 2},
          });
          expect(bridge.currentDocuments.mushaf).toEqual({
            ...baseline,
            showTranslation: false,
            showWBW: true,
            pageLayout: 'book',
          });
          expect(storage.states.get('account-a')?.pending).toEqual({});
          expect(jest.getTimerCount()).toBe(0);
        } else {
          if (outcome === 'stop') await lifecycle.stop();
          else {
            lifecycle.updateContext({
              ...context,
              online: outcome !== 'offline',
              appActive: outcome !== 'background',
              accountId: outcome === 'account' ? 'account-b' : 'account-a',
              authStatus:
                outcome === 'signout' ? 'signed_out' : 'authenticated',
            });
          }
          await settle();
          jest.advanceTimersByTime(120_000);
          await settle();
          expect(api.puts).toHaveLength(2);
          expect(
            storage.states.get('account-a')?.pending.mushaf?.changes,
          ).toEqual(intent?.changes);
          expect(jest.getTimerCount()).toBe(0);
        }
      } finally {
        await lifecycle.stop();
      }
    },
  );

  test('treats same-account upgrade mismatches as local leaf edits without prompting', async () => {
    const api = fakeApi();
    const storage = new MemoryStorage();
    const bridge = new MemoryBridge();
    const initial = coordinator(api, storage, bridge);
    await initial.value.activateLocal('account-a');
    await initial.value.syncRemote('account-a', 'session-a');
    await initial.value.deactivate();
    // A crash/app update changes the local store without the old subscriber.
    bridge.currentDocuments.mushaf = {showTranslation: true, showWBW: true};
    const resumed = coordinator(api, storage, bridge);
    await resumed.value.activateLocal('account-a');
    expect(resumed.choose).not.toHaveBeenCalled();
    expect(storage.states.get('account-a')?.pending.mushaf?.changes).toEqual([
      {path: ['showWBW'], value: true},
    ]);
    await resumed.value.deactivate();
  });

  test('explicit sign-out drains capture then removes only the departing account state', async () => {
    const api = fakeApi();
    const storage = new MemoryStorage();
    const bridge = new MemoryBridge();
    storage.states.set('account-b', emptyState());
    const subject = coordinator(api, storage, bridge);
    await subject.value.activateLocal('account-a');
    await subject.value.syncRemote('account-a', 'session-a');
    bridge.changeDocument('appearance', {themeMode: 'dark'});
    await subject.value.deactivate(true);
    expect(storage.states.has('account-a')).toBe(false);
    expect(storage.states.has('account-b')).toBe(true);
    expect(storage.deviceContext?.signedOutDocuments?.appearance).toEqual({
      themeMode: 'dark',
    });
  });

  test.each(['initial', '412'] as const)(
    'never downgrades a future read-only document encountered during %s, including after restart',
    async stage => {
      const remote: Partial<
        Record<SettingsDocumentKey, RemoteSettingsDocument>
      > = {};
      if (stage === 'initial')
        remote.mushaf = {
          key: 'mushaf',
          value: {showTranslation: true},
          etag: 'future',
          schemaVersion: 2,
          readOnly: true,
        };
      const api = fakeApi(remote);
      const storage = new MemoryStorage();
      const bridge = new MemoryBridge();
      const subject = coordinator(api, storage, bridge);
      await subject.value.activateLocal('account-a');
      await subject.value.syncRemote('account-a', 'session');
      api.puts.length = 0;
      bridge.changeDocument('mushaf', {showTranslation: false});
      if (stage === '412') {
        remote.mushaf = {
          key: 'mushaf',
          value: {showTranslation: true},
          etag: 'future',
          schemaVersion: 2,
          readOnly: true,
        };
        const original = api.putDocument.getMockImplementation()!;
        api.putDocument.mockImplementation(async (token, input) => {
          if (input.key === 'mushaf')
            throw new BayaanSettingsApiError(412, 'changed_schema');
          return original(token, input);
        });
      }
      await subject.value.syncRemote('account-a', 'session');
      expect(api.puts.filter(put => put.key === 'mushaf')).toHaveLength(0);
      expect(storage.states.get('account-a')?.readOnlyDocuments?.mushaf).toBe(
        true,
      );
      expect(storage.states.get('account-a')?.pending.mushaf?.changes).toEqual([
        {path: ['showTranslation'], value: false},
      ]);
      expect(remote.mushaf?.schemaVersion).toBe(2);
      await subject.value.deactivate();
      const attempts = api.putDocument.mock.calls.length;
      const resumed = coordinator(api, storage, bridge);
      await resumed.value.activateLocal('account-a');
      await resumed.value.syncRemote('account-a', 'session');
      expect(api.putDocument.mock.calls).toHaveLength(attempts);
      expect(bridge.currentDocuments.mushaf.showTranslation).toBe(false);
      await resumed.value.deactivate();
    },
  );

  test('sign-out cancels first reconciliation without waiting for an alert choice', async () => {
    const api = fakeApi({
      appearance: {
        key: 'appearance',
        value: {themeMode: 'dark'},
        etag: 'cloud',
      },
    });
    const storage = new MemoryStorage();
    const bridge = new MemoryBridge();
    let reached!: () => void;
    const asked = new Promise<void>(resolve => {
      reached = resolve;
    });
    const subject = new QfSettingsSyncCoordinator({
      api: api as never,
      storage: storage as unknown as QfSettingsStorage,
      bridge,
      chooseFirstSyncConflict: () => {
        reached();
        return new Promise(() => undefined);
      },
    });
    await subject.activateLocal('account-a');
    const syncing = subject.syncRemote('account-a', 'session-a');
    await asked;
    await subject.deactivate(true);
    await syncing;
    expect(storage.states.has('account-a')).toBe(false);
    expect(api.puts).toHaveLength(0);
  });

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
        value: {themeMode: 'dark'},
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
    expect(bridge.currentDocuments.appearance).toEqual({themeMode: 'system'});
  });

  test('merges cloud values and uploads only documents absent from the server', async () => {
    const api = fakeApi({
      appearance: {
        key: 'appearance',
        value: {themeMode: 'dark'},
        etag: '"remote-appearance"',
      },
    });
    const storage = new MemoryStorage();
    const bridge = new MemoryBridge();
    const subject = coordinator(api, storage, bridge, 'cloud');

    await subject.value.activateLocal('account-a');
    await subject.value.syncRemote('account-a', 'opaque-session');

    expect(bridge.currentDocuments.appearance).toEqual({themeMode: 'dark'});
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

  test('rebases a 412 while preserving the local changed field', async () => {
    const api = fakeApi();
    const storage = new MemoryStorage();
    const bridge = new MemoryBridge();
    let attempts = 0;
    api.putDocument.mockImplementation(async (_token, input) => {
      api.puts.push({...input});
      if (input.key === 'appearance' && attempts++ === 0) {
        api.getDocument.mockImplementationOnce(async () => ({
          key: 'appearance',
          value: {themeMode: 'dark'},
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
    expect(JSON.parse(appearance[1].body).value).toEqual({themeMode: 'system'});
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

    bridge.changeDocument('appearance', {themeMode: 'light'});
    jest.advanceTimersByTime(2);
    await subject.value.waitForIdle();

    expect(api.puts).toHaveLength(1);
    expect(api.puts[0].key).toBe('appearance');
    expect(JSON.parse(api.puts[0].body)).toEqual({
      value: {themeMode: 'light'},
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

    bridge.changeDocument('appearance', {themeMode: 'dark'});
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

  test('replays ambiguous bytes before uploading newer edits after restart', async () => {
    const api = fakeApi();
    const storage = new MemoryStorage();
    const bridge = new MemoryBridge();
    const subject = coordinator(api, storage, bridge);
    await subject.value.activateLocal('account-a');
    await subject.value.syncRemote('account-a', 'session');
    const normalPut = api.putDocument.getMockImplementation()!;
    let failed = false;
    api.puts.length = 0;
    api.putDocument.mockImplementation(async (token, input) => {
      if (input.key === 'appearance' && !failed) {
        failed = true;
        api.puts.push({...input});
        throw new BayaanSettingsApiError(0, 'network_error');
      }
      return normalPut(token, input);
    });
    bridge.changeDocument('appearance', {themeMode: 'dark'});
    await expect(
      subject.value.syncRemote('account-a', 'session'),
    ).rejects.toMatchObject({status: 0});
    const ambiguous = api.puts[0];
    bridge.changeDocument('appearance', {themeMode: 'light'});
    // Capture the newer local snapshot offline, without delivering remotely.
    await new Promise(resolve => setTimeout(resolve, 5));
    await subject.value.waitForIdle();
    await subject.value.deactivate();
    const resumed = coordinator(api, storage, bridge, 'cloud');
    await resumed.value.activateLocal('account-a');
    await resumed.value.syncRemote('account-a', 'new-session');
    const puts = api.puts.filter(call => call.key === 'appearance');
    expect(puts).toHaveLength(3);
    expect(puts[1]).toMatchObject({
      body: ambiguous.body,
      idempotencyKey: ambiguous.idempotencyKey,
    });
    expect(JSON.parse(puts[2].body).value).toEqual({themeMode: 'light'});
    expect(bridge.currentDocuments.appearance.themeMode).toBe('light');
    await resumed.value.deactivate();
  });

  test('preserves a local edit made while a remote pull is in flight', async () => {
    const api = fakeApi({
      appearance: {
        key: 'appearance',
        value: {themeMode: 'dark'},
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
    bridge.changeDocument('appearance', {themeMode: 'light'});
    releasePreferences?.();
    await syncing;

    expect(bridge.currentDocuments.appearance).toEqual({themeMode: 'light'});
    const appearance = api.puts.filter(call => call.key === 'appearance');
    expect(appearance).toHaveLength(1);
    expect(appearance[0].etag).toBe('"remote-appearance"');
    expect(JSON.parse(appearance[0].body)).toEqual({
      value: {themeMode: 'light'},
      schemaVersion: 1,
    });
  });

  test('does not apply a completed pull after the account is deactivated', async () => {
    const api = fakeApi({
      appearance: {
        key: 'appearance',
        value: {themeMode: 'dark'},
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

    expect(bridge.currentDocuments.appearance).toEqual({themeMode: 'system'});
    expect(subject.choose).not.toHaveBeenCalled();
  });

  test('restores an account-neutral baseline before syncing a new account', async () => {
    const api = fakeApi();
    const storage = new MemoryStorage();
    const bridge = new MemoryBridge();
    const subject = coordinator(api, storage, bridge);

    subject.value.setRemoteAvailable(true);
    await subject.value.activateLocal('account-a');
    await subject.value.syncRemote('account-a', 'opaque-session-a');
    // The fake server's account-a documents must not stand in for account-b.
    api.getDocument.mockImplementation(async () => null);
    bridge.currentDocuments.appearance = {themeMode: 'dark'};
    await subject.value.deactivate();
    api.puts.length = 0;

    await subject.value.activateLocal('account-b');
    expect(bridge.currentDocuments.appearance).toEqual({themeMode: 'system'});
    await subject.value.syncRemote('account-b', 'opaque-session-b');

    const appearance = api.puts.find(call => call.key === 'appearance');
    expect(JSON.parse(appearance?.body ?? '{}')).toEqual({
      value: {themeMode: 'system'},
      schemaVersion: 1,
    });
    expect(storage.deviceContext?.ownerAccountId).toBe('account-b');
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
    bridge.changeDocument('appearance', {themeMode: 'light'});
    await new Promise(resolve => setTimeout(resolve, 5));
    const activating = subject.value.activateLocal('account-b');
    bridge.currentDocuments.appearance = {themeMode: 'dark'};
    releaseConfiguration?.();
    await Promise.all([syncing, activating]);

    expect(storage.states.get('account-a')?.localDocuments.appearance).toEqual({
      themeMode: 'light',
    });
  });

  test('preserves unknown remote fields in normal uploads and across reload', async () => {
    const remote = {
      mushaf: {
        key: 'mushaf' as const,
        value: {
          showTranslation: true,
          showWBW: false,
          pageLayout: 'fullscreen',
          futureOption: {enabled: true, nested: ['new']},
        },
        etag: 'initial',
      },
    };
    const api = fakeApi(remote);
    const storage = new MemoryStorage();
    const bridge = new MemoryBridge();
    bridge.currentDocuments.mushaf = {
      showTranslation: true,
      showWBW: false,
      pageLayout: 'fullscreen',
    };
    bridge.sanitizeDocument = (_key, value) =>
      Object.fromEntries(
        Object.entries(value).filter(([key]) => key !== 'futureOption'),
      );
    const first = coordinator(api, storage, bridge, 'cloud');
    await first.value.activateLocal('account-a');
    await first.value.syncRemote('account-a', 'session-a');
    expect(
      storage.states.get('account-a')?.syncedDocuments.mushaf?.futureOption,
    ).toEqual(remote.mushaf.value.futureOption);
    await first.value.deactivate();
    const resumed = coordinator(api, storage, bridge, 'cloud');
    await resumed.value.activateLocal('account-a');
    bridge.changeDocument('mushaf', {
      ...bridge.currentDocuments.mushaf,
      showWBW: true,
    });
    api.puts.length = 0;
    await resumed.value.syncRemote('account-a', 'session-a');
    expect(api.puts.filter(call => call.key === 'mushaf')).toHaveLength(1);
    expect(remote.mushaf.value).toMatchObject({
      showWBW: true,
      pageLayout: 'fullscreen',
      futureOption: {enabled: true, nested: ['new']},
    });
    expect(bridge.currentDocuments.mushaf).not.toHaveProperty('futureOption');
    await resumed.value.deactivate();
  });

  test('rebases only B showWBW onto A pageLayout and new unknown fields after 412', async () => {
    const baseline = {
      showTranslation: true,
      showWBW: false,
      pageLayout: 'fullscreen',
    };
    const remote = {
      mushaf: {
        key: 'mushaf' as const,
        value: {...baseline, pageLayout: 'book', futureOption: {mode: 'new'}},
        etag: 'device-a',
      },
    };
    const api = fakeApi(remote);
    const normalPut = api.putDocument.getMockImplementation()!;
    let conflicted = false;
    api.putDocument.mockImplementation(async (token, input) => {
      if (input.key === 'mushaf' && !conflicted) {
        conflicted = true;
        api.puts.push({...input});
        throw new BayaanSettingsApiError(412, 'QF_SETTINGS_CONFLICT');
      }
      return normalPut(token, input);
    });
    const saved = emptyState();
    saved.initialized = true;
    saved.localDocuments = documents();
    saved.localDocuments.mushaf = baseline;
    saved.syncedLocalDocuments.mushaf = baseline;
    saved.syncedDocuments.mushaf = {...baseline, olderUnknown: 1};
    saved.etags.mushaf = 'device-b-stale';
    saved.localPreferences = preferences();
    saved.localPreferenceFingerprint = JSON.stringify(saved.localPreferences);
    const storage = new MemoryStorage();
    storage.states.set('account-a', saved);
    const bridge = new MemoryBridge();
    bridge.currentDocuments.mushaf = {...baseline};
    bridge.sanitizeDocument = (_key, value) =>
      Object.fromEntries(
        Object.entries(value).filter(
          ([key]) => !['futureOption', 'olderUnknown'].includes(key),
        ),
      );
    const subject = coordinator(api, storage, bridge);
    await subject.value.activateLocal('account-a');
    bridge.changeDocument('mushaf', {...baseline, showWBW: true});
    await subject.value.syncRemote('account-a', 'session-b');
    const puts = api.puts.filter(call => call.key === 'mushaf');
    expect(puts).toHaveLength(2);
    expect(JSON.parse(puts[0].body).value.pageLayout).toBe('fullscreen');
    expect(JSON.parse(puts[1].body).value).toEqual({
      ...baseline,
      showWBW: true,
      pageLayout: 'book',
      futureOption: {mode: 'new'},
    });
    expect(puts[1].etag).toBe('device-a');
    expect(puts[1].idempotencyKey).not.toBe(puts[0].idempotencyKey);
    expect(bridge.currentDocuments.mushaf).toEqual({
      ...baseline,
      showWBW: true,
      pageLayout: 'book',
    });
    expect(storage.states.get('account-a')?.pending).toEqual({});
    await subject.value.deactivate();
  });

  test('preserves a concurrent edit and unknown map siblings when a nested patch conflicts', async () => {
    const baseline = {
      shuffle: false,
      ambientVolume: 1,
      reciterPreferences: {hafs: 'old', warsh: 'same'},
    };
    const remote = {
      audio: {
        key: 'audio' as const,
        value: {
          shuffle: true,
          ambientVolume: 1,
          reciterPreferences: {hafs: 'old', warsh: 'device-a', future: 'new'},
        },
        etag: 'device-a',
      },
    };
    const api = fakeApi(remote);
    const normalPut = api.putDocument.getMockImplementation()!;
    let attempts = 0;
    let release: (() => void) | undefined;
    api.putDocument.mockImplementation(async (token, input) => {
      if (input.key === 'audio' && attempts++ === 0) {
        api.puts.push({...input});
        throw new BayaanSettingsApiError(412, 'conflict');
      }
      if (input.key === 'audio' && attempts === 2) {
        await new Promise<void>(resolve => {
          release = resolve;
        });
      }
      return normalPut(token, input);
    });
    const saved = emptyState();
    saved.initialized = true;
    saved.localDocuments = documents();
    saved.localDocuments.audio = baseline;
    saved.syncedLocalDocuments.audio = baseline;
    saved.syncedDocuments.audio = baseline;
    saved.etags.audio = 'stale';
    saved.localPreferences = preferences();
    saved.localPreferenceFingerprint = JSON.stringify(saved.localPreferences);
    const storage = new MemoryStorage();
    storage.states.set('account-a', saved);
    const bridge = new MemoryBridge();
    bridge.currentDocuments.audio = structuredClone(baseline);
    const subject = coordinator(api, storage, bridge);
    await subject.value.activateLocal('account-a');
    bridge.changeDocument('audio', {
      ...baseline,
      reciterPreferences: {hafs: 'device-b', warsh: 'same'},
    });
    const syncing = subject.value.syncRemote('account-a', 'session');
    for (let i = 0; i < 100 && !release; i++) await Promise.resolve();
    expect(release).toBeDefined();
    bridge.changeDocument('audio', {
      ...bridge.currentDocuments.audio,
      shuffle: false,
      ambientVolume: 0.25,
    });
    release?.();
    await syncing;
    expect(remote.audio.value).toMatchObject({
      shuffle: true,
      ambientVolume: 0.25,
      reciterPreferences: {hafs: 'device-b', warsh: 'device-a', future: 'new'},
    });
    expect(bridge.currentDocuments.audio).toMatchObject(remote.audio.value);
    await subject.value.deactivate();
  });

  test.each([false, true])(
    'Use cloud retains an unsupported theme on first/legacy reconciliation (legacy=%s)',
    async legacy => {
      const remote = {
        mushaf: {
          key: 'mushaf' as const,
          value: {
            showTranslation: false,
            lightThemeId: 'future-light-theme',
            futureOption: {mode: 'new'},
          },
          etag: 'remote-theme',
        },
      };
      const api = fakeApi(remote);
      const storage = new MemoryStorage();
      const bridge = new MemoryBridge();
      bridge.currentDocuments.mushaf = {
        showTranslation: true,
        lightThemeId: 'default',
        showWBW: false,
      };
      bridge.sanitizeDocument = sanitizeRemoteDocument;
      if (legacy) {
        const saved = emptyState();
        saved.initialized = true;
        saved.needsReconciliation = true;
        saved.localDocuments = bridge.captureDocuments();
        saved.localPreferences = preferences();
        saved.localPreferenceFingerprint = JSON.stringify(
          saved.localPreferences,
        );
        storage.states.set('account-a', saved);
      }
      expect(
        sanitizeRemoteDocument('mushaf', remote.mushaf.value),
      ).not.toHaveProperty('lightThemeId');
      const subject = coordinator(api, storage, bridge, 'cloud');
      await subject.value.activateLocal('account-a');
      await subject.value.syncRemote('account-a', 'session');
      expect(subject.choose).toHaveBeenCalledTimes(1);
      expect(bridge.currentDocuments.mushaf).toEqual({
        showTranslation: false,
        lightThemeId: 'default',
        showWBW: false,
      });
      expect(remote.mushaf.value).toMatchObject({
        lightThemeId: 'future-light-theme',
        showWBW: false,
        futureOption: {mode: 'new'},
      });
      expect(
        storage.states.get('account-a')?.syncedLocalDocuments.mushaf
          ?.lightThemeId,
      ).toBe('default');
      api.puts.length = 0;
      await subject.value.syncRemote('account-a', 'session');
      expect(api.puts).toHaveLength(0);
      bridge.changeDocument('mushaf', {
        ...bridge.currentDocuments.mushaf,
        lightThemeId: 'parchment',
      });
      await subject.value.syncRemote('account-a', 'session');
      expect(api.puts.filter(call => call.key === 'mushaf')).toHaveLength(1);
      expect(remote.mushaf.value).toMatchObject({
        lightThemeId: 'parchment',
        futureOption: {mode: 'new'},
      });
      await subject.value.deactivate();
    },
  );

  test.each([{r2: 'kept'}, {}])(
    'projects remote reciter map removals on pull: %j',
    async nextMap => {
      const remote = {
        audio: {
          key: 'audio' as const,
          value: {
            shuffle: false,
            reciterPreferences: {r1: 'removed', r2: 'kept'},
            futureOption: 1,
          },
          etag: 'first',
        },
      };
      const api = fakeApi(remote);
      const storage = new MemoryStorage();
      const bridge = new MemoryBridge();
      bridge.sanitizeDocument = sanitizeRemoteDocument;
      const subject = coordinator(api, storage, bridge, 'cloud');
      await subject.value.activateLocal('account-a');
      await subject.value.syncRemote('account-a', 'session');
      remote.audio.value.reciterPreferences =
        nextMap as typeof remote.audio.value.reciterPreferences;
      remote.audio.etag = 'removed';
      api.puts.length = 0;
      await subject.value.syncRemote('account-a', 'session');
      expect(bridge.currentDocuments.audio.reciterPreferences).toEqual(nextMap);
      expect(
        storage.states.get('account-a')?.syncedLocalDocuments.audio
          ?.reciterPreferences,
      ).toEqual(nextMap);
      expect(
        storage.states.get('account-a')?.syncedDocuments.audio?.futureOption,
      ).toBe(1);
      expect(api.puts).toHaveLength(0);
      await subject.value.deactivate();
    },
  );

  test.each([{r2: 'kept'}, {}])(
    'projects map removals immediately after a 412 acknowledgment: %j',
    async nextMap => {
      const baseline = {
        shuffle: false,
        reciterPreferences: {r1: 'removed', r2: 'kept'},
      };
      const remote = {
        audio: {
          key: 'audio' as const,
          value: structuredClone(baseline),
          etag: 'first',
        },
      };
      const api = fakeApi(remote);
      const storage = new MemoryStorage();
      const bridge = new MemoryBridge();
      bridge.sanitizeDocument = sanitizeRemoteDocument;
      const subject = coordinator(api, storage, bridge, 'cloud');
      await subject.value.activateLocal('account-a');
      await subject.value.syncRemote('account-a', 'session');
      remote.audio.value.reciterPreferences =
        nextMap as typeof baseline.reciterPreferences;
      remote.audio.etag = 'new-map';
      const normalPut = api.putDocument.getMockImplementation()!;
      let attempts = 0;
      api.putDocument.mockImplementation(async (token, input) => {
        if (input.key === 'audio' && attempts++ === 0)
          throw new BayaanSettingsApiError(412, 'conflict');
        return normalPut(token, input);
      });
      bridge.changeDocument('audio', {
        ...bridge.currentDocuments.audio,
        shuffle: true,
      });
      // Block the following pull: convergence must already happen on ack.
      let releasePull: (() => void) | undefined;
      api.getPreferences.mockImplementation(
        () =>
          new Promise(resolve => {
            releasePull = () => resolve({});
          }),
      );
      const syncing = subject.value.syncRemote('account-a', 'session');
      for (let i = 0; i < 100 && !releasePull; i++) await Promise.resolve();
      expect(releasePull).toBeDefined();
      expect(bridge.currentDocuments.audio).toMatchObject({
        shuffle: true,
        reciterPreferences: nextMap,
      });
      expect(bridge.currentDocuments.audio.reciterPreferences).toEqual(nextMap);
      expect(storage.states.get('account-a')?.pending.audio).toBeUndefined();
      releasePull?.();
      await syncing;
      expect(remote.audio.value.reciterPreferences).toEqual(nextMap);
      await subject.value.deactivate();
    },
  );

  test('recaptures edits made during the pull persistence await before applying remote values', async () => {
    jest.useFakeTimers();
    const baseline = {
      showTranslation: true,
      showWBW: false,
      pageLayout: 'fullscreen',
    };
    const remote = {
      mushaf: {
        key: 'mushaf' as const,
        value: {
          ...baseline,
          showTranslation: false,
          futureOption: {enabled: true},
        },
        etag: 'remote',
      },
    };
    const api = fakeApi(remote);
    const storage = new MemoryStorage();
    const saved = emptyState();
    saved.initialized = true;
    saved.localDocuments = documents();
    saved.localDocuments.mushaf = baseline;
    saved.syncedLocalDocuments.mushaf = baseline;
    saved.syncedDocuments.mushaf = baseline;
    saved.localPreferences = preferences();
    saved.localPreferenceFingerprint = JSON.stringify(saved.localPreferences);
    storage.states.set('account-a', saved);
    const bridge = new MemoryBridge();
    bridge.currentDocuments.mushaf = {...baseline};
    bridge.sanitizeDocument = sanitizeRemoteDocument;
    const subject = coordinator(api, storage, bridge);
    await subject.value.activateLocal('account-a');
    let releaseFetch!: () => void;
    const fetchReached = new Promise<void>(reached => {
      api.getPreferences.mockImplementation(
        () =>
          new Promise(resolve => {
            releaseFetch = () => resolve({});
            reached();
          }),
      );
    });
    let releaseSave!: () => void;
    const save = storage.save.bind(storage);
    const saveReached = new Promise<void>(reached => {
      let held = false;
      storage.save = async (account, state) => {
        if (!held && state.pending.mushaf) {
          held = true;
          await new Promise<void>(resolve => {
            releaseSave = resolve;
            reached();
          });
        }
        await save(account, state);
      };
    });
    const syncing = subject.value.syncRemote('account-a', 'session');
    await fetchReached;
    bridge.changeDocument('mushaf', {...baseline, showWBW: true});
    releaseFetch();
    await saveReached;
    bridge.changeDocument('mushaf', {
      ...bridge.currentDocuments.mushaf,
      pageLayout: 'book',
    });
    releaseSave();
    await syncing;
    expect(bridge.currentDocuments.mushaf).toEqual({
      showTranslation: false,
      showWBW: true,
      pageLayout: 'book',
    });
    expect(remote.mushaf.value).toEqual({
      showTranslation: false,
      showWBW: true,
      pageLayout: 'book',
      futureOption: {enabled: true},
    });
    expect(api.puts.filter(call => call.key === 'mushaf')).toHaveLength(1);
    expect(storage.states.get('account-a')?.pending).toEqual({});
    await subject.value.deactivate();
    jest.useRealTimers();
  });

  test.each(['local', 'cloud'] as const)(
    'blocks legacy delivery after a failed fetch until explicit %s reconciliation',
    async choice => {
      jest.useFakeTimers();
      const remote = {
        mushaf: {
          key: 'mushaf' as const,
          value: {
            showTranslation: false,
            showWBW: false,
            futureOption: {enabled: true},
          },
          etag: 'retained-etag',
        },
      };
      const api = fakeApi(remote);
      const storage = new MemoryStorage();
      const saved = emptyState();
      saved.initialized = true;
      saved.needsReconciliation = true;
      saved.syncedDocuments = {};
      saved.syncedLocalDocuments = {};
      saved.etags.mushaf = 'retained-etag';
      const bridge = new MemoryBridge();
      bridge.currentDocuments.mushaf = {
        showTranslation: true,
        showWBW: false,
      };
      saved.localDocuments = bridge.captureDocuments();
      saved.localPreferences = preferences();
      saved.localPreferenceFingerprint = JSON.stringify(preferences());
      storage.states.set('account-a', saved);
      bridge.sanitizeDocument = sanitizeRemoteDocument;
      const subject = coordinator(api, storage, bridge, choice);
      subject.value.setRemoteAvailable(true);
      await subject.value.activateLocal('account-a');
      api.getPreferences.mockRejectedValueOnce(
        new BayaanSettingsApiError(0, 'network_error'),
      );
      await expect(
        subject.value.syncRemote('account-a', 'session'),
      ).rejects.toMatchObject({status: 0});
      bridge.changeDocument('mushaf', {
        showTranslation: true,
        showWBW: true,
      });
      jest.advanceTimersByTime(2);
      await subject.value.waitForIdle();
      expect(storage.states.get('account-a')).toMatchObject({
        needsReconciliation: true,
        localDocuments: {mushaf: {showWBW: true}},
      });
      // Exercise the last delivery boundary and retry entry independently of
      // debounce, including a retained session token and ETag.
      const delivery = subject.value as unknown as {
        flush: (
          account: string,
          token: string,
          generation: number,
        ) => Promise<void>;
        scheduleRetry: (
          account: string,
          generation: number,
          error: unknown,
        ) => void;
        generation: number;
      };
      await delivery.flush('account-a', 'session', delivery.generation);
      delivery.scheduleRetry(
        'account-a',
        delivery.generation,
        new BayaanSettingsApiError(0, 'network_error'),
      );
      jest.advanceTimersByTime(60_000);
      await subject.value.waitForIdle();
      expect(subject.choose).not.toHaveBeenCalled();
      expect(api.puts).toHaveLength(0);
      expect(api.preferencePuts).toHaveLength(0);
      expect(remote.mushaf.value.futureOption).toEqual({enabled: true});

      await subject.value.syncRemote('account-a', 'session');
      expect(subject.choose).toHaveBeenCalledTimes(1);
      expect(storage.states.get('account-a')?.needsReconciliation).toBe(false);
      expect(bridge.currentDocuments.mushaf.showWBW).toBe(choice === 'local');
      expect(remote.mushaf.value).toMatchObject({
        showWBW: choice === 'local',
        futureOption: {enabled: true},
      });
      await subject.value.deactivate();
      jest.useRealTimers();
    },
  );

  test('restores an initialized account snapshot before subscribing', async () => {
    const api = fakeApi();
    const storage = new MemoryStorage();
    const saved = emptyState();
    saved.initialized = true;
    saved.localDocuments = documents('sepia');
    storage.states.set('account-b', saved);
    const bridge = new MemoryBridge();
    saved.localPreferences = preferences();
    saved.localPreferenceFingerprint = JSON.stringify(saved.localPreferences);
    const subject = coordinator(api, storage, bridge, 'cloud');

    await subject.value.activateLocal('account-b');

    expect(bridge.currentDocuments.appearance).toEqual({
      themeMode: 'sepia',
    });
    expect(api.puts).toHaveLength(0);
  });
});
