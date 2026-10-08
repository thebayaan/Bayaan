import type {ContentApi, ManifestResult} from '../contentApi';
import {
  createMemoryContentRegistry,
  type ContentRegistry,
} from '../contentRegistry';
import type {ContentInstaller, ContentKind, Manifest} from '@/types/content';

type ContentSync = typeof import('../contentSync');

interface MockState {
  branding: {tafsirProvider?: string; contentApiBase?: string};
  api: jest.Mocked<ContentApi>;
  registry: ContentRegistry;
  installer: jest.Mocked<ContentInstaller>;
  downloaded: jest.Mock<Promise<{identifier: string}[]>, []>;
  track: jest.Mock;
  notify: jest.Mock;
  listeners: ((status: string) => void)[];
  events: string[];
  now: number;
}

let mockState: MockState;

jest.mock('expo-sqlite', () => ({openDatabaseAsync: jest.fn()}));
// Only AppState is replaced; everything else falls through to the real module.
jest.mock('react-native', () =>
  Object.create(jest.requireActual('react-native'), {
    AppState: {
      value: {
        addEventListener: (
          _event: string,
          handler: (status: string) => void,
        ) => {
          mockState.listeners.push(handler);
          return {
            remove: () => {
              mockState.listeners = mockState.listeners.filter(
                h => h !== handler,
              );
            },
          };
        },
      },
    },
  }),
);
jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {fetch: async () => ({type: 'wifi'})},
}));
jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: {SHA256: 'SHA-256'},
  digestStringAsync: async () => 's',
}));
jest.mock('@/config/branding', () => ({
  __esModule: true,
  get default() {
    return mockState.branding;
  },
}));
jest.mock('@/services/analytics/AnalyticsService', () => ({
  analyticsService: {
    trackContentEvent: (...args: unknown[]) => mockState.track(...args),
  },
}));
jest.mock('@/services/tafseer/TafseerDbService', () => ({
  tafseerDbService: {getDownloadedTafaseer: () => mockState.downloaded()},
}));
jest.mock('../contentNotices', () => ({
  showWithdrawalNotice: (notice: unknown) => mockState.notify(notice),
}));
jest.mock('../tafsirInstaller', () => ({
  createTafsirInstaller: () => mockState.installer,
}));
jest.mock('../contentRegistry', () => ({
  ...jest.requireActual('../contentRegistry'),
  createSqliteContentRegistry: () => mockState.registry,
}));
jest.mock('../contentApi', () => ({
  ...jest.requireActual('../contentApi'),
  createContentApi: () => mockState.api,
}));

const KEY = 'qf:tafsirs:169';
const DAY = 86_400_000;
const HOUR = 3_600_000;

function entry(key: string, status: 'active' | 'withdrawn' = 'active') {
  return {
    key,
    kind: 'tafsir' as const,
    source: 'qf',
    version: 3,
    status,
    upstream_schema_version: 1,
    bytes: 1000,
    sha256: 's',
  };
}

function ok(resources: Manifest['resources'], paused = false): ManifestResult {
  return {
    status: 'ok',
    manifest: {format: 1, generated_at: 'x', paused, resources},
    etag: null,
  };
}

function envelope(key: string): string {
  return JSON.stringify({
    envelope: 1,
    key,
    version: 3,
    source: 'qf',
    fetched_at: 'x',
    snapshot: {
      resource_group: 'tafsirs',
      resource_id: 1,
      schema_version: 1,
      records: [],
    },
  });
}

interface Gate {
  wait: Promise<void>;
  open: () => void;
}

function gate(): Gate {
  let open = (): void => undefined;
  const wait = new Promise<void>(resolve => {
    open = resolve;
  });
  return {wait, open};
}

async function settle(): Promise<void> {
  for (let i = 0; i < 30; i++) {
    await new Promise<void>(resolve => setTimeout(resolve, 0));
  }
}

function load(): ContentSync {
  let loaded: ContentSync | undefined;
  jest.isolateModules(() => {
    loaded = require('../contentSync');
  });
  if (!loaded) throw new Error('contentSync not loaded');
  return loaded;
}

function foreground(status = 'active'): void {
  for (const listener of [...mockState.listeners]) listener(status);
}

const savedUrl = process.env.EXPO_PUBLIC_BAYAAN_API_URL;

