// @ai-generated
/**
 * Deleting an upload removed its file and its row and nothing else. It stayed
 * in the play queue with a dead path, and stayed listed in Loved and in
 * playlists as a row that could not be played. The delete now also removes
 * it from all three.
 *
 * Runs the real uploads, loved and playlists stores over a real playlists
 * database; only the file/row delete and the player store are stand-ins.
 */
jest.mock(
  'expo-sqlite',
  () => require('@/test-utils/mockExpoSqlite').expoSqliteModule,
);
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
}));
jest.mock('@/services/analytics/AnalyticsService', () => ({
  analyticsService: {
    trackFavoriteToggled: jest.fn(),
    trackPlaylistModified: jest.fn(),
  },
}));
jest.mock('@/services/dataService', () => ({getReciterName: () => null}));

const mockDeleteRecitation = jest.fn<Promise<void>, [string]>();
jest.mock('@/services/uploads/UploadsService', () => ({
  uploadsService: {
    deleteRecitation: (id: string) => mockDeleteRecitation(id),
  },
}));

interface QueuedTrack {
  id: string;
  userRecitationId?: string;
}
let mockQueue: QueuedTrack[] = [];
const mockRemoveFromQueue = jest.fn<Promise<void>, [number[]]>();
jest.mock('@/services/player/store/playerStore', () => ({
  usePlayerStore: {
    getState: () => ({
      queue: {tracks: mockQueue},
      removeFromQueue: (indices: number[]) => mockRemoveFromQueue(indices),
    }),
  },
}));

import type {UploadedRecitation} from '@/types/uploads';

type MockModule = typeof import('@/test-utils/mockExpoSqlite');
type UploadsStore = typeof import('../uploadsStore').useUploadsStore;
type PlaylistsStore = typeof import('../playlistsStore').usePlaylistsStore;
type LovedStore =
  typeof import('@/services/player/store/lovedStore').useLovedStore;

const R = 'reciter-a';

const upload = (id: string, surahNumber: number): UploadedRecitation => ({
  id,
  filePath: `${id}.mp3`,
  originalFilename: `${id}.mp3`,
  duration: null,
  dateAdded: 1,
  type: 'surah',
  surahNumber,
  startVerse: null,
  endVerse: null,
  title: null,
  category: null,
  reciterId: R,
  customReciterId: null,
  isPersonal: false,
  rewayah: null,
  style: null,
  recordingType: null,
});

