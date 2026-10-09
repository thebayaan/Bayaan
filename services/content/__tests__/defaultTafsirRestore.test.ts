jest.mock(
  'expo-sqlite',
  () => require('@/test-utils/mockExpoSqlite').expoSqliteModule,
);
// Only AppState is replaced; everything else falls through to the real module.
jest.mock('react-native', () =>
  Object.create(jest.requireActual('react-native'), {
    AppState: {
      value: {
        addEventListener: (
          _event: string,
          handler: (status: string) => void,
        ) => {
          mockServer.listeners.push(handler);
          return {
            remove: () => {
              mockServer.listeners = mockServer.listeners.filter(
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
  default: {contentApiBase: 'https://api.test'},
}));
jest.mock('@/services/analytics/AnalyticsService', () => ({
  analyticsService: {trackContentEvent: jest.fn()},
}));
jest.mock('../contentNotices', () => ({
  showWithdrawalNotice: (notice: unknown) => mockServer.notices.push(notice),
}));
// The real installer runs against the real tafaseer.db; only the persisted
// zustand store is replaced by its selection behavior.
jest.mock('@/store/tafseerStore', () => ({
  useTafseerStore: {getState: () => mockStore},
}));
jest.mock('../contentApi', () => ({
  ...jest.requireActual('../contentApi'),
  createContentApi: () => ({
    fetchManifest: async () => ({
      status: 'ok',
      manifest: mockServer.manifest,
      etag: null,
    }),
    // The backend refuses tickets for withdrawn keys and while paused.
    getDownloadTicket: async (key: string) => {
      mockServer.tickets.push(key);
      const offered = mockServer.manifest.resources.some(
        item => item.key === key && item.status === 'active',
      );
      if (mockServer.manifest.paused || !offered)
        throw new Error('not_offered');
      return {url: key, version: 3, sha256: 's', bytes: 1, expires_at: 'x'};
    },
    fetchText: async (url: string) => mockEnvelope(url),
  }),
}));

import {resetDatabases} from '@/test-utils/mockExpoSqlite';
import type {Manifest, ManifestEntry} from '@/types/content';
import type {DownloadedTafseerMeta} from '@/types/tafseer';

type ContentSync = typeof import('../contentSync');
type Tafseer =
  typeof import('@/services/tafseer/TafseerDbService').tafseerDbService;

interface MockServer {
  manifest: Manifest;
  tickets: string[];
  notices: unknown[];
  listeners: ((status: string) => void)[];
}

interface MockStore {
  selectedTafseerId: string | null;
  downloadedMeta: DownloadedTafseerMeta[];
  setSelectedTafseerId: (id: string | null) => void;
  loadDownloadedMeta: () => Promise<void>;
}

const DEFAULT = 'qf:tafsirs:169';
const OTHER = 'qf:tafsirs:16';
const DAY = 86_400_000;

let mockServer: MockServer;
let mockStore: MockStore;
let now = 1_000_000_000_000;

function entry(key: string, status: 'active' | 'withdrawn'): ManifestEntry {
  return {
    key,
    kind: 'tafsir',
    source: 'qf',
    version: 3,
    status,
    upstream_schema_version: 1,
    bytes: 1000,
    sha256: 's',
  };
}

function manifest(resources: ManifestEntry[], paused = false): Manifest {
  return {format: 1, generated_at: 'x', paused, resources};
}

function mockEnvelope(key: string): string {
  return JSON.stringify({
    envelope: 1,
    key,
    version: 3,
    source: 'qf',
    fetched_at: 'x',
    snapshot: {
      resource_group: 'tafsirs',
      resource_id: Number(key.slice(key.lastIndexOf(':') + 1)),
      schema_version: 1,
      records: [{verse_id: 1, verse_key: '1:1', text: '<p>a</p>'}],
    },
  });
}

interface Loaded {
  sync: ContentSync;
  tafseer: Tafseer;
}

// One isolated module registry per test: the services are singletons.
function load(): Loaded {
  let loaded: Loaded | undefined;
  jest.isolateModules(() => {
    loaded = {
      sync: require('../contentSync'),
      tafseer: require('@/services/tafseer/TafseerDbService').tafseerDbService,
    };
  });
  if (!loaded) throw new Error('services not loaded');
  return loaded;
}

async function settle(): Promise<void> {
  for (let i = 0; i < 30; i++) {
    await new Promise<void>(resolve => setTimeout(resolve, 0));
  }
}

// The next daily foreground cycle against the given server manifest.
async function nextCycle(next: Manifest): Promise<void> {
  mockServer.manifest = next;
  now += DAY;
  for (const listener of [...mockServer.listeners]) listener('active');
  await settle();
}

async function installedIds(tafseer: Tafseer): Promise<string[]> {
  return (await tafseer.getDownloadedTafaseer())
    .map(item => item.identifier)
    .sort();
}

async function start(): Promise<Loaded> {
  const loaded = load();
  await loaded.tafseer.initialize();
  mockStore.loadDownloadedMeta = async () => {
    mockStore.downloadedMeta = await loaded.tafseer.getDownloadedTafaseer();
  };
  await loaded.sync.initContentSync();
  return loaded;
}

const ACTIVE = manifest([entry(DEFAULT, 'active'), entry(OTHER, 'active')]);
const WITHDRAWN = manifest([
  entry(DEFAULT, 'withdrawn'),
  entry(OTHER, 'active'),
]);

let active: Loaded | null = null;

beforeEach(async () => {
  await resetDatabases();
  now = 1_000_000_000_000;
  jest.spyOn(Date, 'now').mockImplementation(() => now);
  mockServer = {manifest: ACTIVE, tickets: [], notices: [], listeners: []};
  mockStore = {
    selectedTafseerId: null,
    downloadedMeta: [],
    setSelectedTafseerId: id => {
      mockStore.selectedTafseerId = id;
    },
    loadDownloadedMeta: async () => undefined,
  };
});

afterEach(() => {
  active?.sync.teardownContentSync();
  active = null;
  jest.restoreAllMocks();
});

describe('default tafsir withdrawn, then restored', () => {
  it('is reinstalled on the next cycle after the manifest offers it again', async () => {
    active = await start();
    expect(await installedIds(active.tafseer)).toEqual(['169']);
    expect(mockStore.selectedTafseerId).toBe('169');

    await nextCycle(WITHDRAWN);
    expect(await installedIds(active.tafseer)).toEqual([]);
    expect(mockServer.notices).toHaveLength(1);
    expect(mockStore.selectedTafseerId).toBeNull();

    await nextCycle(ACTIVE);
    expect(await installedIds(active.tafseer)).toEqual(['169']);
    expect(mockStore.selectedTafseerId).toBe('169');
    expect(mockServer.notices).toHaveLength(1);
  });

  it('is never reinstalled after the user removed it before the withdrawal', async () => {
    active = await start();
    await active.sync.removeContent(DEFAULT);
    await nextCycle(WITHDRAWN);
    await nextCycle(ACTIVE);
    expect(await installedIds(active.tafseer)).toEqual([]);
    expect(mockServer.tickets).toEqual([DEFAULT]);
  });

  it('is never reinstalled after the user removed it while withdrawn', async () => {
    active = await start();
    await nextCycle(WITHDRAWN);
    await active.sync.removeContent(DEFAULT);
    await nextCycle(ACTIVE);
    await nextCycle(ACTIVE);
    expect(await installedIds(active.tafseer)).toEqual([]);
    expect(mockServer.tickets).toEqual([DEFAULT]);
  });

  it('is never reinstalled after a user removal that follows a restore', async () => {
    active = await start();
    await nextCycle(WITHDRAWN);
    await nextCycle(ACTIVE);
    expect(await installedIds(active.tafseer)).toEqual(['169']);
    await active.sync.removeContent(DEFAULT);
    await nextCycle(WITHDRAWN);
    await nextCycle(ACTIVE);
    expect(await installedIds(active.tafseer)).toEqual([]);
    expect(mockServer.tickets).toEqual([DEFAULT, DEFAULT]);
  });

  it('keeps a selection the user made while it was withdrawn', async () => {
    active = await start();
    await nextCycle(WITHDRAWN);
    await active.sync.installContent(OTHER);
    expect(mockStore.selectedTafseerId).toBe('16');

    await nextCycle(ACTIVE);
    expect(await installedIds(active.tafseer)).toEqual(['16', '169']);
    expect(mockStore.selectedTafseerId).toBe('16');
  });

  it('waits for the kill switch to lift before reinstalling', async () => {
    active = await start();
    await nextCycle(WITHDRAWN);
    await nextCycle(
      manifest([entry(DEFAULT, 'active'), entry(OTHER, 'active')], true),
    );
    expect(await installedIds(active.tafseer)).toEqual([]);
    expect(mockServer.tickets).toEqual([DEFAULT]);

    await nextCycle(ACTIVE);
    expect(await installedIds(active.tafseer)).toEqual(['169']);
  });
});

describe('a non-default tafsir withdrawn, then restored', () => {
  it('is not reinstalled automatically', async () => {
    active = await start();
    await active.sync.installContent(OTHER);
    expect(await installedIds(active.tafseer)).toEqual(['16', '169']);

    await nextCycle(
      manifest([entry(DEFAULT, 'active'), entry(OTHER, 'withdrawn')]),
    );
    expect(await installedIds(active.tafseer)).toEqual(['169']);

    await nextCycle(ACTIVE);
    await nextCycle(ACTIVE);
    expect(await installedIds(active.tafseer)).toEqual(['169']);
    expect(mockServer.tickets).toEqual([DEFAULT, OTHER]);
  });
});