beforeEach(() => {
  delete process.env.EXPO_PUBLIC_BAYAAN_API_URL;
  const events: string[] = [];
  mockState = {
    branding: {contentApiBase: 'https://api.test'},
    events,
    now: 1_000_000_000_000,
    listeners: [],
    registry: createMemoryContentRegistry(),
    track: jest.fn(),
    notify: jest.fn(),
    downloaded: jest.fn(async () => {
      events.push('migrate');
      return [];
    }),
    installer: {
      kind: 'tafsir',
      supportsSchemaVersion: jest.fn((_version: number) => true),
      install: jest.fn().mockResolvedValue(undefined),
      remove: jest.fn().mockResolvedValue(undefined),
      onWithdrawn: jest.fn().mockResolvedValue(undefined),
    },
    api: {
      fetchManifest: jest.fn(
        async (_kinds: ContentKind[], _etag: string | null) => {
          events.push('check');
          return ok([entry(KEY)]);
        },
      ),
      getDownloadTicket: jest.fn(async (key: string) => {
        events.push(`ticket:${key}`);
        return {url: key, version: 3, sha256: 's', bytes: 1, expires_at: 'x'};
      }),
      fetchText: jest.fn(async (url: string) => envelope(url)),
    },
  };
  jest.spyOn(Date, 'now').mockImplementation(() => mockState.now);
});

afterEach(() => {
  jest.restoreAllMocks();
  if (savedUrl === undefined) delete process.env.EXPO_PUBLIC_BAYAAN_API_URL;
  else process.env.EXPO_PUBLIC_BAYAAN_API_URL = savedUrl;
});

describe('isEngineManagingTafsir gate', () => {
  it('does nothing when a fork sets tafsirProvider', async () => {
    mockState.branding.tafsirProvider = 'fork';
    const sync = load();
    expect(sync.isEngineManagingTafsir()).toBe(false);
    await sync.initContentSync();
    expect(mockState.events).toEqual([]);
    expect(mockState.listeners).toHaveLength(0);
  });

  it('does nothing without an API base URL', async () => {
    mockState.branding = {};
    const sync = load();
    expect(sync.isEngineManagingTafsir()).toBe(false);
    await sync.initContentSync();
    expect(mockState.events).toEqual([]);
    expect(mockState.listeners).toHaveLength(0);
  });
});

describe('initContentSync', () => {
  it('migrates, checks, then auto-installs, exactly once', async () => {
    const sync = load();
    await sync.initContentSync();
    expect(mockState.events).toEqual(['migrate', 'check', `ticket:${KEY}`]);
    expect((await mockState.registry.getState()).autoInstallDone).toBe(true);
    await sync.initContentSync();
    expect(mockState.events).toHaveLength(3);
    expect(mockState.listeners).toHaveLength(1);
  });

  it('ignores a concurrent second init', async () => {
    const sync = load();
    await Promise.all([sync.initContentSync(), sync.initContentSync()]);
    expect(mockState.api.fetchManifest).toHaveBeenCalledTimes(1);
    expect(mockState.listeners).toHaveLength(1);
  });

  it('skips the auto-install when the manifest lists 169 withdrawn or absent, or is paused', async () => {
    for (const result of [
      ok([entry(KEY, 'withdrawn')]),
      ok([entry('qf:tafsirs:16')]),
      ok([entry(KEY)], true),
    ]) {
      mockState.registry = createMemoryContentRegistry();
      mockState.api.fetchManifest.mockResolvedValueOnce(result);
      const sync = load();
      await sync.initContentSync();
      sync.teardownContentSync();
    }
    expect(mockState.api.getDownloadTicket).not.toHaveBeenCalled();
  });

  it('retries a failed migration every cycle and auto-installs only after it succeeds', async () => {
    mockState.downloaded.mockRejectedValueOnce(new Error('db_closed'));
    const sync = load();
    await sync.initContentSync();
    expect(mockState.api.fetchManifest).toHaveBeenCalledTimes(1);
    expect(mockState.api.getDownloadTicket).not.toHaveBeenCalled();
    expect(mockState.track).toHaveBeenCalledWith('failed', {
      key: 'sync',
      version: 0,
      reason: 'db_closed',
    });
    expect((await mockState.registry.getState()).migratedAt).toBeNull();

    foreground();
    await settle();
    expect((await mockState.registry.getState()).migratedAt).not.toBeNull();
    expect(mockState.api.getDownloadTicket).toHaveBeenCalledTimes(1);
  });

  it('a throwing auto-install is reported and the next cycle still checks and retries', async () => {
    const get = mockState.registry.get.bind(mockState.registry);
    let thrown = false;
    mockState.registry.get = async key => {
      if (key === KEY && !thrown) {
        thrown = true;
        throw new Error('registry_locked');
      }
      return get(key);
    };
    const sync = load();
    await sync.initContentSync();
    expect(mockState.track).toHaveBeenCalledWith('failed', {
      key: 'sync',
      version: 0,
      reason: 'registry_locked',
    });
    mockState.now += DAY;
    foreground();
    await settle();
    expect(mockState.api.fetchManifest).toHaveBeenCalledTimes(2);
    expect(mockState.api.getDownloadTicket).toHaveBeenCalledTimes(1);
  });

  it('a throwing check is reported and the auto-install still runs', async () => {
    mockState.api.fetchManifest.mockRejectedValueOnce(new Error('boom'));
    const sync = load();
    await sync.initContentSync();
    expect(mockState.track).toHaveBeenCalledWith('failed', {
      key: 'sync',
      version: 0,
      reason: 'boom',
    });
    expect(mockState.api.getDownloadTicket).toHaveBeenCalledTimes(1);
  });

  it('does not subscribe when torn down during the first cycle', async () => {
    const g = gate();
    mockState.api.fetchManifest.mockImplementationOnce(async () => {
      await g.wait;
      return ok([entry(KEY)]);
    });
    const sync = load();
    const init = sync.initContentSync();
    await settle();
    sync.teardownContentSync();
    g.open();
    await init;
    expect(mockState.listeners).toHaveLength(0);
  });
});

