/**
 * restoreSession() brings back the queue saved with the player store, at the
 * place where the listener stopped.
 */
import type {Track} from '@/types/audio';

type MockRecentCard = {
  reciter: {id: string};
  surah: {id: number};
  rewayatId: string;
  progress: number;
  duration: number;
  isUserUpload?: boolean;
  userRecitationId?: string;
};

const mockLoadTrack = jest.fn<Promise<void>, [string]>();
const mockSeekTo = jest.fn<Promise<void>, [number]>();
let mockRecentTracks: MockRecentCard[] = [];
let mockUploads: {
  recitations: {id: string; filePath: string}[];
  loading: boolean;
  error: string | null;
};
type MockQueue = {tracks: Track[]; currentIndex: number; total: number};
type MockPlayback = {state: string; position: number; duration: number};
const mockPlayer = {
  queue: {tracks: [], currentIndex: 0, total: 0} as MockQueue,
  playback: {state: 'paused', position: 0, duration: 0} as MockPlayback,
  updateQueueState: (q: Partial<MockQueue>) => {
    mockPlayer.queue = {...mockPlayer.queue, ...q};
  },
  updatePlaybackState: (p: Partial<MockPlayback>) => {
    mockPlayer.playback = {...mockPlayer.playback, ...p};
  },
};

jest.mock('@/services/player/store/playerStore', () => ({
  usePlayerStore: {
    getState: () => mockPlayer,
    persist: {
      hasHydrated: () => true,
      onFinishHydration: () => () => undefined,
    },
  },
  currentPlayOpId: () => 0,
  setTrackUrlResolver: jest.fn(),
}));
jest.mock('@/services/player/store/recentlyPlayedStore', () => ({
  useRecentlyPlayedStore: {getState: () => ({recentTracks: mockRecentTracks})},
}));
jest.mock('@/store/uploadsStore', () => ({
  useUploadsStore: {getState: () => mockUploads},
}));
jest.mock('@/services/uploads/UploadsService', () => ({
  resolveRecitationPath: (name: string) => `file:///now/uploads/${name}`,
}));
jest.mock('@/services/dataService', () => ({
  getReciterByIdSync: (id: string) => (id === 'r1' ? {id: 'r1'} : undefined),
  getAvailableSurahsForRewayat: async () => [],
  getSurahById: () => undefined,
}));
jest.mock('@/utils/audioUtils', () => ({
  generateSmartAudioUrl: (_reciter: unknown, surahId: string) =>
    `https://cdn.example.com/r1/${surahId}.mp3`,
}));
jest.mock('@/utils/artworkUtils', () => ({getReciterArtwork: () => ''}));
jest.mock('@/utils/track', () => ({createUserUploadTrack: jest.fn()}));
jest.mock('@/services/audio/ExpoAudioService', () => ({
  expoAudioService: {
    loadTrack: (url: string) => mockLoadTrack(url),
    seekTo: (sec: number) => mockSeekTo(sec),
  },
}));
jest.mock('@/services/car/sessionGate', () => ({
  hasCarReplacedQueue: () => false,
}));

import {restoreSession, pendingRestoreLoad} from '../restoreSession';

const UPLOAD_URL = 'file:///same-container/uploads/up-1.m4a';

function surahTrack(surahId: number, rewayatId = 'hafs'): Track {
  return {
    id: `r1:${surahId}`,
    url: `https://cdn.example.com/r1/${surahId}.mp3`,
    title: `Surah ${surahId}`,
    artist: 'Reciter One',
    reciterId: 'r1',
    reciterName: 'Reciter One',
    surahId: String(surahId),
    rewayatId,
  };
}

function uploadTrack(id: string, url = UPLOAD_URL): Track {
  return {
    id: `upload-${id}`,
    url,
    title: 'My recitation',
    artist: 'Me',
    reciterId: '',
    reciterName: 'Me',
    isUserUpload: true,
    userRecitationId: id,
  };
}

function card(overrides: Partial<MockRecentCard> = {}): MockRecentCard {
  return {
    reciter: {id: 'r1'},
    surah: {id: 2},
    rewayatId: 'hafs',
    progress: 0.5,
    duration: 1000,
    ...overrides,
  };
}

function savedSession(
  tracks: Track[],
  currentIndex: number,
  position: number,
  duration: number,
): void {
  mockPlayer.queue = {tracks, currentIndex, total: tracks.length};
  mockPlayer.playback = {state: 'paused', position, duration};
}

async function restore(): Promise<void> {
  await restoreSession();
  jest.advanceTimersByTime(100);
  await pendingRestoreLoad();
}