describe('deleting an upload', () => {
  let mock: MockModule;
  let uploads: UploadsStore;
  let playlists: PlaylistsStore;
  let loved: LovedStore;
  let playlistId: string;
  let warn: jest.SpyInstance;

  const lovedIds = () =>
    loved.getState().tracks.map(t => t.userRecitationId ?? t.rewayatId);
  const playlistItems = async () =>
    (await playlists.getState().getPlaylistItems(playlistId)).map(
      item => item.userRecitationId ?? item.rewayatId,
    );
  const itemCount = () =>
    playlists.getState().playlists.find(p => p.id === playlistId)?.itemCount;

  beforeEach(async () => {
    jest.resetModules();
    jest.clearAllMocks();
    mockDeleteRecitation.mockResolvedValue(undefined);
    mockRemoveFromQueue.mockResolvedValue(undefined);
    warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    mock = require('@/test-utils/mockExpoSqlite');
    uploads = require('../uploadsStore').useUploadsStore;
    playlists = require('../playlistsStore').usePlaylistsStore;
    loved = require('@/services/player/store/lovedStore').useLovedStore;

    uploads.setState({
      recitations: [upload('u1', 36), upload('u2', 2), upload('u3', 67)],
      totalCount: 3,
    });

    // A catalogue recording and the three uploads, loved and in a playlist.
    playlistId = (await playlists.getState().createPlaylist('Mix', '#6366F1'))
      .id;
    const add = playlists.getState().addToPlaylist;
    await add(playlistId, '36', R, 'rw1');
    await add(playlistId, '36', R, undefined, 'u1');
    await add(playlistId, '2', R, undefined, 'u2');
    await add(playlistId, '67', R, undefined, 'u3');
    loved.setState({tracks: []});
    loved.getState().toggleLoved(R, '36', 'rw1');
    loved.getState().toggleLoved(R, '36', '', 'u1');
    loved.getState().toggleLoved(R, '2', '', 'u2');

    mockQueue = [
      {id: 'catalogue'},
      {id: 'upload-u1', userRecitationId: 'u1'},
      {id: 'upload-u2', userRecitationId: 'u2'},
      {id: 'upload-u1-again', userRecitationId: 'u1'},
    ];
  });

  afterEach(async () => {
    warn.mockRestore();
    await mock.resetDatabases();
  });

  it('removes it from Loved, playlists and the queue', async () => {
    expect(itemCount()).toBe(4);

    await uploads.getState().deleteRecitation('u1');

    expect(mockDeleteRecitation).toHaveBeenCalledWith('u1');
    expect(uploads.getState().recitations.map(r => r.id)).toEqual(['u2', 'u3']);
    expect(lovedIds()).toEqual(['u2', 'rw1']);
    expect(await playlistItems()).toEqual(['u3', 'u2', 'rw1']);
    // The shared playlist list is refreshed, so an open playlist reloads.
    expect(itemCount()).toBe(3);
    expect(mockRemoveFromQueue).toHaveBeenCalledWith([1, 3]);
  });

  it('only cleans the places that had it', async () => {
    mockQueue = [{id: 'catalogue'}];

    await uploads.getState().deleteRecitation('u3');

    // u3 is in the playlist but not loved or queued.
    expect(lovedIds()).toEqual(['u2', 'u1', 'rw1']);
    expect(await playlistItems()).toEqual(['u2', 'u1', 'rw1']);
    expect(mockRemoveFromQueue).not.toHaveBeenCalled();
  });

  it('leaves everything in place when the delete itself fails', async () => {
    mockDeleteRecitation.mockRejectedValue(new Error('file is locked'));

    await expect(uploads.getState().deleteRecitation('u1')).rejects.toThrow(
      'file is locked',
    );

    expect(uploads.getState().recitations).toHaveLength(3);
    expect(lovedIds()).toEqual(['u2', 'u1', 'rw1']);
    expect(await playlistItems()).toHaveLength(4);
    expect(mockRemoveFromQueue).not.toHaveBeenCalled();
  });

  it('a clean-up that fails does not fail the delete, and the rest is still cleaned', async () => {
    mockRemoveFromQueue.mockRejectedValue(new Error('player is busy'));

    await uploads.getState().deleteRecitation('u1');

    expect(uploads.getState().recitations.map(r => r.id)).toEqual(['u2', 'u3']);
    expect(lovedIds()).toEqual(['u2', 'rw1']);
    expect(await playlistItems()).toEqual(['u3', 'u2', 'rw1']);
  });

  it('"Remove all" removes every upload from Loved, playlists and the queue', async () => {
    await uploads.getState().deleteAllRecitations();

    expect(uploads.getState().recitations).toEqual([]);
    expect(lovedIds()).toEqual(['rw1']);
    expect(await playlistItems()).toEqual(['rw1']);
    expect(itemCount()).toBe(1);
    expect(mockRemoveFromQueue).toHaveBeenCalledWith([1, 2, 3]);
  });

  it('"Remove all" that stops part-way still cleans up the ones it deleted', async () => {
    mockDeleteRecitation
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('file is locked'));

    await expect(uploads.getState().deleteAllRecitations()).rejects.toThrow(
      'file is locked',
    );

    // u1 was deleted before u2 failed.
    expect(lovedIds()).toEqual(['u2', 'rw1']);
    expect(await playlistItems()).toEqual(['u3', 'u2', 'rw1']);
    expect(mockRemoveFromQueue).toHaveBeenCalledWith([1, 3]);
  });
});
