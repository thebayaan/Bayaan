// @ai-generated
// The reciter catalogue loads once per launch and is then read from memory.
// Screens ask for a reciter once per list row and the player once per track.
// Each of those calls used to read the cached catalogue from storage, download
// it again and write it back, so these tests count that work.
import type {Reciter} from '@/data/reciterData';
import {RECITER_MERGES} from '@/utils/reciterMerges';

const API_URL = 'https://api.example.test';
const KILLSWITCH_URL = 'https://cdn.example.test/app-config.json';
const CACHE_KEY = 'bayaan_reciters';

// Kept outside the module registry, so the cache survives a relaunch.
const mockStorage = new Map<string, string>();
const mockGetItem = jest.fn(
  async (key: string): Promise<string | null> => mockStorage.get(key) ?? null,
);
const mockSetItem = jest.fn(
  async (key: string, value: string): Promise<void> => {
    mockStorage.set(key, value);
  },
);
const mockCatalogLoaded = jest.fn();

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: (key: string) => mockGetItem(key),
  setItem: (key: string, value: string) => mockSetItem(key, value),
  multiRemove: async () => undefined,
}));
jest.mock('@/services/player/store/playerStore', () => ({
  usePlayerStore: {getState: () => ({cleanup: async () => undefined})},
}));
jest.mock('@/store/reciterStore', () => ({
  useReciterStore: {getState: () => ({catalogLoaded: mockCatalogLoaded})},
}));
jest.mock('@/utils/search/catalog', () => ({rankSurahs: () => []}));
jest.mock('@/data/reciters-fallback.json', () => [
  {
    id: 'bundled',
    name: 'Bundled Reciter',
    date: null,
    image_url: null,
    rewayat: [
      {
        id: 'bundled-hafs',
        reciter_id: 'bundled',
        name: "Hafs A'n Assem",
        style: 'murattal',
        server: 'https://cdn.example.test/bundled/',
        surah_total: 2,
        surah_list: [1, 2],
        source_type: 'test',
        created_at: '2026-01-01',
      },
    ],
  },
]);

function reciter(id: string, name: string): Reciter {
  return {
    id,
    name,
    date: null,
    image_url: null,
    rewayat: [
      {
        id: `${id}-hafs`,
        reciter_id: id,
        name: "Hafs A'n Assem",
        style: 'murattal',
        server: `https://cdn.example.test/${id}/`,
        surah_total: 2,
        surah_list: [1, 2],
        source_type: 'test',
        created_at: '2026-01-01',
      },
    ],
  };
}

const FIRST = [reciter('r1', 'One'), reciter('r2', 'Two')];
const UPDATED = [
  reciter('r1', 'One, renamed'),
  reciter('r2', 'Two'),
  reciter('r3', 'Three'),
];

// ── A fake network ───────────────────────────────────────────────────────────

type ApiHandler = (signal: AbortSignal | undefined) => Promise<unknown>;

const serves =
  (catalogue: Reciter[]): ApiHandler =>
  async () => ({
    ok: true,
    json: async () => ({data: catalogue, meta: {total_pages: 1}}),
  });

/** A connection that never answers; it fails only when the request is aborted. */
const neverAnswers: ApiHandler = signal =>
  new Promise((_resolve, reject) => {
    signal?.addEventListener('abort', () => reject(new Error('Aborted')));
  });

const refusesConnection: ApiHandler = async () => {
  throw new TypeError('Network request failed');
};

let apiHandler: jest.MockedFunction<ApiHandler>;
let backendEnabled: boolean;

const fetchMock = jest.fn(
  async (url: string, init?: {signal?: AbortSignal}): Promise<unknown> => {
    if (url === KILLSWITCH_URL) {
      return {ok: true, json: async () => ({useBackendApi: backendEnabled})};
    }
    return apiHandler(init?.signal);
  },
);

const killswitchChecks = () =>
  fetchMock.mock.calls.filter(([url]) => url === KILLSWITCH_URL).length;
const downloads = () => apiHandler.mock.calls.length;

/** Every piece of work a catalogue load or refresh can cause. */
function workDone() {
  return {
    storageReads: mockGetItem.mock.calls.length,
    storageWrites: mockSetItem.mock.calls.length,
    requests: fetchMock.mock.calls.length,
    catalogSwaps: mockCatalogLoaded.mock.calls.length,
  };
}

