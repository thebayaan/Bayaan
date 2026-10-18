// Drives executeCarRequest with a stubbed resolver so each plan shape (start
// index, shuffle, chain) is exercised against the real queue and chain logic.
import type {Track} from '@/types/audio';
import type {RecentlyPlayedTrack} from '@/services/player/store/recentlyPlayedStore';
import type {
  CarQueuePlan,
  CarResolveContext,
} from '@/services/car/playback/resolveCarRequest';
import type {CarPlayRequest} from '@/services/car/types';

const mockEvents: string[] = [];
let mockContext: CarResolveContext | null = null;
let mockPlan: CarQueuePlan | null = null;

jest.mock('@/modules/bayaan-car', () => ({BayaanCar: {isAvailable: false}}));
jest.mock('@/services/audio/LockScreenService', () => ({
  lockScreenService: {setCarMode: jest.fn()},
}));
jest.mock('@/services/audio/ExpoAudioService', () => ({
  expoAudioService: {waitForPlayer: () => Promise.resolve()},
}));
jest.mock('@/data/reciterData', () => ({
  RECITERS: [{id: 'r1', name: 'R1', rewayat: []}],
}));
jest.mock('@/data/surahData', () => ({
  SURAHS: [{id: 1}, {id: 2}, {id: 3}, {id: 4}],
}));
jest.mock('@/data/systemPlaylists', () => ({getSystemPlaylists: () => []}));
jest.mock('@/utils/track', () => ({
  createTrack: (
    reciter: {id: string},
    surah: {id: number},
    rewayatId: string,
  ): Track => ({
    id: `${reciter.id}-${surah.id}`,
    url: 'u',
    title: `s${surah.id}`,
    artist: 'R1',
    reciterId: reciter.id,
    reciterName: 'R1',
    surahId: String(surah.id),
    rewayatId,
  }),
  // Reversal is deterministic and visibly differs from the input order.
  shuffleTracks: jest.fn((tracks: Track[]): Track[] => [...tracks].reverse()),
  addUploadToRecentlyPlayed: jest.fn(),
  createUserUploadTrack: jest.fn(),
}));
jest.mock('@/services/car/playback/resolveCarRequest', () => ({
  ...jest.requireActual('@/services/car/playback/resolveCarRequest'),
  resolveCarRequest: () => mockPlan,
}));
const mockUpdateQueue = jest.fn(
  async (_tracks: Track[], _index: number, _position?: number) => {
    mockEvents.push('queue');
  },
);
const mockPlay = jest.fn(async () => {
  mockEvents.push('play');
});
jest.mock('@/services/player/store/playerStore', () => ({
  usePlayerStore: {
    getState: () => ({updateQueue: mockUpdateQueue, play: mockPlay}),
  },
}));
const mockStartNewChain = jest.fn(() => mockEvents.push('new'));
const mockResumeChain = jest.fn((index: number) =>
  mockEvents.push(`resume:${index}`),
);
jest.mock('@/services/player/store/recentlyPlayedStore', () => ({
  useRecentlyPlayedStore: {
    getState: () => ({
      startNewChain: mockStartNewChain,
      resumeChain: mockResumeChain,
    }),
  },
}));
jest.mock('@/services/player/store/lovedStore', () => ({useLovedStore: {}}));
jest.mock('@/services/player/store/downloadStore', () => ({
  useDownloadStore: {},
}));
const mockWriteSnapshot = jest.fn(async () => undefined);
jest.mock('@/services/car/CarSnapshotService', () => ({
  getLastResolveContext: () => mockContext,
  writeCarSnapshotNow: () => mockWriteSnapshot(),
}));
jest.mock('@/services/car/sessionGate', () => ({
  markCarReplacedQueue: () => mockEvents.push('mark'),
  waitForSessionRestored: () => Promise.resolve(),
}));

import {shuffleTracks} from '@/utils/track';
import {executeCarRequest} from '../../CarPlaybackBridge';

const REQUEST: CarPlayRequest = {kind: 'loved'};

