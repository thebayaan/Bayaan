// Drives a cold-start car play request through session-restore ordering.
// Native queues the request until markJsReady; the bridge must not call it
// until the first snapshot exists AND restoreSession has settled, and a late
// restore must not overwrite the car's queue or swap its audio.
import type {CarPlayRequest} from '@/services/car/types';
import type {Track} from '@/types/audio';

interface FakeQueue {
  tracks: Track[];
  currentIndex: number;
}

const mockQueuedRequests: CarPlayRequest[] = [];
const mockPlayListeners: ((request: CarPlayRequest) => void)[] = [];
const mockConnectionListeners: ((connected: boolean) => void)[] = [];
const mockMarkJsReady = jest.fn((): void => {
  // Mirrors native: report the connection first, then flush queued
  // cold-start requests once JS is ready.
  mockConnectionListeners.forEach(fn => fn(true));
  mockQueuedRequests
    .splice(0)
    .forEach(request => mockPlayListeners.forEach(fn => fn(request)));
});

jest.mock('@/modules/bayaan-car', () => ({
  BayaanCar: {
    isAvailable: true,
    markJsReady: () => mockMarkJsReady(),
    setNowPlaying: jest.fn(),
    addPlayRequestListener: (fn: (request: CarPlayRequest) => void) => {
      mockPlayListeners.push(fn);
      return jest.fn();
    },
    addTransportListener: () => jest.fn(),
    addConnectionListener: (fn: (connected: boolean) => void) => {
      mockConnectionListeners.push(fn);
      return jest.fn();
    },
  },
}));
const mockSetCarMode = jest.fn();
jest.mock('@/services/audio/LockScreenService', () => ({
  lockScreenService: {
    setCarMode: (enabled: boolean) => mockSetCarMode(enabled),
  },
}));
jest.mock('@/data/reciterData', () => ({
  RECITERS: [{id: 'car-reciter', name: 'Car Reciter'}],
}));
jest.mock('@/data/surahData', () => ({
  SURAHS: [{id: 18, name: 'Al-Kahf'}],
}));
jest.mock('@/data/systemPlaylists', () => ({getSystemPlaylists: () => []}));

const mockCarTrack: Track = {
  id: 'car-reciter:18',
  url: 'https://car/18.mp3',
  title: 'Al-Kahf',
  artist: 'Car Reciter',
  reciterId: 'car-reciter',
  reciterName: 'Car Reciter',
  surahId: '18',
  rewayatId: 'hafs',
};

jest.mock('@/utils/track', () => ({
  createTrack: jest.fn(async () => mockCarTrack),
  shuffleTracks: jest.fn((tracks: Track[]) => tracks),
  createUserUploadTrack: jest.fn(),
}));
jest.mock('@/services/car/playback/resolveCarRequest', () => ({
  resolveCarRequest: () => ({
    tracks: [{reciterId: 'car-reciter', rewayatId: 'hafs', surahId: 18}],
    startIndex: 0,
    startPosition: 0,
    shuffle: false,
    chain: 'none',
  }),
  isUploadSpec: () => false,
}));
jest.mock('@/services/car/CarSnapshotService', () => ({
  getLastResolveContext: () => ({uploads: []}),
  writeCarSnapshotNow: jest.fn(),
}));

const mockQueue: FakeQueue = {tracks: [], currentIndex: 0};
const mockUpdateQueue = jest.fn(async (tracks: Track[], index: number) => {
  mockQueue.tracks = tracks;
  mockQueue.currentIndex = index;
});
const mockUpdateQueueState = jest.fn((next: FakeQueue) => {
  mockQueue.tracks = next.tracks;
  mockQueue.currentIndex = next.currentIndex;
});

jest.mock('@/services/player/store/playerStore', () => ({
  usePlayerStore: {
    getState: () => ({
      queue: mockQueue,
      playback: {state: 'paused', position: 0, duration: 0, rate: 1},
      settings: {repeatMode: 'none'},
      updateQueue: mockUpdateQueue,
      updateQueueState: mockUpdateQueueState,
      updatePlaybackState: jest.fn(),
      play: jest.fn(async () => undefined),
    }),
    subscribe: () => jest.fn(),
    persist: {
      hasHydrated: () => true,
      onFinishHydration: () => jest.fn(),
    },
  },
}));

