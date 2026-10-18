import {defaultDeps} from '../handleWidgetCommand';

const order: string[] = [];
let mockLoaded = false;
let releaseRestore: () => void = () => undefined;

const mockStore = {
  queue: {tracks: [{id: 't'}], currentIndex: 0},
  playback: {position: 42},
  play: jest.fn(async () => void order.push('play')),
  updateQueue: jest.fn(
    async (_t: unknown, index: number, start: number) =>
      void order.push(`updateQueue:${index}@${start}`),
  ),
};

jest.mock('@/services/player/store/playerStore', () => ({
  usePlayerStore: {getState: () => mockStore},
}));
jest.mock('@/services/audio/ExpoAudioService', () => ({
  expoAudioService: {getIsLoaded: () => mockLoaded},
}));
jest.mock('@/services/player/utils/restoreSession', () => ({
  pendingRestoreLoad: () =>
    new Promise<void>(resolve => {
      releaseRestore = () => {
        order.push('restoreSettled');
        resolve();
      };
    }),
}));
jest.mock('@/services/player/utils/resumeRecent', () => ({
  resumeRecent: jest.fn(),
}));
jest.mock('@/utils/track', () => ({createTrack: jest.fn()}));
jest.mock('@/services/dataService', () => ({
  getReciterByIdSync: jest.fn(),
  getSurahById: jest.fn(),
}));
jest.mock('@/store/reciterStore', () => ({useReciterStore: {}}));
jest.mock('@/services/player/store/recentlyPlayedStore', () => ({
  useRecentlyPlayedStore: {},
}));
jest.mock('@/services/timestamps/TimestampService', () => ({
  timestampService: {},
}));

function flush(): Promise<void> {
  return new Promise(resolve => setImmediate(resolve));
}

describe('defaultDeps.loadAndPlayCurrent', () => {
  beforeEach(() => {
    order.length = 0;
  });

  it('waits for the restore load, then plays the loaded source', async () => {
    mockLoaded = false;
    const done = defaultDeps().loadAndPlayCurrent();
    await flush();
    expect(order).toEqual([]);
    mockLoaded = true; // the restore load finished loading the track
    releaseRestore();
    await done;
    expect(order).toEqual(['restoreSettled', 'play']);
  });

  it('loads through updateQueue when nothing is loaded after the wait', async () => {
    mockLoaded = false;
    const done = defaultDeps().loadAndPlayCurrent();
    await flush();
    releaseRestore();
    await done;
    expect(order).toEqual(['restoreSettled', 'updateQueue:0@42']);
  });
});
