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
  BayaanSettingsApiClient,
  BayaanSettingsApiError,
  type PreferenceMutation,
  type RemoteSettingsDocument,
  type SettingsDocumentKey,
} from '../bayaanSettingsApiClient';
import type {QfSettingsStoreBridge} from '../qfSettingsStoreBridge';
import {QfSettingsSyncCoordinator} from '../qfSettingsSyncCoordinator';
import {QfSettingsSyncLifecycle} from '../qfSettingsSyncLifecycle';
import {
  type PersistedSettingsDeviceContext,
  type PersistedSettingsSyncState,
  QfSettingsStorage,
} from '../qfSettingsStorage';
import AsyncStorage from '@react-native-async-storage/async-storage';
// Keep the real sanitizer and theme catalog; native playback stores are not
// involved in these bridge-based coordinator tests.
jest.mock('@/services/player/store/playerStore', () => ({usePlayerStore: {}}));
jest.mock('@/store/ambientStore', () => ({useAmbientStore: {}}));
jest.mock('@/store/mushafPlayerStore', () => ({useMushafPlayerStore: {}}));
jest.mock('@/services/mushaf/DigitalKhattDataService', () => ({
  digitalKhattDataService: {},
}));

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
    syncedPreferences: {},
    syncedLocalPreferences: preferences(),
    localPreferences: [],
    localPreferenceFingerprint: null,
    syncedPreferenceFingerprint: null,
  };
}

class MemoryStorage {
  states = new Map<string, PersistedSettingsSyncState>();
  deviceContext: PersistedSettingsDeviceContext | null = null;

  requireState(accountId: string): PersistedSettingsSyncState {
    const state = this.states.get(accountId);
    if (!state) throw new Error('Expected persisted settings state');
    return state;
  }

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

  applyPreferences(remote: Record<string, unknown>): void {
    this.currentPreferences = this.currentPreferences.map(item => {
      const group = remote[item.group];
      if (
        !group ||
        typeof group !== 'object' ||
        Array.isArray(group) ||
        !Object.hasOwn(group, item.key)
      )
        return item;
      const value = (group as Record<string, unknown>)[item.key];
      // Fixture projection only: keep unsupported cloud values opaque.
      if (
        item.key === 'playbackRate' &&
        ![0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].includes(value as number)
      )
        return item;
      if (
        typeof value !== typeof item.value ||
        (Array.isArray(item.value) && !Array.isArray(value))
      )
        return item;
      return {...item, value: structuredClone(value)};
    });
    this.listeners.forEach(listener => listener());
  }