const mockRestoredReciter = {id: 'restored-reciter', name: 'Restored'};
const mockRestoredSurah = {id: 2, name: 'Al-Baqarah'};
jest.mock('@/services/player/store/recentlyPlayedStore', () => ({
  useRecentlyPlayedStore: {
    getState: () => ({
      recentTracks: [
        {
          reciter: mockRestoredReciter,
          surah: mockRestoredSurah,
          rewayatId: 'hafs',
          progress: 0.5,
          duration: 100,
        },
      ],
    }),
  },
}));
jest.mock('@/services/player/store/lovedStore', () => ({
  useLovedStore: {
    getState: () => ({isLovedWithRewayat: () => false}),
    subscribe: () => jest.fn(),
  },
}));
jest.mock('@/services/player/store/downloadStore', () => ({
  useDownloadStore: {},
}));
jest.mock('@/store/uploadsStore', () => ({
  useUploadsStore: {getState: () => ({recitations: []})},
}));
const mockGetAvailableSurahs = jest.fn(async (): Promise<number[]> => [2]);
jest.mock('@/services/dataService', () => ({
  getAvailableSurahsForRewayat: () => mockGetAvailableSurahs(),
  getSurahById: () => mockRestoredSurah,
}));
jest.mock('@/utils/audioUtils', () => ({
  generateSmartAudioUrl: () => 'https://restored/2.mp3',
}));
jest.mock('@/utils/artworkUtils', () => ({getReciterArtwork: () => ''}));

const mockLoadTrack = jest.fn(async (_url: string): Promise<void> => undefined);
let mockPlayerReady: Promise<void> = Promise.resolve();
jest.mock('@/services/audio/ExpoAudioService', () => ({
  expoAudioService: {
    loadTrack: (url: string) => mockLoadTrack(url),
    seekTo: jest.fn(async () => undefined),
    waitForPlayer: () => mockPlayerReady,
  },
}));

const surahRequest: CarPlayRequest = {
  kind: 'surah',
  reciterId: 'car-reciter',
  rewayatId: 'hafs',
  surahId: 18,
};

type Modules = {
  bridge: typeof import('../CarPlaybackBridge');
  gate: typeof import('../sessionGate');
  restore: typeof import('@/services/player/utils/restoreSession');
};

function loadModules(): Modules {
  let modules: Modules | null = null;
  jest.isolateModules(() => {
    modules = {
      bridge: require('../CarPlaybackBridge'),
      gate: require('../sessionGate'),
      restore: require('@/services/player/utils/restoreSession'),
    };
  });
  if (!modules) throw new Error('modules failed to load');
  return modules;
}

// Each test loads the bridge and restore graph fresh (isolateModules), which
// takes several seconds on a busy machine.
jest.setTimeout(30_000);