// ── A fake app launch ────────────────────────────────────────────────────────

type App = {
  service: typeof import('../dataService');
  RECITERS: Reciter[];
  health: typeof import('@/store/apiHealthStore').useApiHealthStore;
};

/** A fresh app launch: new module instances reading the same storage. */
function launch(opts: {killswitch?: boolean} = {}): App {
  process.env.EXPO_PUBLIC_BAYAAN_API_URL = API_URL;
  process.env.EXPO_PUBLIC_BAYAAN_API_KEY = 'test-key';
  process.env.EXPO_PUBLIC_KILLSWITCH_URL = opts.killswitch
    ? KILLSWITCH_URL
    : '';
  let app!: App;
  jest.isolateModules(() => {
    app = {
      service: require('../dataService'),
      RECITERS: require('@/data/reciterData').RECITERS,
      health: require('@/store/apiHealthStore').useApiHealthStore,
    };
  });
  return app;
}

/** Lets storage reads, downloads and cache writes settle. */
async function settle(): Promise<void> {
  for (let i = 0; i < 10; i++) {
    await new Promise(resolve => setImmediate(resolve));
  }
}

/** An earlier launch that downloaded `catalogue` and left it in the cache. */
async function leaveInCache(catalogue: Reciter[]): Promise<void> {
  apiHandler.mockImplementation(serves(catalogue));
  await launch().service.getAllReciters();
  await settle();
  expect(mockStorage.has(CACHE_KEY)).toBe(true);
  mockGetItem.mockClear();
  mockSetItem.mockClear();
  mockCatalogLoaded.mockClear();
  fetchMock.mockClear();
  apiHandler.mockClear();
}

const names = (reciters: Reciter[]) => reciters.map(r => r.name);

const savedEnv = {...process.env};

