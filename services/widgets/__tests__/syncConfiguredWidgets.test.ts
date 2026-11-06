// services/widgets/__tests__/syncConfiguredWidgets.test.ts
import type {
  PendingTasbeeh,
  PendingWidgetEvent,
  WidgetArtworkRequests,
} from 'bayaan-widgets';
import type {Reciter} from '@/data/reciterData';

const mockWriteCatalog = jest.fn();
const mockReloadWidgets = jest.fn();
const mockCacheArtwork = jest.fn<Promise<boolean>, [string, string]>();
const mockCached = new Set<string>();
let mockRequests: WidgetArtworkRequests = {surahIds: [], reciterIds: []};
let mockPending: PendingTasbeeh[] = [];
const mockTakePendingWidgetEvents = jest.fn<PendingWidgetEvent[], []>();
const mockTrackAdhkarSessionCompleted = jest.fn();
let mockReadyToCapture = true;
const mockReadyListeners: (() => void)[] = [];
const mockFlush = jest.fn();
const mockIncrement = jest.fn<Promise<number>, [string]>();
const mockReset = jest.fn<Promise<void>, [string]>();
const mockReciters: Reciter[] = [];
const mockUnsubs: jest.Mock[] = [];
const mockAppStateRemove = jest.fn();

function mockSubscribe(): jest.Mock {
  const unsub = jest.fn();
  mockUnsubs.push(unsub);
  return unsub;
}

jest.mock('bayaan-widgets', () => ({
  ...jest.requireActual('bayaan-widgets'),
  isWidgetsAvailable: () => true,
  writeCatalog: (c: unknown) => mockWriteCatalog(c),
  reloadWidgets: (k: unknown) => mockReloadWidgets(k),
  cacheArtwork: (u: string, f: string) => mockCacheArtwork(u, f),
  hasArtwork: (f: string) => mockCached.has(f),
  readArtworkRequests: () => mockRequests,
  takePendingTasbeeh: () => {
    const p = mockPending;
    mockPending = [];
    return p;
  },
  takePendingWidgetEvents: () => mockTakePendingWidgetEvents(),
}));
jest.mock('@/services/analytics/AnalyticsService', () => ({
  analyticsService: {
    trackAdhkarSessionCompleted: (p: unknown, at: unknown) =>
      mockTrackAdhkarSessionCompleted(p, at),
    isReadyToCapture: () => mockReadyToCapture,
    onReadyToCapture: (listener: () => void) => {
      mockReadyListeners.push(listener);
      return mockSubscribe();
    },
  },
}));
jest.mock('react-native', () => {
  const actual = jest.requireActual('react-native');
  const appState = {addEventListener: () => ({remove: mockAppStateRemove})};
  return new Proxy(actual, {
    get: (target, prop) => (prop === 'AppState' ? appState : target[prop]),
  });
});
jest.mock('@/data/reciterData', () => ({RECITERS: mockReciters}));
jest.mock('@/store/adhkarStore', () => ({
  useAdhkarStore: {
    getState: () => ({incrementCount: mockIncrement, resetCount: mockReset}),
    subscribe: () => mockSubscribe(),
  },
}));
jest.mock('@/store/reciterStore', () => ({
  useReciterStore: {subscribe: () => mockSubscribe()},
}));
jest.mock('@/services/dataService', () => ({
  getReciterByIdSync: (id: string) => mockReciters.find(r => r.id === id),
}));
jest.mock('@/utils/artworkUtils', () => ({
  getReciterArtwork: (r: Reciter) => r.image_url ?? 'data:image/png;base64,x',
}));
jest.mock('../syncWidgets', () => ({
  ARTWORK_KINDS: ['QuickSurah', 'PinnedReciter', 'ContinueReading'],
  flushWidgetSnapshot: () => mockFlush(),
}));

type SyncModule = typeof import('../syncConfiguredWidgets');

function loadModule(): SyncModule {
  let mod: SyncModule | null = null;
  jest.isolateModules(() => {
    mod = require('../syncConfiguredWidgets');
  });
  if (!mod) throw new Error('module failed to load');
  return mod;
}

function reciter(id: string, imageUrl: string | null): Reciter {
  return {
    id,
    name: id.toUpperCase(),
    date: null,
    image_url: imageUrl,
    rewayat: [],
  };
}