describe('restoreSession(): the saved queue', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockLoadTrack.mockReset();
    mockLoadTrack.mockResolvedValue(undefined);
    mockSeekTo.mockReset();
    mockSeekTo.mockResolvedValue(undefined);
    mockRecentTracks = [];
    mockUploads = {recitations: [], loading: false, error: null};
  });
  afterEach(() => jest.useRealTimers());

  describe('where the restored track starts', () => {
    it("resumes at the recent card's place when an older build left the store at 0:00", async () => {
      // Builds that restored from the recent card wrote the 0:00 status of
      // their own load to the store and dropped the seek's status; when the
      // app then closed without playing, only the card kept the place.
      savedSession([surahTrack(2), surahTrack(3)], 0, 0, 1000);
      mockRecentTracks = [card({progress: 0.5, duration: 1000})];

      await restore();

      expect(mockPlayer.playback.position).toBe(500);
      expect(mockPlayer.playback.duration).toBe(1000);
      expect(mockLoadTrack).toHaveBeenCalledWith(
        'https://cdn.example.com/r1/2.mp3',
      );
      expect(mockSeekTo).toHaveBeenCalledWith(500);
      expect(mockPlayer.queue.tracks.map(t => t.id)).toEqual(['r1:2', 'r1:3']);
      expect(mockPlayer.queue.currentIndex).toBe(0);
    });

    it("keeps the store's position when it has one", async () => {
      savedSession([surahTrack(2)], 0, 120, 1000);
      mockRecentTracks = [card({progress: 0.5, duration: 1000})];

      await restore();

      expect(mockPlayer.playback.position).toBe(120);
      expect(mockSeekTo).toHaveBeenCalledWith(120);
    });

    it('starts a surah that was heard to its end over, not at its end', async () => {
      // A queue that finished leaves its last track at 0:00 and its card
      // at 100%.
      savedSession([surahTrack(2)], 0, 0, 1000);
      mockRecentTracks = [card({progress: 1, duration: 1000})];

      await restore();

      expect(mockPlayer.playback.position).toBe(0);
      expect(mockSeekTo).not.toHaveBeenCalled();
    });

    it.each([
      ['another surah', card({surah: {id: 3}})],
      ['another rewayah', card({rewayatId: 'warsh'})],
      ['another reciter', card({reciter: {id: 'r2'}})],
      ['an upload', card({isUserUpload: true, userRecitationId: 'up-1'})],
    ])(
      'does not take the place of a card for %s',
      async (_label, recentCard) => {
        savedSession([surahTrack(2)], 0, 0, 1000);
        mockRecentTracks = [recentCard];

        await restore();

        expect(mockPlayer.playback.position).toBe(0);
        expect(mockSeekTo).not.toHaveBeenCalled();
      },
    );
  });

  describe('uploads', () => {
    it.each([
      [
        'the uploads database did not open',
        {recitations: [], loading: true, error: null},
      ],
      [
        'reading the uploads failed',
        {recitations: [], loading: false, error: 'Failed to load recitations'},
      ],
    ])('keeps and loads the saved upload when %s', async (_label, uploads) => {
      mockUploads = uploads;
      savedSession([uploadTrack('up-1')], 0, 20, 100);
      mockRecentTracks = [
        card({isUserUpload: true, userRecitationId: 'up-1', progress: 0.2}),
      ];

      await restore();

      expect(mockPlayer.queue.tracks).toHaveLength(1);
      expect(mockPlayer.queue.tracks[0].url).toBe(UPLOAD_URL);
      expect(mockLoadTrack).toHaveBeenCalledWith(UPLOAD_URL);
      expect(mockSeekTo).toHaveBeenCalledWith(20);
      expect(mockPlayer.playback.position).toBe(20);
    });

    it('drops an upload that was deleted, once the uploads have loaded', async () => {
      mockUploads = {
        recitations: [{id: 'kept', filePath: 'kept.m4a'}],
        loading: false,
        error: null,
      };
      savedSession(
        [surahTrack(2), uploadTrack('gone'), uploadTrack('kept')],
        0,
        30,
        1000,
      );

      await restore();

      expect(mockPlayer.queue.tracks.map(t => t.id)).toEqual([
        'r1:2',
        'upload-kept',
      ]);
      expect(mockPlayer.queue.tracks[1].url).toBe(
        'file:///now/uploads/kept.m4a',
      );
      expect(mockLoadTrack).toHaveBeenCalledWith(
        'https://cdn.example.com/r1/2.mp3',
      );
    });
  });
});