describe('cold-start car request vs restoreSession', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockQueuedRequests.length = 0;
    mockPlayListeners.length = 0;
    mockConnectionListeners.length = 0;
    mockQueue.tracks = [];
    mockQueue.currentIndex = 0;
    mockPlayerReady = Promise.resolve();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('holds a queued request until restore settles, then restore leaves the car queue alone', async () => {
    const {bridge, gate, restore} = loadModules();
    mockQueuedRequests.push(surahRequest);

    bridge.startCarPlaybackBridge(Promise.resolve());
    await jest.advanceTimersByTimeAsync(0);
    // Snapshot is ready but the session is not restored yet.
    expect(mockMarkJsReady).not.toHaveBeenCalled();

    await restore.restoreSession();
    expect(mockQueue.tracks[0]?.id).toBe('restored-reciter:2');
    gate.markSessionRestored();
    await jest.advanceTimersByTimeAsync(0);

    expect(mockMarkJsReady).toHaveBeenCalledTimes(1);
    expect(mockUpdateQueue).toHaveBeenCalledTimes(1);
    expect(mockQueue.tracks[0]?.id).toBe('car-reciter:18');

    // restoreSession's deferred audio load must not swap the car's audio.
    await jest.advanceTimersByTimeAsync(200);
    expect(mockLoadTrack).not.toHaveBeenCalled();
    expect(mockQueue.tracks[0]?.id).toBe('car-reciter:18');
  });

  it('waits for the first snapshot too', async () => {
    const {bridge, gate} = loadModules();
    let resolveSnapshot: () => void = jest.fn();
    const snapshotReady = new Promise<void>(resolve => {
      resolveSnapshot = resolve;
    });

    bridge.startCarPlaybackBridge(snapshotReady);
    gate.markSessionRestored();
    await jest.advanceTimersByTimeAsync(0);
    expect(mockMarkJsReady).not.toHaveBeenCalled();

    resolveSnapshot();
    await jest.advanceTimersByTimeAsync(0);
    expect(mockMarkJsReady).toHaveBeenCalledTimes(1);
  });

  it('waits for the audio player before flushing queued requests', async () => {
    const {bridge, gate} = loadModules();
    let attachPlayer: () => void = jest.fn();
    mockPlayerReady = new Promise<void>(resolve => {
      attachPlayer = resolve;
    });
    mockQueuedRequests.push(surahRequest);

    bridge.startCarPlaybackBridge(Promise.resolve());
    gate.markSessionRestored();
    await jest.advanceTimersByTimeAsync(0);
    // Snapshot and session are ready, but the phone layout has not attached
    // the player yet (iOS CarPlay cold start).
    expect(mockMarkJsReady).not.toHaveBeenCalled();
    expect(mockUpdateQueue).not.toHaveBeenCalled();

    attachPlayer();
    await jest.advanceTimersByTimeAsync(0);
    expect(mockMarkJsReady).toHaveBeenCalledTimes(1);
    expect(mockUpdateQueue).toHaveBeenCalledTimes(1);
  });

  it('times out a hung restore, and the late restore leaves the car queue alone', async () => {
    const {bridge, restore} = loadModules();
    mockQueuedRequests.push(surahRequest);
    let releaseRestore: (ids: number[]) => void = jest.fn();
    mockGetAvailableSurahs.mockImplementationOnce(
      () =>
        new Promise<number[]>(resolve => {
          releaseRestore = resolve;
        }),
    );

    bridge.startCarPlaybackBridge(Promise.resolve());
    const restoring = restore.restoreSession();

    await jest.advanceTimersByTimeAsync(bridge.SESSION_RESTORE_TIMEOUT_MS - 1);
    expect(mockMarkJsReady).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1);
    expect(mockMarkJsReady).toHaveBeenCalledTimes(1);
    expect(mockQueue.tracks[0]?.id).toBe('car-reciter:18');

    // The hung restore finally completes after the car took over.
    releaseRestore([2]);
    await restoring;
    await jest.advanceTimersByTimeAsync(200);
    expect(mockUpdateQueueState).not.toHaveBeenCalled();
    expect(mockLoadTrack).not.toHaveBeenCalled();
    expect(mockQueue.tracks[0]?.id).toBe('car-reciter:18');
  });

  it('applies car mode before a queued request loads its track', async () => {
    const {bridge, gate} = loadModules();
    mockQueuedRequests.push(surahRequest);
    bridge.startCarPlaybackBridge(Promise.resolve());
    gate.markSessionRestored();
    await jest.advanceTimersByTimeAsync(0);

    expect(mockUpdateQueue).toHaveBeenCalledTimes(1);
    expect(mockSetCarMode).toHaveBeenCalledWith(true);
    // Car mode must already hide the skip buttons when the car's track
    // activates the lock screen, or the first forward tap seeks 10s.
    expect(mockSetCarMode.mock.invocationCallOrder[0]).toBeLessThan(
      mockUpdateQueue.mock.invocationCallOrder[0],
    );
  });
});
