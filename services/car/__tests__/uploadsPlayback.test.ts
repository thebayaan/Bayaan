// Drives car upload requests through the real resolver and the bridge. The
// bridge must play uploads the way the phone's Uploads screen and Jump back
// in card do.
import type {Track} from '@/types/audio';
import type {UploadedRecitation} from '@/types/uploads';
import type {RecentlyPlayedTrack} from '@/services/player/store/recentlyPlayedStore';
import type {CarResolveContext} from '@/services/car/playback/resolveCarRequest';

function mockUpload(id: string): UploadedRecitation {
  return {
    id,
    filePath: `${id}.mp3`,
    originalFilename: `${id}.mp3`,
    duration: 60,
    dateAdded: 1,
    type: null,
    surahNumber: null,
    startVerse: null,
    endVerse: null,
    title: null,
    category: null,
    reciterId: null,
    customReciterId: null,
    isPersonal: false,
    rewayah: null,
    style: null,
    recordingType: null,
  };
}

const mockEvents: string[] = [];
let mockContext: CarResolveContext | null = null;

jest.mock('@/modules/bayaan-car', () => ({BayaanCar: {isAvailable: false}}));
jest.mock('@/services/audio/ExpoAudioService', () => ({
  expoAudioService: {waitForPlayer: () => Promise.resolve()},
}));
jest.mock('@/services/audio/LockScreenService', () => ({
  lockScreenService: {setCarMode: jest.fn()},
}));
jest.mock('@/data/reciterData', () => ({RECITERS: []}));
jest.mock('@/data/surahData', () => ({SURAHS: []}));
jest.mock('@/data/systemPlaylists', () => ({getSystemPlaylists: () => []}));
jest.mock('@/utils/track', () => ({
  createTrack: jest.fn(),
  shuffleTracks: jest.fn(),
  createUserUploadTrack: (u: UploadedRecitation): Track => ({
    id: `upload-${u.id}`,
    url: u.filePath,
    title: u.id,
    artist: 'My Recitations',
    reciterId: '',
    reciterName: 'My Recitations',
    isUserUpload: true,
    userRecitationId: u.id,
  }),
  addUploadToRecentlyPlayed: (u: UploadedRecitation) =>
    mockEvents.push(`recent:${u.id}`),
}));
const mockUpdateQueue = jest.fn(
  async (_tracks: Track[], _index: number, _position?: number) => {
    mockEvents.push('queue');
  },
);
jest.mock('@/services/player/store/playerStore', () => ({
  usePlayerStore: {
    getState: () => ({
      updateQueue: mockUpdateQueue,
      play: async () => {
        mockEvents.push('play');
      },
    }),
  },
}));
const mockStartNewChain = jest.fn();
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
jest.mock('@/services/car/CarSnapshotService', () => ({
  getLastResolveContext: () => mockContext,
  writeCarSnapshotNow: jest.fn(),
}));

import {executeCarRequest} from '../CarPlaybackBridge';

function context(
  uploads: UploadedRecitation[],
  recentTracks: RecentlyPlayedTrack[] = [],
): CarResolveContext {
  return {
    reciters: [],
    topReciterId: null,
    recentTracks,
    lovedTracks: [],
    downloads: [],
    systemPlaylists: [],
    playlistItems: {},
    uploads,
  };
}

beforeEach(() => {
  mockEvents.length = 0;
  mockUpdateQueue.mockClear();
  mockStartNewChain.mockClear();
  mockResumeChain.mockClear();
});

describe('car upload playback', () => {
  it('queues every upload from the chosen one and records it after play', async () => {
    mockContext = context([mockUpload('a'), mockUpload('b'), mockUpload('c')]);
    await executeCarRequest({kind: 'uploads', startIndex: 1});
    const [tracks, index, position] = mockUpdateQueue.mock.calls[0];
    expect(tracks.map(t => t.id)).toEqual(['upload-a', 'upload-b', 'upload-c']);
    expect(index).toBe(1);
    expect(position).toBe(0);
    expect(mockEvents).toEqual(['queue', 'play', 'recent:b']);
    expect(mockStartNewChain).not.toHaveBeenCalled();
  });

  it('resumes a recent upload alone at its saved position', async () => {
    const recent: RecentlyPlayedTrack = {
      reciter: {
        id: '__uploads__',
        name: 'x',
        date: null,
        image_url: null,
        rewayat: [],
      },
      surah: {
        id: 0,
        name: 'Upload',
        revelation_place: 'Makkah',
        revelation_order: 0,
        bismillah_pre: false,
        name_arabic: '',
        verses_count: 0,
        pages: '',
        translated_name_english: '',
      },
      rewayatId: '',
      progress: 0.25,
      duration: 80,
      timestamp: 1,
      isUserUpload: true,
      userRecitationId: 'b',
    };
    mockContext = context([mockUpload('a'), mockUpload('b')], [recent]);
    await executeCarRequest({kind: 'resume', recitationId: 'b'});
    const [tracks, index, position] = mockUpdateQueue.mock.calls[0];
    expect(tracks.map(t => t.id)).toEqual(['upload-b']);
    expect(index).toBe(0);
    expect(position).toBe(20);
    expect(mockEvents).toEqual(['resume:0', 'queue', 'play']);
    expect(mockStartNewChain).not.toHaveBeenCalled();
  });
});