beforeEach(() => {
  mockStorage.clear();
  jest.clearAllMocks();
  apiHandler = jest.fn(serves(FIRST));
  backendEnabled = true;
  (globalThis as {fetch: unknown}).fetch = fetchMock;
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

afterAll(() => {
  process.env = savedEnv;
});

describe('reciter lookups after the catalogue has loaded', () => {
  it('do no storage reads, requests or cache writes', async () => {
    await leaveInCache(FIRST);
    const {service, RECITERS} = launch({killswitch: true});

    // Launch: one killswitch check, one cache read, one background refresh.
    await service.getAllReciters();
    await settle();
    expect(killswitchChecks()).toBe(1);
    expect(mockGetItem).toHaveBeenCalledTimes(1);
    expect(downloads()).toBe(1);
    expect(mockSetItem).toHaveBeenCalledTimes(1);

    const afterLaunch = workDone();
    const firstReciter = RECITERS[0];

    // A list screen resolving 30 rows, then the other lookups screens use.
    const rows = await Promise.all(
      Array.from({length: 30}, () => service.getReciterById('r1')),
    );
    const all = await service.getAllReciters();
    const surahs = await service.getAvailableSurahsForRewayat('r2-hafs');
    const rewayat = await service.getReciterRewayat('r2');
    const forSurah = await service.getRecitersForSurah(2);
    const url = await service.fetchAudioUrl(1, 'r1', 'r1-hafs');
    await settle();

    expect(workDone()).toEqual(afterLaunch);
    // The same objects every time, not a new copy of each reciter per call.
    expect(RECITERS[0]).toBe(firstReciter);
    expect(rows.every(row => row === firstReciter)).toBe(true);
    expect(names(all)).toEqual(['One', 'Two']);
    expect(surahs).toEqual([1, 2]);
    expect(rewayat.map(r => r.id)).toEqual(['r2-hafs']);
    expect(names(forSurah)).toEqual(['One', 'Two']);
    expect(url).toContain('https://cdn.example.test/r1/');
  });

  it('give each caller its own list', async () => {
    await leaveInCache(FIRST);
    const {service, RECITERS} = launch();

    const mine = await service.getAllReciters();
    mine.reverse();
    mine.pop();

    expect(names(RECITERS)).toEqual(['One', 'Two']);
    expect(names(await service.getAllReciters())).toEqual(['One', 'Two']);
  });

  it('still find a merged reciter under its old id', async () => {
    const merge = RECITER_MERGES[0];
    await leaveInCache([
      reciter(merge.fromId, merge.fromName),
      reciter(merge.toId, merge.toName),
    ]);
    const {service} = launch();
    await service.getAllReciters();

    const found = await service.getReciterById(merge.fromId);

    expect(found?.id).toBe(merge.toId);
    expect(found?.rewayat).toHaveLength(2);
  });
});

describe('the first load', () => {
  it('is shared by calls made before it finishes', async () => {
    await leaveInCache(FIRST);
    const {service} = launch({killswitch: true});

    const [all, one, surahs, again] = await Promise.all([
      service.getAllReciters(),
      service.getReciterById('r2'),
      service.getAvailableSurahsForRewayat('r1-hafs'),
      service.getAllReciters(),
    ]);
    await settle();

    expect(names(all)).toEqual(['One', 'Two']);
    expect(one?.name).toBe('Two');
    expect(surahs).toEqual([1, 2]);
    expect(names(again)).toEqual(['One', 'Two']);
    expect(killswitchChecks()).toBe(1);
    expect(mockGetItem).toHaveBeenCalledTimes(1);
    expect(downloads()).toBe(1);
    expect(mockSetItem).toHaveBeenCalledTimes(1);
    // Once from the cache, once when the background refresh landed.
    expect(mockCatalogLoaded).toHaveBeenCalledTimes(2);
  });

  it('downloads once on first launch however many callers wait', async () => {
    const {service, RECITERS} = launch();

    const results = await Promise.all(
      Array.from({length: 5}, () => service.getAllReciters()),
    );
    await settle();

    expect(results.map(names)).toEqual(Array(5).fill(['One', 'Two']));
    expect(names(RECITERS)).toEqual(['One', 'Two']);
    expect(downloads()).toBe(1);
    expect(mockSetItem).toHaveBeenCalledTimes(1);
    expect(mockCatalogLoaded).toHaveBeenCalledTimes(1);
  });

  it('can be tried again after it fails', async () => {
    await leaveInCache(FIRST);
    const {service} = launch();
    mockGetItem.mockRejectedValueOnce(new Error('storage is locked'));

    await expect(service.getAllReciters()).rejects.toThrow('storage is locked');

    expect(names(await service.getAllReciters())).toEqual(['One', 'Two']);
  });
});

describe('refreshing the catalogue', () => {
  it('downloads again when asked', async () => {
    await leaveInCache(FIRST);
    const {service, RECITERS} = launch();
    await service.getAllReciters();
    await settle();
    expect(await service.getReciterById('r3')).toBeUndefined();

    apiHandler.mockImplementation(serves(UPDATED));
    const before = workDone();
    await service.refreshReciters();

    expect(downloads()).toBe(2);
    expect(workDone().storageWrites).toBe(before.storageWrites + 1);
    expect(names(RECITERS)).toEqual(['One, renamed', 'Two', 'Three']);
    expect((await service.getReciterById('r3'))?.name).toBe('Three');
    expect(JSON.parse(mockStorage.get(CACHE_KEY) ?? '{}').data).toHaveLength(3);
  });

  it('downloads again through the retry the network monitor runs', async () => {
    await leaveInCache(FIRST);
    const {service, RECITERS, health} = launch();
    // Offline at launch: the cache is shown and the refresh fails.
    apiHandler.mockImplementation(refusesConnection);
    await service.getAllReciters();
    await settle();
    expect(names(RECITERS)).toEqual(['One', 'Two']);
    expect(health.getState().isDisrupted).toBe(true);
    expect(health.getState().usingStaleCache).toBe(true);

    // Back online: useNetworkMonitor calls the registered retry.
    apiHandler.mockImplementation(serves(UPDATED));
    await health.getState().retryFn?.();

    expect(downloads()).toBe(2);
    expect(names(RECITERS)).toEqual(['One, renamed', 'Two', 'Three']);
    expect(health.getState().isDisrupted).toBe(false);
  });

  it('runs one download at a time', async () => {
    await leaveInCache(FIRST);
    const {service, RECITERS} = launch();
    await service.getAllReciters();
    await settle();
    expect(downloads()).toBe(1);

    let answer!: () => void;
    apiHandler.mockImplementation(
      () =>
        new Promise(resolve => {
          answer = () => resolve(serves(UPDATED)(undefined));
        }),
    );
    const refreshes = [
      service.refreshReciters(),
      service.refreshReciters(),
      service.refreshReciters(),
    ];
    await settle();
    expect(downloads()).toBe(2);

    answer();
    await Promise.all(refreshes);
    expect(downloads()).toBe(2);
    expect(names(RECITERS)).toEqual(['One, renamed', 'Two', 'Three']);
  });

  it('gives up on a download that never answers, and the waiting retry downloads again', async () => {
    await leaveInCache(FIRST);
    jest.useFakeTimers();
    const {service, RECITERS, health} = launch();
    apiHandler.mockImplementation(neverAnswers);

    // The cache shows at once; the background refresh is left hanging.
    expect(names(await service.getAllReciters())).toEqual(['One', 'Two']);
    await jest.advanceTimersByTimeAsync(0);
    expect(downloads()).toBe(1);

    // The network comes back. The retry waits for the refresh in flight
    // instead of starting a second download next to it.
    apiHandler.mockImplementation(serves(UPDATED));
    const retry = health.getState().retryFn?.();
    await jest.advanceTimersByTimeAsync(29_000);
    expect(downloads()).toBe(1);
    expect(health.getState().isDisrupted).toBe(false);

    // The hanging download gives up, and the retry downloads again.
    await jest.advanceTimersByTimeAsync(1_000);
    await retry;
    expect(downloads()).toBe(2);
    expect(names(RECITERS)).toEqual(['One, renamed', 'Two', 'Three']);
    expect(health.getState().isDisrupted).toBe(false);
  });

  it('does not download twice when the refresh in flight gets through', async () => {
    await leaveInCache(FIRST);
    const {service} = launch();
    let answer!: () => void;
    apiHandler.mockImplementation(
      () =>
        new Promise(resolve => {
          answer = () => resolve(serves(UPDATED)(undefined));
        }),
    );

    // Launch leaves the background refresh waiting for its answer.
    await service.getAllReciters();
    await settle();
    expect(downloads()).toBe(1);

    const refresh = service.refreshReciters();
    await settle();
    answer();
    await refresh;

    expect(downloads()).toBe(1);
    expect((await service.getReciterById('r3'))?.name).toBe('Three');
  });

  it('does the first load when nothing has loaded yet', async () => {
    await leaveInCache(FIRST);
    const {service, RECITERS} = launch();

    await service.refreshReciters();
    await settle();

    expect(names(RECITERS)).toEqual(['One', 'Two']);
    expect(mockGetItem).toHaveBeenCalledTimes(1);
    expect(downloads()).toBe(1);
  });
});

describe('the killswitch', () => {
  it('is asked at launch and before each refresh, never per lookup', async () => {
    await leaveInCache(FIRST);
    const {service} = launch({killswitch: true});

    await service.getAllReciters();
    await settle();
    expect(killswitchChecks()).toBe(1);

    await Promise.all(
      Array.from({length: 10}, () => service.getReciterById('r1')),
    );
    expect(killswitchChecks()).toBe(1);

    await service.refreshReciters();
    expect(killswitchChecks()).toBe(2);
    expect(downloads()).toBe(2);
  });

  it('stops a refresh from calling the API once the backend is switched off', async () => {
    await leaveInCache(FIRST);
    const {service, RECITERS} = launch({killswitch: true});
    await service.getAllReciters();
    await settle();
    expect(downloads()).toBe(1);

    backendEnabled = false;
    await service.refreshReciters();

    expect(downloads()).toBe(1);
    expect(names(RECITERS)).toEqual(['Bundled Reciter']);
  });

  it('shows the bundled list at launch when the backend is off', async () => {
    await leaveInCache(FIRST);
    backendEnabled = false;
    const {service} = launch({killswitch: true});

    expect(names(await service.getAllReciters())).toEqual(['Bundled Reciter']);
    expect((await service.getReciterById('bundled'))?.name).toBe(
      'Bundled Reciter',
    );
    await settle();

    expect(downloads()).toBe(0);
    expect(mockGetItem).not.toHaveBeenCalled();
    expect(killswitchChecks()).toBe(1);
  });
});
