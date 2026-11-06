// @ai-generated
// After a restart the player used to rebuild the queue from the recent
// track alone: every surah of that rewayah, starting at the current one.
// A queue three tracks in came back with those three moved to the end and
// nothing marked as played, and a playlist or mixed queue was replaced.
// The persisted queue is now kept when it still holds the resumed track.
import type {Track} from '@/types/audio';

interface FakeQueue {
  tracks: Track[];
  currentIndex: number;
}

const mockQueue: FakeQueue = {tracks: [], currentIndex: 0};
const mockUpdateQueueState = jest.fn((next: FakeQueue) => {
  mockQueue.tracks = next.tracks;
  mockQueue.currentIndex = next.currentIndex;
});
const mockUpdatePlaybackState = jest.fn();
const mockLoadTrack = jest.fn(async (_url: string) => undefined);
const mockSeekTo = jest.fn(async (_position: number) => undefined);

jest.mock('@/services/player/store/playerStore', () => ({
  usePlayerStore: {
    getState: () => ({
      queue: mockQueue,
      playback: {state: 'paused', position: 0, duration: 0, rate: 1},
      updateQueueState: mockUpdateQueueState,
      updatePlaybackState: mockUpdatePlaybackState,
    }),
    persist: {
      hasHydrated: () => true,
      onFinishHydration: () => jest.fn(),
    },
  },
  currentPlayOpId: () => 0,
}));

const reciterA = {id: 'a', name: 'A', rewayat: [{id: 'hafs'}]};
const reciterB = {id: 'b', name: 'B', rewayat: [{id: 'warsh'}]};
const mockRecent = {
  reciter: reciterA,
  surah: {id: 4, name: 'An-Nisa'},
  rewayatId: 'hafs',
  progress: 0.5,
  duration: 200,
  timestamp: 0,
};
jest.mock('@/services/player/store/recentlyPlayedStore', () => ({
  useRecentlyPlayedStore: {
    getState: () => ({recentTracks: [mockRecent]}),
  },
}));

jest.mock('@/services/dataService', () => ({
  getAvailableSurahsForRewayat: async () => [1, 2, 3, 4, 5],
  getSurahById: (id: number) => ({id, name: `S${id}`}),
  getReciterById: async (id: string) => (id === 'b' ? reciterB : undefined),
}));
jest.mock('@/utils/audioUtils', () => ({
  // Fresh URLs, so the test can tell rebuilt ones from saved ones.
  generateSmartAudioUrl: (
    reciter: {id: string},
    surahId: string,
    rewayatId?: string,
  ) => `new://${reciter.id}/${rewayatId}/${surahId}`,
}));
jest.mock('@/utils/artworkUtils', () => ({getReciterArtwork: () => 'art'}));
jest.mock('@/services/audio/ExpoAudioService', () => ({
  expoAudioService: {
    loadTrack: (url: string) => mockLoadTrack(url),
    seekTo: (position: number) => mockSeekTo(position),
  },
}));
jest.mock('@/store/uploadsStore', () => ({
  useUploadsStore: {getState: () => ({recitations: []})},
}));
jest.mock('@/utils/track', () => ({createUserUploadTrack: jest.fn()}));
jest.mock('@/services/car/sessionGate', () => ({
  hasCarReplacedQueue: () => false,
}));

import {
  restoreSession,
  restorablePersistedQueue,
  pendingRestoreLoad,
} from '../restoreSession';

function track(
  reciterId: string,
  surahId: number,
  rewayatId: string,
  extra: Partial<Track> = {},
): Track {
  return {
    id: `${reciterId}:${surahId}`,
    url: `old://${reciterId}/${surahId}`,
    title: `S${surahId}`,
    artist: reciterId,
    reciterId,
    reciterName: reciterId,
    surahId: String(surahId),
    rewayatId,
    ...extra,
  };
}

const surahIds = (tracks: Track[]) => tracks.map(t => t.surahId);

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
});
afterEach(() => jest.useRealTimers());

async function restore() {
  await restoreSession();
  jest.advanceTimersByTime(100);
  await pendingRestoreLoad();
}

it('keeps a queue three tracks in, with the played tracks first', async () => {
  mockQueue.tracks = [1, 2, 3, 4, 5].map(id => track('a', id, 'hafs'));
  mockQueue.currentIndex = 3;
  await restore();
  expect(surahIds(mockQueue.tracks)).toEqual(['1', '2', '3', '4', '5']);
  expect(mockQueue.currentIndex).toBe(3);
  expect(mockUpdatePlaybackState).toHaveBeenCalledWith({
    position: 100,
    duration: 200,
    state: 'paused',
  });
  // The current track's audio loads from a rebuilt URL, at the saved spot.
  expect(mockLoadTrack).toHaveBeenCalledWith('new://a/hafs/4');
  expect(mockSeekTo).toHaveBeenCalledWith(100);
});

it('keeps another reciter’s tracks in a mixed queue', async () => {
  mockQueue.tracks = [track('b', 1, 'warsh'), track('a', 4, 'hafs')];
  mockQueue.currentIndex = 1;
  await restore();
  expect(mockQueue.tracks.map(t => t.url)).toEqual([
    'new://b/warsh/1',
    'new://a/hafs/4',
  ]);
});

it('rebuilds the queue when the saved one moved on to another track', async () => {
  mockQueue.tracks = [track('a', 7, 'hafs')];
  mockQueue.currentIndex = 0;
  await restore();
  // Today's fallback: the rewayah's surahs from the resumed one.
  expect(surahIds(mockQueue.tracks)).toEqual(['4', '5', '1', '2', '3']);
  expect(mockQueue.currentIndex).toBe(0);
});

it('rebuilds the queue when nothing was saved', async () => {
  mockQueue.tracks = [];
  mockQueue.currentIndex = 0;
  await restore();
  expect(surahIds(mockQueue.tracks)).toEqual(['4', '5', '1', '2', '3']);
});

describe('restorablePersistedQueue', () => {
  it('needs the same rewayah as the resumed track', async () => {
    const queue = {tracks: [track('a', 4, 'warsh')], currentIndex: 0};
    expect(await restorablePersistedQueue(queue, mockRecent as never)).toBe(
      null,
    );
  });

  it('keeps the saved URL of a reciter it can no longer find', async () => {
    const queue = {
      tracks: [track('gone', 1, 'hafs'), track('a', 4, 'hafs')],
      currentIndex: 1,
    };
    const tracks = await restorablePersistedQueue(queue, mockRecent as never);
    expect(tracks?.map(t => t.url)).toEqual(['old://gone/1', 'new://a/hafs/4']);
  });

  it('leaves uploads in the queue untouched', async () => {
    const upload = track('me', 0, 'hafs', {
      isUserUpload: true,
      surahId: undefined,
      url: 'file://upload.m4a',
    });
    const queue = {tracks: [upload, track('a', 4, 'hafs')], currentIndex: 1};
    const tracks = await restorablePersistedQueue(queue, mockRecent as never);
    expect(tracks?.[0]).toBe(upload);
  });
});