beforeEach(() => {
  mockWriteCatalog.mockReset();
  mockReloadWidgets.mockReset();
  mockCacheArtwork.mockReset();
  mockCacheArtwork.mockResolvedValue(true);
  mockCached.clear();
  mockRequests = {surahIds: [], reciterIds: []};
  mockPending = [];
  mockTakePendingWidgetEvents.mockReset();
  mockTakePendingWidgetEvents.mockReturnValue([]);
  mockTrackAdhkarSessionCompleted.mockReset();
  mockReadyToCapture = true;
  mockReadyListeners.length = 0;
  mockFlush.mockReset();
  mockIncrement.mockReset();
  mockIncrement.mockResolvedValue(1);
  mockReset.mockReset();
  mockReset.mockResolvedValue(undefined);
  mockReciters.length = 0;
  mockUnsubs.length = 0;
  mockAppStateRemove.mockReset();
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('configuredArtworkJobs', () => {
  it('always includes the default cards and skips cached files', () => {
    const {configuredArtworkJobs} = loadModule();
    mockCached.add('surah-1.jpg');
    const jobs = configuredArtworkJobs(
      {surahIds: [], reciterIds: []},
      f => mockCached.has(f),
      () => null,
    );
    expect([...jobs.keys()]).toEqual([
      'surah-18.jpg',
      'surah-36.jpg',
      'surah-56.jpg',
      'surah-67.jpg',
    ]);
    expect(jobs.get('surah-18.jpg')).toBe(
      'https://cdn.thebayaan.com/assets/car/surah/18.png',
    );
  });

  it('adds requested cards and reciter photos that have a URL', () => {
    const {configuredArtworkJobs} = loadModule();
    const jobs = configuredArtworkJobs(
      {surahIds: [55, 18], reciterIds: ['r1', 'r2']},
      () => false,
      id => (id === 'r1' ? 'https://x/r1.jpg' : null),
    );
    expect(jobs.get('surah-55.jpg')).toBe(
      'https://cdn.thebayaan.com/assets/car/surah/55.png',
    );
    expect(jobs.get('reciter-r1.jpg')).toBe('https://x/r1.jpg');
    expect(jobs.has('reciter-r2.jpg')).toBe(false);
    expect(jobs.size).toBe(7);
  });
});

describe('syncCatalog', () => {
  it('writes and reloads only when the catalog changes', () => {
    const sync = loadModule();
    mockReciters.push(reciter('r1', null));
    sync.syncCatalog();
    sync.syncCatalog();
    expect(mockWriteCatalog).toHaveBeenCalledTimes(1);
    expect(mockReloadWidgets).toHaveBeenCalledWith([
      'QuickSurah',
      'PinnedReciter',
      'Tasbeeh',
    ]);
    mockReciters.push(reciter('r2', null));
    sync.syncCatalog();
    expect(mockWriteCatalog).toHaveBeenCalledTimes(2);
  });
});

describe('ensureConfiguredArtwork', () => {
  it('caches requested files and reloads the artwork widgets once', async () => {
    const sync = loadModule();
    [
      'surah-1.jpg',
      'surah-18.jpg',
      'surah-36.jpg',
      'surah-56.jpg',
      'surah-67.jpg',
    ].forEach(f => mockCached.add(f));
    mockReciters.push(reciter('r1', 'https://x/r1.jpg'));
    mockRequests = {surahIds: [55], reciterIds: ['r1']};
    await expect(sync.ensureConfiguredArtwork()).resolves.toBe(true);
    expect(mockCacheArtwork).toHaveBeenCalledWith(
      'https://cdn.thebayaan.com/assets/car/surah/55.png',
      'surah-55.jpg',
    );
    expect(mockCacheArtwork).toHaveBeenCalledWith(
      'https://x/r1.jpg',
      'reciter-r1.jpg',
    );
    expect(mockReloadWidgets).toHaveBeenCalledTimes(1);
    expect(mockReloadWidgets).toHaveBeenCalledWith([
      'QuickSurah',
      'PinnedReciter',
      'ContinueReading',
    ]);
  });

  it('does not reload or retry within the window when downloads fail', async () => {
    const sync = loadModule();
    mockCacheArtwork.mockResolvedValue(false);
    await expect(sync.ensureConfiguredArtwork()).resolves.toBe(false);
    const calls = mockCacheArtwork.mock.calls.length;
    await sync.ensureConfiguredArtwork();
    expect(mockCacheArtwork.mock.calls.length).toBe(calls);
    expect(mockReloadWidgets).not.toHaveBeenCalled();
  });
});

describe('consumeTasbeehIncrements', () => {
  it('applies a reset, then later taps, for today only, and flushes once', async () => {
    const sync = loadModule();
    mockPending = [
      {dhikrId: '91', count: 3, day: '2026-10-10'},
      {dhikrId: '91', count: 0, day: '2026-10-10', reset: true},
      {dhikrId: '91', count: 2, day: '2026-10-10'},
      {dhikrId: '96', count: 5, day: '2026-10-09'},
    ];
    await sync.consumeTasbeehIncrements(new Date(2026, 9, 10, 12));
    expect(mockReset).toHaveBeenCalledWith('91');
    expect(mockIncrement).toHaveBeenCalledTimes(2);
    expect(mockIncrement).not.toHaveBeenCalledWith('96');
    expect(mockReset.mock.invocationCallOrder[0]).toBeLessThan(
      mockIncrement.mock.invocationCallOrder[0],
    );
    expect(mockFlush).toHaveBeenCalledTimes(1);
  });

  it('does nothing when nothing is pending', async () => {
    const sync = loadModule();
    await sync.consumeTasbeehIncrements(new Date(2026, 9, 10, 12));
    expect(mockFlush).not.toHaveBeenCalled();
  });
});

describe('consumeWidgetEvents', () => {
  const completion: PendingWidgetEvent = {
    name: 'adhkar_session_completed',
    props: {
      category: 'evening-adhkar',
      duration_ms: 90000,
      dhikr_count: 24,
    },
    completedAtMs: Date.UTC(2026, 9, 11, 18),
  };

  it('sends queued adhkar completions to analytics once, dated when completed', () => {
    const sync = loadModule();
    mockTakePendingWidgetEvents.mockReturnValueOnce([completion]);
    sync.consumeWidgetEvents();
    expect(mockTrackAdhkarSessionCompleted).toHaveBeenCalledWith(
      {category: 'evening-adhkar', duration_ms: 90000, dhikr_count: 24},
      new Date(Date.UTC(2026, 9, 11, 18)),
    );
    mockTakePendingWidgetEvents.mockReturnValueOnce([]);
    sync.consumeWidgetEvents();
    expect(mockTrackAdhkarSessionCompleted).toHaveBeenCalledTimes(1);
  });

  it('leaves the queue alone until analytics can capture', () => {
    const sync = loadModule();
    mockReadyToCapture = false;
    mockTakePendingWidgetEvents.mockReturnValue([completion]);
    sync.consumeWidgetEvents();
    expect(mockTakePendingWidgetEvents).not.toHaveBeenCalled();
    expect(mockTrackAdhkarSessionCompleted).not.toHaveBeenCalled();
  });

  it('drains when analytics becomes ready after the first sync', () => {
    const sync = loadModule();
    mockReadyToCapture = false;
    const stop = sync.startConfiguredWidgetSync();
    expect(mockTakePendingWidgetEvents).not.toHaveBeenCalled();
    expect(mockReadyListeners).toHaveLength(1);
    mockReadyToCapture = true;
    mockTakePendingWidgetEvents.mockReturnValueOnce([completion]);
    mockReadyListeners.forEach(listener => listener());
    expect(mockTrackAdhkarSessionCompleted).toHaveBeenCalledTimes(1);
    stop();
  });

  it('keeps going when the native queue throws', () => {
    const sync = loadModule();
    mockTakePendingWidgetEvents.mockImplementationOnce(() => {
      throw new Error('boom');
    });
    expect(() => sync.consumeWidgetEvents()).not.toThrow();
  });
});

describe('startConfiguredWidgetSync', () => {
  it('runs a first sync and removes its listeners on cleanup', async () => {
    const sync = loadModule();
    const stop = sync.startConfiguredWidgetSync();
    await new Promise(resolve => setImmediate(resolve));
    expect(mockWriteCatalog).toHaveBeenCalledTimes(1);
    expect(mockReloadWidgets).toHaveBeenCalledWith(['AyahOfTheDay']);
    stop();
    expect(mockUnsubs).toHaveLength(3);
    mockUnsubs.forEach(u => expect(u).toHaveBeenCalled());
    expect(mockAppStateRemove).toHaveBeenCalled();
  });
});