function context(recentTracks: RecentlyPlayedTrack[] = []): CarResolveContext {
  return {
    reciters: [],
    topReciterId: null,
    recentTracks,
    lovedTracks: [],
    downloads: [],
    systemPlaylists: [],
    playlistItems: {},
    uploads: [],
  };
}

function spec(surahId: number, reciterId: string = 'r1') {
  return {reciterId, rewayatId: 'hafs', surahId};
}

function plan(overrides: Partial<CarQueuePlan> = {}): CarQueuePlan {
  return {
    tracks: [spec(1), spec(2), spec(3)],
    startIndex: 0,
    startPosition: 0,
    shuffle: false,
    chain: 'none',
    ...overrides,
  };
}

function recent(surahId: number, duration: number): RecentlyPlayedTrack {
  return {
    reciter: {id: 'r1', name: 'R1', date: null, image_url: null, rewayat: []},
    surah: {
      id: surahId,
      name: 's',
      revelation_place: 'Makkah',
      revelation_order: 1,
      bismillah_pre: false,
      name_arabic: 's',
      verses_count: 1,
      pages: '1',
      translated_name_english: 's',
    },
    rewayatId: 'hafs',
    progress: 0.5,
    duration,
    timestamp: 1,
  };
}

function queuedIds(): string[] {
  return mockUpdateQueue.mock.calls[0][0].map(t => t.id);
}

beforeEach(() => {
  mockEvents.length = 0;
  mockContext = context();
  mockPlan = plan();
  jest.clearAllMocks();
});

describe('executeCarRequest queue', () => {
  it('queues the resolved tracks at the plan start index and position, then plays', async () => {
    mockPlan = plan({startIndex: 1, startPosition: 30});
    await executeCarRequest(REQUEST);
    expect(queuedIds()).toEqual(['r1-1', 'r1-2', 'r1-3']);
    expect(mockUpdateQueue.mock.calls[0][1]).toBe(1);
    expect(mockUpdateQueue.mock.calls[0][2]).toBe(30);
    expect(mockEvents).toEqual(['mark', 'queue', 'play']);
  });

  it('realigns the start index when specs before it cannot be built', async () => {
    // Two unknown reciters ahead of the start drop out of the queue.
    mockPlan = plan({
      tracks: [spec(1), spec(2, 'gone'), spec(3, 'gone'), spec(4)],
      startIndex: 3,
    });
    await executeCarRequest(REQUEST);
    expect(queuedIds()).toEqual(['r1-1', 'r1-4']);
    expect(mockUpdateQueue.mock.calls[0][1]).toBe(1);
  });

  it('leaves the start index alone when only later specs are dropped', async () => {
    mockPlan = plan({
      tracks: [spec(1), spec(2), spec(3, 'gone')],
      startIndex: 1,
    });
    await executeCarRequest(REQUEST);
    expect(queuedIds()).toEqual(['r1-1', 'r1-2']);
    expect(mockUpdateQueue.mock.calls[0][1]).toBe(1);
  });

  it('clamps the start index to the last track when the start spec itself is dropped', async () => {
    mockPlan = plan({tracks: [spec(1), spec(2, 'gone')], startIndex: 1});
    await executeCarRequest(REQUEST);
    expect(mockUpdateQueue.mock.calls[0][1]).toBe(0);
  });

  it('does nothing when no spec can be built', async () => {
    mockPlan = plan({tracks: [spec(1, 'gone'), spec(2, 'gone')]});
    await executeCarRequest(REQUEST);
    expect(mockUpdateQueue).not.toHaveBeenCalled();
    expect(mockPlay).not.toHaveBeenCalled();
    expect(mockEvents).toEqual([]);
  });

  it('does nothing when the request resolves to no plan', async () => {
    mockPlan = null;
    await executeCarRequest(REQUEST);
    expect(mockUpdateQueue).not.toHaveBeenCalled();
    expect(mockPlay).not.toHaveBeenCalled();
  });

  it('builds a snapshot first when none exists, and gives up if that yields no context', async () => {
    mockContext = null;
    await executeCarRequest(REQUEST);
    expect(mockWriteSnapshot).toHaveBeenCalledTimes(1);
    expect(mockUpdateQueue).not.toHaveBeenCalled();
  });

  it('does not rebuild the snapshot when one already exists', async () => {
    await executeCarRequest(REQUEST);
    expect(mockWriteSnapshot).not.toHaveBeenCalled();
  });
});