describe('foreground cycles', () => {
  it('runs one cycle on active, none on other states, and no fetch within 24h', async () => {
    const sync = load();
    await sync.initContentSync();
    mockState.now += DAY;
    foreground('background');
    foreground('inactive');
    await settle();
    expect(mockState.api.fetchManifest).toHaveBeenCalledTimes(1);
    foreground();
    await settle();
    expect(mockState.api.fetchManifest).toHaveBeenCalledTimes(2);
    mockState.now += DAY - 1;
    foreground();
    await settle();
    expect(mockState.api.fetchManifest).toHaveBeenCalledTimes(2);
  });

  it('never overlaps cycles', async () => {
    // The migration step runs (and fails) on every cycle until it succeeds,
    // so gating it measures how many cycles are in flight.
    const gates: Gate[] = [];
    let inFlight = 0;
    let maxInFlight = 0;
    mockState.downloaded.mockImplementation(async () => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      const g = gate();
      gates.push(g);
      await g.wait;
      inFlight--;
      throw new Error('not_ready');
    });
    const sync = load();
    const init = sync.initContentSync();
    await settle();
    expect(gates).toHaveLength(1);
    gates[0].open();
    await init;
    foreground();
    foreground();
    foreground();
    for (let i = 1; i <= 3; i++) {
      await settle();
      expect(gates).toHaveLength(i + 1);
      gates[i].open();
    }
    await settle();
    expect(maxInFlight).toBe(1);
    expect(gates).toHaveLength(4);
  });

  it('throttles checks for an hour after a failed check', async () => {
    mockState.api.fetchManifest.mockResolvedValue({
      status: 'error',
      reason: 'down',
    });
    const sync = load();
    await sync.initContentSync();
    foreground();
    await settle();
    mockState.now += HOUR - 1;
    foreground();
    await settle();
    expect(mockState.api.fetchManifest).toHaveBeenCalledTimes(1);
    mockState.now += 1;
    foreground();
    await settle();
    expect(mockState.api.fetchManifest).toHaveBeenCalledTimes(2);
  });

  it('teardown removes the listener', async () => {
    const sync = load();
    await sync.initContentSync();
    sync.teardownContentSync();
    expect(mockState.listeners).toHaveLength(0);
  });
});