  changePreference(group: string, key: string, value: unknown): void {
    this.currentPreferences = this.currentPreferences.map(item =>
      item.group === group && item.key === key ? {...item, value} : item,
    );
    this.listeners.forEach(listener => listener());
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
  const cloudPreferences: Record<string, Record<string, unknown>> = {};
  return {
    cloudPreferences,
    puts,
    preferencePuts,
    assertConfiguration: jest.fn(async () => undefined),
    getPreferences: jest.fn(
      async (): Promise<Record<string, unknown>> =>
        structuredClone(cloudPreferences),
    ),
    putPreferences: jest.fn(
      async (_token: string, value: PreferenceMutation[]) => {
        preferencePuts.push(structuredClone(value));
        for (const item of value) {
          cloudPreferences[item.group] = {
            ...(cloudPreferences[item.group] ?? {}),
            [item.key]: structuredClone(item.value),
          };
        }
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
  test('real API decoding of BFF-shaped opaque known keys never uploads the fallback', async () => {
    const bffPreferences = {
      quranReaderStyles: {
        quranTextFontScale: 5,
        translationFontScale: 3,
        showTajweedRules: false,
      },
      tafsirs: {selectedTafsirs: ['169']},
      audio: {playbackRate: 4},
    };
    const posts: PreferenceMutation[][] = [];
    const fetchImpl = async (url: string, init?: RequestInit) => {
      const path = new URL(url).pathname;
      if (init?.method === 'POST') {
        const batch = JSON.parse(String(init.body))
          .mutations as PreferenceMutation[];
        posts.push(batch);
        const record = bffPreferences as Record<
          string,
          Record<string, unknown>
        >;
        for (const item of batch) record[item.group][item.key] = item.value;
      }
      const data = path.endsWith('/config')
        ? {collections: [{name: 'settings', requiresPrecondition: true}]}
        : bffPreferences;
      const bytes = new TextEncoder().encode(
        JSON.stringify({success: true, data}),
      );
      return {
        ok: true,
        status: 200,
        headers: new Headers({etag: 'fixture'}),
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(bytes);
            controller.close();
          },
        }),
      } as Response;
    };
    const api = new BayaanSettingsApiClient('https://fixture.invalid', {
      fetchImpl,
    });
    // App State is absent for this fixture; its existing PUT path is separate.
    jest.spyOn(api, 'getDocument').mockResolvedValue(null);
    jest.spyOn(api, 'putDocument').mockResolvedValue('fixture-etag');
    const storage = new MemoryStorage();
    const bridge = new MemoryBridge();
    const subject = new QfSettingsSyncCoordinator({
      api,
      storage: storage as unknown as QfSettingsStorage,
      bridge,
      chooseFirstSyncConflict: async () => 'cloud',
    });
    await subject.activateLocal('reader');
    await subject.syncRemote('reader', 'session');
    expect(posts).toEqual([]);
    expect(
      bridge.currentPreferences.find(item => item.key === 'playbackRate')
        ?.value,
    ).toBe(1);
    expect(storage.requireState('reader').syncedPreferences).toEqual(
      bffPreferences,
    );
    await subject.deactivate();
    const resumed = new QfSettingsSyncCoordinator({
      api,
      storage: storage as unknown as QfSettingsStorage,
      bridge,
      chooseFirstSyncConflict: async () => 'cloud',
    });
    await resumed.activateLocal('reader');
    bridge.changePreference('quranReaderStyles', 'showTajweedRules', true);
    await resumed.syncRemote('reader', 'session');
    expect(
      posts.every(batch => batch.every(item => item.key !== 'playbackRate')),
    ).toBe(true);
    expect(posts[0]).toEqual([
      {group: 'quranReaderStyles', key: 'showTajweedRules', value: true},
    ]);
    expect(storage.requireState('reader').syncedPreferences?.audio).toEqual({
      playbackRate: 4,
    });
    await resumed.deactivate();
  });

  test.each(['local', 'cloud'] as const)(
    'legacy preference snapshots persist a barrier across activation/restart until explicit %s reconciliation',
    async choice => {
      await AsyncStorage.clear();
      const storage = new QfSettingsStorage();
      const saved = emptyState();
      saved.initialized = true;
      saved.localDocuments = documents();
      saved.localPreferences = preferences();
      saved.localPreferenceFingerprint = JSON.stringify(preferences());
      saved.preferencePending = preferences();
      delete saved.syncedPreferences;
      delete saved.syncedLocalPreferences;
      await storage.save('legacy-reader', saved);
      const api = fakeApi();
      api.cloudPreferences.audio = {playbackRate: 1.5, future: {kept: true}};
      const bridge = new MemoryBridge();
      const choose = jest.fn(async () => choice);
      const create = () =>
        new QfSettingsSyncCoordinator({
          api: api as never,
          storage,
          bridge,
          chooseFirstSyncConflict: choose,
        });
      const first = create();
      await first.activateLocal('legacy-reader');
      expect(await storage.load('legacy-reader')).toMatchObject({
        needsReconciliation: true,
        preferencePending: preferences(),
      });
      expect(api.preferencePuts).toEqual([]);
      await first.deactivate();
      const resumed = create();
      await resumed.activateLocal('legacy-reader');
      api.getPreferences.mockRejectedValueOnce(
        new BayaanSettingsApiError(503, 'unavailable'),
      );
      await expect(
        resumed.syncRemote('legacy-reader', 'session'),
      ).rejects.toMatchObject({status: 503});
      expect(choose).not.toHaveBeenCalled();
      expect(api.preferencePuts).toEqual([]);
      expect(await storage.load('legacy-reader')).toMatchObject({
        needsReconciliation: true,
        preferencePending: preferences(),
      });
      await resumed.syncRemote('legacy-reader', 'session');
      expect(choose).toHaveBeenCalledTimes(1);
      expect(api.cloudPreferences.audio.playbackRate).toBe(
        choice === 'local' ? 1 : 1.5,
      );
      expect(api.cloudPreferences.audio.future).toEqual({kept: true});
      expect(await storage.load('legacy-reader')).toMatchObject({
        needsReconciliation: false,
        preferencePending: null,
      });
      expect((await storage.load('other-reader')).initialized).toBe(false);
      await resumed.deactivate();
      const last = create();
      await last.activateLocal('legacy-reader');
      await last.syncRemote('legacy-reader', 'session');
      expect(choose).toHaveBeenCalledTimes(1);
      await last.deactivate();
    },
  );

  test.each(['healthy', 'unavailable', 'revoked'] as const)(
    'pending preference pull retains opaque values and applies only healthy siblings (%s)',
    async outcome => {
      const api = fakeApi();
      const storage = new MemoryStorage();
      const bridge = new MemoryBridge();
      const subject = coordinator(api, storage, bridge).value;
      await subject.activateLocal('reader');
      await subject.syncRemote('reader', 'session');
      api.preferencePuts.length = 0;
      bridge.changePreference('quranReaderStyles', 'quranTextFontScale', 8);
      await subject.deactivate();
      await subject.activateLocal('reader');
      const before = storage.requireState('reader');
      api.cloudPreferences.audio.playbackRate = 1.5;
      api.cloudPreferences.quranReaderStyles.quranTextFontScale = {
        future: 'opaque',
      };
      api.cloudPreferences.tafsirs.selectedTafsirs = 'unsupported';
      if (outcome !== 'healthy')
        api.getPreferences.mockRejectedValueOnce(
          new BayaanSettingsApiError(
            outcome === 'revoked' ? 401 : 503,
            outcome,
          ),
        );
      const boundary = subject as unknown as {
        generation: number;
        pullCurrent(
          account: string,
          token: string,
          generation: number,
        ): Promise<void>;
      };
      const pull = boundary.pullCurrent(
        'reader',
        'session',
        boundary.generation,
      );
      if (outcome === 'healthy') await pull;
      else
        await expect(pull).rejects.toMatchObject({
          status: outcome === 'revoked' ? 401 : 503,
        });
      const after = storage.requireState('reader');
      expect(after.preferencePending).toEqual(before.preferencePending);
      expect(api.preferencePuts).toEqual([]);
      if (outcome === 'healthy') {
        expect(
          bridge.currentPreferences.find(item => item.key === 'playbackRate')
            ?.value,
        ).toBe(1.5);
        expect(after.syncedPreferences).toMatchObject({
          quranReaderStyles: {quranTextFontScale: {future: 'opaque'}},
          tafsirs: {selectedTafsirs: 'unsupported'},
        });
        expect(
          after.syncedLocalPreferences?.find(
            item => item.key === 'quranTextFontScale',
          )?.value,
        ).toBe(5);
        await subject.syncRemote('reader', 'session');
        expect(api.preferencePuts).toEqual([
          [{group: 'quranReaderStyles', key: 'quranTextFontScale', value: 8}],
        ]);
        expect(api.cloudPreferences.audio.playbackRate).toBe(1.5);
        expect(api.cloudPreferences.tafsirs.selectedTafsirs).toBe(
          'unsupported',
        );
      } else {
        expect(after.syncedPreferences).toEqual(before.syncedPreferences);
        expect(after.syncedLocalPreferences).toEqual(
          before.syncedLocalPreferences,
        );
      }
      await subject.deactivate();
    },
  );

  test('preference retry timer honors backoff, replays the whole submitted delta and sends later edits separately', async () => {
    jest.useFakeTimers();
    const api = fakeApi();
    const storage = new MemoryStorage();
    const bridge = new MemoryBridge();
    const subject = coordinator(api, storage, bridge).value;
    await subject.activateLocal('reader');
    await subject.syncRemote('reader', 'session');
    subject.setRemoteAvailable(true);
    api.preferencePuts.length = 0;
    const normal = api.putPreferences.getMockImplementation()!;
    api.putPreferences.mockImplementationOnce(async (_token, batch) => {
      api.preferencePuts.push(structuredClone(batch));
      throw new BayaanSettingsApiError(429, 'backoff', 20_000);
    });
    bridge.changePreference('audio', 'playbackRate', 1.5);
    bridge.changePreference('quranReaderStyles', 'showTajweedRules', true);
    await jest.advanceTimersByTimeAsync(1);
    await subject.waitForIdle();
    const submitted = storage.requireState('reader').preferenceInFlight;
    expect(submitted).toHaveLength(2);
    await jest.advanceTimersByTimeAsync(19_999);
    expect(api.preferencePuts).toHaveLength(1);
    // Make a live edit without advancing the debounce; the retry must ACK only
    // submitted keys and queue the newer value for a separate capture delivery.
    bridge.changePreference('audio', 'playbackRate', 2);
    await jest.advanceTimersByTimeAsync(1);
    await subject.waitForIdle();
    expect(api.preferencePuts[1]).toEqual(submitted);
    await jest.advanceTimersByTimeAsync(2);
    await subject.waitForIdle();
    expect(api.preferencePuts[2]).toEqual([
      {group: 'audio', key: 'playbackRate', value: 2},
    ]);
    expect(api.preferencePuts).toHaveLength(3);
    expect(storage.requireState('reader').preferencePending).toBeNull();
    expect(normal).toBeDefined();
    await subject.deactivate();
  });
  test.each([false, true])(
    'two offline devices submit only changed keys, retaining remote siblings and opaque values (restart=%s)',
    async restart => {
      const api = fakeApi();
      const aStorage = new MemoryStorage();
      const bStorage = new MemoryStorage();
      const aBridge = new MemoryBridge();
      const bBridge = new MemoryBridge();
      const a = coordinator(api, aStorage, aBridge).value;
      let b = coordinator(api, bStorage, bBridge, 'cloud').value;
      await a.activateLocal('reader');
      await a.syncRemote('reader', 'a');
      await b.activateLocal('reader');
      await b.syncRemote('reader', 'b');
      api.preferencePuts.length = 0;
      bBridge.changePreference('quranReaderStyles', 'quranTextFontScale', 8);
      await b.deactivate();
      expect(bStorage.requireState('reader').preferencePending).toEqual([
        {group: 'quranReaderStyles', key: 'quranTextFontScale', value: 8},
      ]);
      aBridge.changePreference('audio', 'playbackRate', 1.5);
      await a.syncRemote('reader', 'a');
      api.cloudPreferences.future = {unknownKey: {nested: ['keep']}};
      api.cloudPreferences.tafsirs.selectedTafsirs = 'future-opaque-format';
      b = restart ? coordinator(api, bStorage, bBridge, 'cloud').value : b;
      await b.activateLocal('reader');
      await b.syncRemote('reader', 'b');
      expect(api.preferencePuts).toEqual([
        [{group: 'audio', key: 'playbackRate', value: 1.5}],
        [{group: 'quranReaderStyles', key: 'quranTextFontScale', value: 8}],
      ]);
      expect(
        bBridge.currentPreferences.find(item => item.key === 'playbackRate')
          ?.value,
      ).toBe(1.5);
      expect(api.cloudPreferences.tafsirs.selectedTafsirs).toBe(
        'future-opaque-format',
      );
      expect(bStorage.requireState('reader').syncedPreferences).toMatchObject({
        future: {unknownKey: {nested: ['keep']}},
        tafsirs: {selectedTafsirs: 'future-opaque-format'},
      });
      await b.syncRemote('reader', 'b');
      expect(api.preferencePuts).toHaveLength(2);
      await a.deactivate();
      await b.deactivate();
    },
  );

  test('coalesces multiple local keys, retries the complete saved submitted delta, and retains newer edits after restart', async () => {
    const api = fakeApi();
    const storage = new MemoryStorage();
    const bridge = new MemoryBridge();
    const first = coordinator(api, storage, bridge).value;
    await first.activateLocal('reader');
    await first.syncRemote('reader', 'session');
    api.preferencePuts.length = 0;
    bridge.changePreference('audio', 'playbackRate', 1.25);
    bridge.changePreference('audio', 'playbackRate', 1.5);
    bridge.changePreference('quranReaderStyles', 'showTajweedRules', true);
    const normal = api.putPreferences.getMockImplementation()!;
    api.putPreferences.mockImplementationOnce(async (_token, batch) => {
      api.preferencePuts.push(structuredClone(batch));
      // Provider applied only the first submitted key before losing its reply.
      const firstKey = batch[0];
      api.cloudPreferences[firstKey.group][firstKey.key] = firstKey.value;
      throw new BayaanSettingsApiError(503, 'failed-batch');
    });
    await expect(first.syncRemote('reader', 'session')).rejects.toMatchObject({
      status: 503,
    });
    const submitted = storage.requireState('reader').preferenceInFlight;
    expect(api.cloudPreferences.quranReaderStyles.showTajweedRules).toBe(true);
    expect(api.cloudPreferences.audio.playbackRate).toBe(1);
    expect(submitted).toEqual([
      {group: 'quranReaderStyles', key: 'showTajweedRules', value: true},
      {group: 'audio', key: 'playbackRate', value: 1.5},
    ]);
    bridge.changePreference('audio', 'playbackRate', 2);
    bridge.changePreference('quranReaderStyles', 'translationFontScale', 6);
    await first.deactivate();
    const resumed = coordinator(api, storage, bridge).value;
    await resumed.activateLocal('reader');
    await resumed.syncRemote('reader', 'session');
    expect(api.preferencePuts[1]).toEqual(submitted);
    expect(api.preferencePuts[2]).toEqual([
      {group: 'quranReaderStyles', key: 'translationFontScale', value: 6},
      {group: 'audio', key: 'playbackRate', value: 2},
    ]);
    expect(storage.requireState('reader')).toMatchObject({
      preferencePending: null,
      preferenceInFlight: null,
    });
    expect(normal).toBeDefined();
    await resumed.deactivate();
  });

  test.each(['send', 'handoff', 'switch'] as const)(
    'preserves newer preference edits during %s without acknowledging unsent values',
    async stage => {
      const api = fakeApi();
      const storage = new MemoryStorage();
      const bridge = new MemoryBridge();
      const subject = coordinator(api, storage, bridge).value;
      await subject.activateLocal('reader');
      await subject.syncRemote('reader', 'session');
      api.preferencePuts.length = 0;
      let release!: () => void;
      let reached!: () => void;
      const started = new Promise<void>(resolve => {
        reached = resolve;
      });
      const normal = api.putPreferences.getMockImplementation()!;
      api.putPreferences.mockImplementationOnce(async (token, batch) => {
        await new Promise<void>(resolve => {
          release = resolve;
          reached();
        });
        await normal(token, batch);
      });
      bridge.changePreference('audio', 'playbackRate', 1.5);
      const syncing = subject.syncRemote('reader', 'session');
      await started;
      bridge.changePreference('audio', 'playbackRate', 1);
      bridge.changePreference('quranReaderStyles', 'translationFontScale', 7);
      const departure =
        stage === 'handoff'
          ? subject.deactivate()
          : stage === 'switch'
            ? subject.activateLocal('other-reader')
            : null;
      release();
      await syncing;
      if (departure) {
        await departure;
        expect(storage.requireState('reader').preferenceInFlight).toEqual([
          {group: 'audio', key: 'playbackRate', value: 1.5},
        ]);
        if (stage === 'switch') {
          expect(
            storage.states.get('other-reader')?.preferencePending ?? null,
          ).toBeNull();
          await subject.deactivate();
        }
        const resumed = coordinator(api, storage, bridge).value;
        await resumed.activateLocal('reader');
        await resumed.syncRemote('reader', 'session');
        await resumed.deactivate();
      } else await subject.deactivate();
      expect(api.cloudPreferences.audio.playbackRate).toBe(1);
      expect(api.cloudPreferences.quranReaderStyles.translationFontScale).toBe(
        7,
      );
      expect(storage.requireState('reader')).toMatchObject({
        preferencePending: null,
        preferenceInFlight: null,
      });
    },
  );

  test.each([false, true])(
    'cloud unsupported reading retains raw identity across restart, healthy siblings and later edits (readOnly=%s)',
    async readOnly => {
      const remote = {
        mushaf: {
          key: 'mushaf' as const,
          etag: 'hisham-etag',
          readOnly,
          ...(readOnly ? {schemaVersion: 2} : {}),
          value: {
            rewayah: 'hisham',
            showTranslation: false,
            future: {kept: true},
          },
        },
      };
      const api = fakeApi(remote);
      const storage = new MemoryStorage();
      const bridge = new MemoryBridge();
      bridge.currentDocuments.mushaf = {rewayah: 'hafs', showTranslation: true};
      bridge.sanitizeDocument = sanitizeRemoteDocument;
      api.cloudPreferences.audio = {playbackRate: 1.5};
      let subject = coordinator(api, storage, bridge, 'cloud').value;
      await subject.activateLocal('reader');
      await subject.syncRemote('reader', 'session');
      expect(bridge.currentDocuments.mushaf).toEqual({
        rewayah: 'hafs',
        showTranslation: false,
      });
      expect(api.puts.filter(item => item.key === 'mushaf')).toEqual([]);
      expect(storage.requireState('reader')).toMatchObject({
        syncedDocuments: {mushaf: remote.mushaf.value},
        syncedLocalDocuments: {mushaf: {rewayah: 'hafs'}},
        etags: {mushaf: 'hisham-etag'},
      });
      await subject.deactivate();
      subject = coordinator(api, storage, bridge, 'cloud').value;
      await subject.activateLocal('reader');
      api.cloudPreferences.audio.playbackRate = 1.75;
      await subject.syncRemote('reader', 'session');
      expect(
        bridge.currentPreferences.find(item => item.key === 'playbackRate')
          ?.value,
      ).toBe(1.75);
      expect(api.puts.filter(item => item.key === 'mushaf')).toEqual([]);
      bridge.changeDocument('mushaf', {
        ...bridge.currentDocuments.mushaf,
        showTranslation: true,
      });
      await subject.syncRemote('reader', 'session');
      const mushafPuts = api.puts.filter(item => item.key === 'mushaf');
      if (readOnly) {
        expect(mushafPuts).toEqual([]);
        expect(storage.requireState('reader').pending.mushaf?.changes).toEqual([
          {path: ['showTranslation'], value: true},
        ]);
      } else {
        expect(mushafPuts).toHaveLength(1);
        expect(mushafPuts[0].etag).toBe('hisham-etag');
        expect(JSON.parse(mushafPuts[0].body).value).toEqual({
          rewayah: 'hisham',
          showTranslation: true,
          future: {kept: true},
        });
      }
      await subject.deactivate();
    },
  );
  test.each(['document', 'preferences'] as const)(
    'applies healthy documents without erasing an unavailable %s baseline',
    async unavailable => {
      const remote: Partial<
        Record<SettingsDocumentKey, RemoteSettingsDocument>
      > = {};
      const api = fakeApi(remote);
      const storage = new MemoryStorage();
      const bridge = new MemoryBridge();
      const subject = coordinator(api, storage, bridge).value;
      await subject.activateLocal('account-a');
      await subject.syncRemote('account-a', 'session-a');
      const before = structuredClone(storage.requireState('account-a'));
      api.puts.length = 0;
      api.preferencePuts.length = 0;
      remote.appearance = {
        key: 'appearance',
        etag: 'new-appearance-etag',
        value: {themeMode: 'dark'},
      };
      const failure = new BayaanSettingsApiError(503, 'unavailable');
      if (unavailable === 'document') {
        api.getDocument.mockImplementation(async (_token, key) => {
          if (key === 'audio') throw failure;
          return remote[key] ?? null;
        });
      } else {
        api.getPreferences.mockRejectedValue(failure);
      }
      await expect(subject.syncRemote('account-a', 'session-a')).rejects.toBe(
        failure,
      );
      expect(bridge.currentDocuments.appearance.themeMode).toBe('dark');
      const partial = storage.requireState('account-a');
      expect(partial.etags.appearance).toBe('new-appearance-etag');
      expect(partial.syncedDocuments.audio).toEqual(
        before.syncedDocuments.audio,
      );
      expect(partial.etags.audio).toBe(before.etags.audio);
      expect(partial.readOnlyDocuments?.audio).toBe(
        before.readOnlyDocuments?.audio,
      );
      if (unavailable === 'preferences') {
        expect(partial.syncedPreferenceFingerprint).toBe(
          before.syncedPreferenceFingerprint,
        );
        expect(partial.preferencePending).toEqual(before.preferencePending);
      }
      expect(api.puts).toEqual([]);
      expect(api.preferencePuts).toEqual([]);
      api.getDocument.mockImplementation(
        async (_token, key) => remote[key] ?? null,
      );
      api.getPreferences.mockResolvedValue({});
      await subject.syncRemote('account-a', 'session-a');
      expect(storage.requireState('account-a').initialized).toBe(true);
      await subject.deactivate();
    },
  );

  test.each(['document', 'preferences'] as const)(
    'treats a 401 from %s as account-wide revocation before applying any document',
    async revokedAt => {
      const remote: Partial<
        Record<SettingsDocumentKey, RemoteSettingsDocument>
      > = {};
      const api = fakeApi(remote);
      const storage = new MemoryStorage();
      const bridge = new MemoryBridge();
      const subject = coordinator(api, storage, bridge).value;
      await subject.activateLocal('account-a');
      await subject.syncRemote('account-a', 'session-a');
      const before = structuredClone(storage.requireState('account-a'));
      remote.appearance = {
        key: 'appearance',
        etag: 'must-not-adopt',
        value: {themeMode: 'dark'},
      };
      const failure = new BayaanSettingsApiError(401, 'revoked');
      if (revokedAt === 'document') {
        api.getDocument.mockImplementation(async (_token, key) => {
          if (key === 'audio') throw failure;
          return remote[key] ?? null;
        });
      } else {
        api.getPreferences.mockRejectedValue(failure);
      }
      await expect(subject.syncRemote('account-a', 'session-a')).rejects.toBe(
        failure,
      );
      expect(bridge.currentDocuments.appearance.themeMode).toBe('system');
      expect(storage.requireState('account-a').etags.appearance).toBe(
        before.etags.appearance,
      );
      await subject.deactivate();
    },
  );

  test('keeps initial reconciliation incomplete and writes nothing after a partial fetch failure', async () => {
    const api = fakeApi({
      appearance: {
        key: 'appearance',
        etag: 'cloud-etag',
        value: {themeMode: 'dark'},
      },
    });
    const storage = new MemoryStorage();
    const bridge = new MemoryBridge();
    const subject = coordinator(api, storage, bridge, 'cloud');
    const failure = new BayaanSettingsApiError(503, 'unavailable');
    api.getDocument.mockRejectedValueOnce(failure);
    await subject.value.activateLocal('account-a');
    await expect(
      subject.value.syncRemote('account-a', 'session-a'),
    ).rejects.toBe(failure);
    expect(subject.choose).not.toHaveBeenCalled();
    expect(api.puts).toEqual([]);
    expect(api.preferencePuts).toEqual([]);
    expect(storage.states.get('account-a')?.initialized ?? false).toBe(false);
    expect(bridge.currentDocuments.appearance.themeMode).toBe('system');
    await subject.value.deactivate();
  });

  test.each(['debounce', 'retry', 'late-account'] as const)(
    'routes background-owned 401 through token-bound revocation (%s)',
    async path => {
      jest.useFakeTimers();
      const api = fakeApi();
      const storage = new MemoryStorage();
      const bridge = new MemoryBridge();
      const revoked = jest.fn(async () => undefined);
      const subject = new QfSettingsSyncCoordinator({
        api: api as never,
        storage: storage as unknown as QfSettingsStorage,
        bridge,
        chooseFirstSyncConflict: async () => 'local',
        debounceMs: 1,
        onSessionRevoked: revoked,
      });
      await subject.activateLocal('account-a');
      await subject.syncRemote('account-a', 'session-a');
      subject.setRemoteAvailable(true);
      api.puts.length = 0;
      api.putDocument.mockImplementation(async () => {
        throw new BayaanSettingsApiError(401, 'revoked');
      });
      if (path === 'retry')
        api.putDocument.mockRejectedValueOnce(
          new BayaanSettingsApiError(503, 'unavailable'),
        );
      let reject!: (error: Error) => void;
      if (path === 'late-account')
        api.putDocument.mockImplementationOnce(
          () =>
            new Promise((_resolve, fail) => {
              reject = fail;
            }),
        );
      const settle = async () => {
        for (let i = 0; i < 100; i++) await Promise.resolve();
      };
      bridge.changeDocument('appearance', {themeMode: 'dark'});
      jest.advanceTimersByTime(1);
      await settle();
      if (path === 'retry') {
        jest.advanceTimersByTime(1000);
        await settle();
      }
      if (path === 'late-account') {
        const switching = subject.activateLocal('account-b');
        reject(new BayaanSettingsApiError(401, 'revoked'));
        await switching;
        await settle();
      }
      expect(revoked.mock.calls).toEqual(
        path === 'late-account' ? [] : [['account-a', 'session-a']],
      );
      expect(jest.getTimerCount()).toBe(0);
      const calls = api.putDocument.mock.calls.length;
      bridge.changeDocument('appearance', {themeMode: 'light'});
      jest.advanceTimersByTime(60_000);
      await settle();
      expect(api.putDocument.mock.calls.length).toBe(calls);
      expect(storage.states.get('account-a')?.pending.appearance).toBeDefined();
      await subject.deactivate();
    },
  );

  test('honors a long Retry-After and blocks permanent background failures until explicit sync', async () => {
    jest.useFakeTimers();
    const api = fakeApi();
    const storage = new MemoryStorage();
    const bridge = new MemoryBridge();
    const subject = coordinator(api, storage, bridge).value;
    await subject.activateLocal('account-a');
    await subject.syncRemote('account-a', 'session-a');
    subject.setRemoteAvailable(true);
    api.putDocument.mockRejectedValueOnce(
      new BayaanSettingsApiError(429, 'limited', 120_000),
    );
    api.putDocument.mockRejectedValueOnce(
      new BayaanSettingsApiError(400, 'invalid'),
    );
    const settle = async () => {
      for (let i = 0; i < 100; i++) await Promise.resolve();
    };
    bridge.changeDocument('appearance', {themeMode: 'dark'});
    jest.advanceTimersByTime(1);
    await settle();
    const initial = api.putDocument.mock.calls.length;
    jest.advanceTimersByTime(119_999);
    await settle();
    expect(api.putDocument.mock.calls.length).toBe(initial);
    jest.advanceTimersByTime(1);
    await settle();
    expect(api.putDocument.mock.calls.length).toBe(initial + 1);
    bridge.changeDocument('appearance', {themeMode: 'light'});
    jest.advanceTimersByTime(300_000);
    await settle();
    expect(api.putDocument.mock.calls.length).toBe(initial + 1);
    // The 400 on replay does not disprove the earlier ambiguous delivery.
    expect(storage.states.get('account-a')?.pending.appearance?.attempted).toBe(
      true,
    );
    await subject.syncRemote('account-a', 'session-a');
    expect(storage.states.get('account-a')?.pending.appearance).toBeUndefined();
    await subject.deactivate();
  });

  test('a definitive first rejection releases rejected bytes and blocks background retries', async () => {
    jest.useFakeTimers();
    const api = fakeApi();
    const storage = new MemoryStorage();
    const bridge = new MemoryBridge();
    const subject = coordinator(api, storage, bridge).value;
    await subject.activateLocal('account-a');
    await subject.syncRemote('account-a', 'session-a');
    subject.setRemoteAvailable(true);
    api.putDocument.mockRejectedValueOnce(
      new BayaanSettingsApiError(400, 'invalid'),
    );
    bridge.changeDocument('appearance', {themeMode: 'dark'});
    await jest.advanceTimersByTimeAsync(1000);
    await subject.waitForIdle();
    expect(
      storage.states.get('account-a')?.pending.appearance?.attempted,
    ).not.toBe(true);
    const calls = api.putDocument.mock.calls.length;
    bridge.changeDocument('appearance', {themeMode: 'light'});
    await jest.advanceTimersByTimeAsync(120_000);
    await subject.waitForIdle();
    expect(api.putDocument.mock.calls.length).toBe(calls);
    await subject.syncRemote('account-a', 'session-a');
    expect(storage.states.get('account-a')?.pending.appearance).toBeUndefined();
    await subject.deactivate();
  });

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

class DeferredApplicationBridge extends MemoryBridge {
  effect: (() => Promise<void>) | undefined;
  afterApply: (() => void) | undefined;

  async applyDocuments(
    remote: Partial<SettingsDocuments>,
    isCurrent: () => boolean = () => true,
  ): Promise<SettingsDocuments> {
    const before = JSON.stringify(this.captureDocuments());
    if (remote.mushaf && this.effect) {
      const effect = this.effect;
      this.effect = undefined;
      await effect();
      if (before !== JSON.stringify(this.captureDocuments())) {
        throw new Error('Settings application superseded');
      }
    }
    if (!isCurrent()) throw new Error('Settings application superseded');
    super.applyDocuments(remote);
    this.listeners.forEach(listener => listener());
    const applied = this.captureDocuments();
    this.afterApply?.();
    return applied;
  }
}

function applicationGate(bridge: DeferredApplicationBridge) {
  let started!: () => void;
  let release!: () => void;
  const reached = new Promise<void>(resolve => {
    started = resolve;
  });
  const gate = new Promise<void>(resolve => {
    release = resolve;
  });
  bridge.effect = async () => {
    started();
    await gate;
  };
  return {reached, release};
}

describe('async settings application boundaries', () => {
  test('preference edits during muted document application remain local delta while healthy siblings converge', async () => {
    const remote = {
      mushaf: {
        key: 'mushaf' as const,
        value: {showTranslation: false},
        etag: 'first',
      },
    };
    const api = fakeApi(remote);
    const storage = new MemoryStorage();
    const bridge = new DeferredApplicationBridge();
    const subject = coordinator(api, storage, bridge, 'cloud').value;
    await subject.activateLocal('reader');
    await subject.syncRemote('reader', 'session');
    api.preferencePuts.length = 0;
    api.cloudPreferences.audio.playbackRate = 1.5;
    const gate = applicationGate(bridge);
    const syncing = subject.syncRemote('reader', 'session');
    await gate.reached;
    bridge.changePreference('quranReaderStyles', 'translationFontScale', 8);
    gate.release();
    await syncing;
    expect(api.preferencePuts).toEqual([
      [{group: 'quranReaderStyles', key: 'translationFontScale', value: 8}],
    ]);
    expect(
      bridge.currentPreferences.find(item => item.key === 'playbackRate')
        ?.value,
    ).toBe(1.5);
    expect(storage.requireState('reader').preferencePending).toBeNull();
    await subject.deactivate();
  });
  const cloud = () => ({
    mushaf: {
      key: 'mushaf' as const,
      value: {showTranslation: false},
      etag: 'cloud-etag',
    },
  });

  test('waits for application before committing baselines and suppresses remote notifications', async () => {
    const api = fakeApi(cloud());
    const storage = new MemoryStorage();
    const bridge = new DeferredApplicationBridge();
    const subject = coordinator(api, storage, bridge, 'cloud').value;
    await subject.activateLocal('account-a');
    const gate = applicationGate(bridge);
    const syncing = subject.syncRemote('account-a', 'session');
    await gate.reached;
    expect(storage.states.get('account-a')?.initialized).not.toBe(true);
    expect(api.puts).toHaveLength(0);
    expect(bridge.currentDocuments.mushaf.showTranslation).toBe(true);
    gate.release();
    await syncing;
    expect(
      storage.requireState('account-a').syncedLocalDocuments.mushaf,
    ).toEqual({showTranslation: false});
    expect((subject as unknown as {localRevision: number}).localRevision).toBe(
      0,
    );
    await subject.deactivate();
  });

  test('failed cache effect cannot initialize or replace reconciliation evidence', async () => {
    const api = fakeApi(cloud());
    const storage = new MemoryStorage();
    const bridge = new DeferredApplicationBridge();
    const saved = emptyState();
    saved.needsReconciliation = true;
    saved.etags.mushaf = 'prior-etag';
    storage.states.set('account-a', structuredClone(saved));
    const subject = coordinator(api, storage, bridge, 'cloud').value;
    await subject.activateLocal('account-a');
    bridge.effect = async () => {
      throw new Error('cache unavailable');
    };
    await expect(subject.syncRemote('account-a', 'session')).rejects.toThrow(
      'cache unavailable',
    );
    expect(storage.requireState('account-a')).toEqual(saved);
    expect(bridge.currentDocuments.mushaf.showTranslation).toBe(true);
    expect(api.puts).toHaveLength(0);
    await subject.deactivate();
  });

  test('account departure while applying prevents stale publication and baseline capture', async () => {
    const api = fakeApi(cloud());
    const storage = new MemoryStorage();
    const bridge = new DeferredApplicationBridge();
    const subject = coordinator(api, storage, bridge, 'cloud').value;
    await subject.activateLocal('account-a');
    const gate = applicationGate(bridge);
    const syncing = subject.syncRemote('account-a', 'session');
    const rejection = expect(syncing).rejects.toThrow('superseded');
    await gate.reached;
    const departing = subject.activateLocal('account-b');
    gate.release();
    await rejection;
    await departing;
    expect(bridge.currentDocuments.mushaf.showTranslation).toBe(true);
    expect(storage.requireState('account-a').initialized).toBe(false);
    expect(api.puts).toHaveLength(0);
    await subject.deactivate();
  });

  test('a manual edit during muted async application survives and remains durable local intent', async () => {
    const api = fakeApi(cloud());
    const storage = new MemoryStorage();
    const bridge = new DeferredApplicationBridge();
    const subject = coordinator(api, storage, bridge, 'cloud').value;
    await subject.activateLocal('account-a');
    const gate = applicationGate(bridge);
    const syncing = subject.syncRemote('account-a', 'session');
    const rejection = expect(syncing).rejects.toThrow('superseded');
    await gate.reached;
    bridge.changeDocument('mushaf', {showTranslation: true, showWBW: true});
    gate.release();
    await rejection;
    expect(bridge.currentDocuments.mushaf).toEqual({
      showTranslation: true,
      showWBW: true,
    });
    expect(api.puts).toHaveLength(0);
    await subject.deactivate();
    expect(storage.requireState('account-a').localDocuments.mushaf).toEqual({
      showTranslation: true,
      showWBW: true,
    });
    expect(storage.requireState('account-a').initialized).toBe(false);
  });

  test('manual edits just after projection are uploaded as edits, not mistaken for applied cloud baseline', async () => {
    const remote = cloud();
    const api = fakeApi(remote);
    const storage = new MemoryStorage();
    const bridge = new DeferredApplicationBridge();
    const subject = coordinator(api, storage, bridge, 'cloud').value;
    await subject.activateLocal('account-a');
    bridge.afterApply = () => {
      bridge.afterApply = undefined;
      bridge.changeDocument('mushaf', {showTranslation: true});
    };
    await subject.syncRemote('account-a', 'session');
    expect(api.puts.filter(call => call.key === 'mushaf')).toHaveLength(1);
    expect(remote.mushaf.value).toEqual({showTranslation: true});
    expect(storage.requireState('account-a').pending).toEqual({});
    await subject.deactivate();
  });

  test('muted edits to a later document survive awaits while pulling earlier keys', async () => {
    const remote = cloud();
    const api = fakeApi(remote);
    const storage = new MemoryStorage();
    const bridge = new DeferredApplicationBridge();
    const subject = coordinator(api, storage, bridge, 'cloud').value;
    await subject.activateLocal('account-a');
    await subject.syncRemote('account-a', 'session');
    bridge.afterApply = () => {
      bridge.afterApply = undefined;
      bridge.changeDocument('audio', {shuffle: true});
    };
    await subject.syncRemote('account-a', 'session');
    expect(bridge.currentDocuments.audio.shuffle).toBe(true);
    expect(
      api.puts
        .filter(call => call.key === 'audio')
        .map(call => JSON.parse(call.body).value),
    ).toContainEqual({shuffle: true});
    expect(storage.requireState('account-a').pending).toEqual({});
    await subject.deactivate();
  });

  test('initialized pull cache failure keeps the previous durable mushaf baseline and ETag', async () => {
    const remote = cloud();
    const api = fakeApi(remote);
    const storage = new MemoryStorage();
    const bridge = new DeferredApplicationBridge();
    const subject = coordinator(api, storage, bridge, 'cloud').value;
    await subject.activateLocal('account-a');
    await subject.syncRemote('account-a', 'session');
    const before = structuredClone(storage.requireState('account-a'));
    remote.mushaf = {
      ...remote.mushaf,
      value: {showTranslation: true},
      etag: 'new-cloud-etag',
    };
    bridge.effect = async () => {
      throw new Error('cache unavailable');
    };
    await expect(subject.syncRemote('account-a', 'session')).rejects.toThrow(
      'cache unavailable',
    );
    expect(
      storage.requireState('account-a').syncedLocalDocuments.mushaf,
    ).toEqual(before.syncedLocalDocuments.mushaf);
    expect(storage.requireState('account-a').etags.mushaf).toBe(
      before.etags.mushaf,
    );
    expect(bridge.currentDocuments.mushaf.showTranslation).toBe(false);
    await subject.deactivate();
  });
});
