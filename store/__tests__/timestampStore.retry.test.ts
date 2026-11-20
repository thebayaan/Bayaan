// @ai-generated
/**
 * The main player's timings failed to load (no connection). They used to be
 * tried again only on "Play from here" or a track change, so a long surah
 * stayed "Verse tracking unavailable" after a brief drop. They are now tried
 * again when the connection comes back and when the app returns to the
 * foreground.
 */
import {AppState, type AppStateStatus} from 'react-native';

jest.mock('@/data/reciterData', () => ({
  RECITERS: jest
    .requireActual('@/services/timestamps/__fixtures__/timingFixtures')
    .fixtureCatalog(),
}));
jest.mock('@/services/timestamps/TimestampService', () => ({
  timestampService: {getTimestampsForSurah: jest.fn()},
}));
jest.mock('@/services/timestamps/TimestampFetchService', () => ({
  timestampFetchService: {
    hasSurah: () => true,
    hasSource: () => true,
    // @ai-start
    // Every fixture rewayah has a source, as hasSource says.
    rewayatWithSource: () =>
      jest
        .requireMock('@/data/reciterData')
        .RECITERS.flatMap((reciter: {rewayat: unknown[]}) =>
          reciter.rewayat.map(rewayat => ({reciter, rewayat})),
        ),
    // @ai-end
  },
}));

type Store = typeof import('@/store/timestampStore');
type NetworkStore = typeof import('@/store/networkStore');
type TimingsService =
  typeof import('@/services/timestamps/TimestampService').timestampService;

let appStateListeners: ((state: AppStateStatus) => void)[] = [];
let timestampStore: Store;
let network: NetworkStore;
let getTimestamps: jest.Mock;
let loadTimings: (set: string, surah: number) => unknown;

const store = () => timestampStore.useTimestampStore.getState();

async function flush(): Promise<void> {
  for (let i = 0; i < 20; i++) await Promise.resolve();
}

function foreground(): void {
  appStateListeners.forEach(listener => listener('active'));
}

function setOnline(online: boolean): void {
  network.useNetworkStore.getState().setOnline(online);
}

/** A track whose timings could not be fetched. */
async function failedLoad(): Promise<void> {
  getTimestamps.mockResolvedValueOnce(null);
  await store().loadTimestampsForSurah('hafs-clean', 2);
  expect(store().timestampLoadStatus).toBe('failed');
  getTimestamps.mockClear();
}

beforeEach(() => {
  appStateListeners = [];
  jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation((_type, listener) => {
      appStateListeners.push(listener as (state: AppStateStatus) => void);
      return {remove: jest.fn()} as unknown as ReturnType<
        typeof AppState.addEventListener
      >;
    });
  jest.isolateModules(() => {
    timestampStore = require('@/store/timestampStore');
    network = require('@/store/networkStore');
    const service: TimingsService =
      require('@/services/timestamps/TimestampService').timestampService;
    getTimestamps = service.getTimestampsForSurah as jest.Mock;
    loadTimings =
      require('@/services/timestamps/__fixtures__/timingFixtures').loadTimings;
  });
  store().loadFollowAlongRegistry();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('a failed timing load is tried again', () => {
  it('when the connection comes back', async () => {
    setOnline(false);
    await failedLoad();
    getTimestamps.mockResolvedValueOnce(loadTimings('hafs-clean', 2));

    setOnline(true);
    await flush();

    expect(getTimestamps).toHaveBeenCalledWith('hafs-clean', 2);
    expect(store().timestampLoadStatus).toBe('ready');
    expect(store().currentTimestampKey).toBe('hafs-clean-2');
  });

  it('when the app returns to the foreground', async () => {
    await failedLoad();
    getTimestamps.mockResolvedValueOnce(loadTimings('hafs-clean', 2));

    foreground();
    await flush();

    expect(getTimestamps).toHaveBeenCalledTimes(1);
    expect(store().timestampLoadStatus).toBe('ready');
  });

  it('not on a foreground while offline', async () => {
    setOnline(false);
    await failedLoad();

    foreground();
    await flush();

    expect(getTimestamps).not.toHaveBeenCalled();
    expect(store().timestampLoadStatus).toBe('failed');
  });

  it('nothing is loaded again when the last load did not fail', async () => {
    getTimestamps.mockResolvedValueOnce(loadTimings('hafs-clean', 2));
    await store().loadTimestampsForSurah('hafs-clean', 2);
    getTimestamps.mockClear();

    foreground();
    setOnline(false);
    setOnline(true);
    await flush();

    expect(getTimestamps).not.toHaveBeenCalled();
    expect(store().timestampLoadStatus).toBe('ready');
  });
});