describe('executeCarRequest shuffle', () => {
  it('queues the shuffled order and starts at its first track, ignoring the plan index', async () => {
    mockPlan = plan({shuffle: true, startIndex: 2});
    await executeCarRequest(REQUEST);
    expect(shuffleTracks).toHaveBeenCalledTimes(1);
    expect(queuedIds()).toEqual(['r1-3', 'r1-2', 'r1-1']);
    expect(mockUpdateQueue.mock.calls[0][1]).toBe(0);
  });

  it('does not shuffle a plan that is not marked shuffle', async () => {
    await executeCarRequest(REQUEST);
    expect(shuffleTracks).not.toHaveBeenCalled();
    expect(queuedIds()).toEqual(['r1-1', 'r1-2', 'r1-3']);
  });

  it('starts the new chain on the track that plays first after shuffling', async () => {
    mockPlan = plan({shuffle: true, chain: 'new'});
    await executeCarRequest(REQUEST);
    expect(mockStartNewChain).toHaveBeenCalledTimes(1);
    expect(mockStartNewChain.mock.calls[0]).toMatchObject([
      {id: 'r1'},
      {id: 3},
      0,
      0,
      'hafs',
    ]);
  });
});

describe('executeCarRequest chain', () => {
  it('starts a new chain for the track at the start index, not the first in the list', async () => {
    mockPlan = plan({chain: 'new', startIndex: 2});
    await executeCarRequest(REQUEST);
    expect(mockStartNewChain).toHaveBeenCalledTimes(1);
    expect(mockStartNewChain.mock.calls[0]).toMatchObject([
      {id: 'r1'},
      {id: 3},
      0,
      0,
      'hafs',
    ]);
    expect(mockResumeChain).not.toHaveBeenCalled();
    expect(mockEvents).toEqual(['new', 'mark', 'queue', 'play']);
  });

  it('carries the saved progress into a new chain that starts mid-surah', async () => {
    mockContext = context([recent(1, 200)]);
    mockPlan = plan({chain: 'new', startPosition: 50});
    await executeCarRequest(REQUEST);
    expect(mockStartNewChain.mock.calls[0]).toMatchObject([
      {id: 'r1'},
      {id: 1},
      0.25,
      200,
      'hafs',
    ]);
  });

  it('does not start a new chain when no track could be built', async () => {
    mockPlan = plan({chain: 'new', tracks: [spec(1, 'gone')]});
    await executeCarRequest(REQUEST);
    expect(mockStartNewChain).not.toHaveBeenCalled();
  });

  it('resumes the matched recent entry, before replacing the queue', async () => {
    mockPlan = plan({chain: 'resume', recentIndex: 3});
    await executeCarRequest(REQUEST);
    expect(mockResumeChain).toHaveBeenCalledTimes(1);
    expect(mockResumeChain).toHaveBeenCalledWith(3);
    expect(mockStartNewChain).not.toHaveBeenCalled();
    expect(mockEvents).toEqual(['resume:3', 'mark', 'queue', 'play']);
  });

  it('resumes entry 0 when the plan carries no recent index', async () => {
    mockPlan = plan({chain: 'resume'});
    await executeCarRequest(REQUEST);
    expect(mockResumeChain).toHaveBeenCalledWith(0);
  });

  it('touches no chain for a plan with chain none', async () => {
    await executeCarRequest(REQUEST);
    expect(mockStartNewChain).not.toHaveBeenCalled();
    expect(mockResumeChain).not.toHaveBeenCalled();
    expect(mockEvents).toEqual(['mark', 'queue', 'play']);
  });
});