describe('user actions', () => {
  it('a removal queued during the in-flight auto-install wins for good', async () => {
    const g = gate();
    mockState.api.getDownloadTicket.mockImplementationOnce(async () => {
      await g.wait;
      return {url: KEY, version: 3, sha256: 's', bytes: 1, expires_at: 'x'};
    });
    const sync = load();
    const init = sync.initContentSync();
    await settle();
    expect(mockState.api.getDownloadTicket).toHaveBeenCalledTimes(1);
    const removal = sync.removeContent(KEY);
    await settle();
    expect(mockState.installer.remove).not.toHaveBeenCalled();
    g.open();
    await Promise.all([init, removal]);
    expect(mockState.installer.remove).toHaveBeenCalledWith(KEY);
    expect(await mockState.registry.get(KEY)).toMatchObject({
      user_removed: true,
      version: 0,
    });
    for (let i = 0; i < 3; i++) {
      mockState.now += DAY;
      foreground();
      await settle();
    }
    expect(mockState.api.getDownloadTicket).toHaveBeenCalledTimes(1);
  });

  it('installContent rethrows and the queue keeps going', async () => {
    const sync = load();
    await sync.initContentSync();
    mockState.api.getDownloadTicket.mockRejectedValueOnce(new Error('offline'));
    await expect(sync.installContent('qf:tafsirs:16')).rejects.toThrow(
      'offline',
    );
    await expect(sync.installContent('qf:tafsirs:16')).resolves.toBeUndefined();
    expect((await mockState.registry.get('qf:tafsirs:16'))?.version).toBe(3);
  });

  it('installContent rejects without deps and for non-tafsir keys', async () => {
    const sync = load();
    await expect(sync.installContent(KEY)).rejects.toThrow(
      'content_sync_unavailable',
    );
    await sync.initContentSync();
    await expect(sync.installContent('qf:translations:20')).rejects.toThrow(
      'unsupported_content_key',
    );
  });

  it('removeContent without deps records the marker and deletes the rows', async () => {
    const sync = load();
    await sync.removeContent('qf:tafsirs:16');
    expect(mockState.installer.remove).toHaveBeenCalledWith('qf:tafsirs:16');
    expect(await mockState.registry.get('qf:tafsirs:16')).toMatchObject({
      user_removed: true,
    });
  });
});

describe('installs in flight', () => {
  it('a user install of the key the auto-install is fetching joins it (one download)', async () => {
    const g = gate();
    mockState.api.getDownloadTicket.mockImplementationOnce(async () => {
      await g.wait;
      return {url: KEY, version: 3, sha256: 's', bytes: 1, expires_at: 'x'};
    });
    const sync = load();
    const init = sync.initContentSync();
    await settle();
    const user = sync.installContent(KEY);
    await settle();
    g.open();
    await Promise.all([init, user]);
    expect(mockState.api.getDownloadTicket).toHaveBeenCalledTimes(1);
    expect(mockState.installer.install).toHaveBeenCalledTimes(1);
  });

  it('a user install after a failed auto-install downloads and reports errors', async () => {
    mockState.api.getDownloadTicket.mockRejectedValueOnce(new Error('offline'));
    const sync = load();
    await sync.initContentSync();
    await expect(sync.installContent(KEY)).resolves.toBeUndefined();
    expect(mockState.api.getDownloadTicket).toHaveBeenCalledTimes(2);
  });
});

describe('unmanaged downloads', () => {
  it('adopts saved rows whose registry write was lost, then purges them on withdrawal', async () => {
    const sync = load();
    await sync.initContentSync();
    expect((await mockState.registry.getState()).migratedAt).not.toBeNull();

    // tafaseer.db has tafsir 16, but the registry write never happened.
    mockState.downloaded.mockResolvedValue([
      {identifier: '16', name: 'Tafsir Muyassar'} as never,
    ]);
    mockState.api.fetchManifest.mockResolvedValue(
      ok([entry(KEY), entry('qf:tafsirs:16', 'withdrawn')]),
    );
    mockState.now += DAY;
    foreground();
    await settle();
    expect(mockState.installer.remove).toHaveBeenCalledWith('qf:tafsirs:16');
    expect(mockState.notify).toHaveBeenCalledWith({
      key: 'qf:tafsirs:16',
      name: 'Tafsir Muyassar',
    });
  });
});

describe('isOnWifi', () => {
  it('maps wifi and ethernet to true, anything else to false', () => {
    const sync = load();
    expect(sync.isOnWifi({type: 'wifi'})).toBe(true);
    expect(sync.isOnWifi({type: 'ethernet'})).toBe(true);
    expect(sync.isOnWifi({type: 'cellular'})).toBe(false);
    expect(sync.isOnWifi({type: 'none'})).toBe(false);
  });
});
