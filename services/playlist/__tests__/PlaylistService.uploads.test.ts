// @ai-generated
/**
 * Uploads inside playlists. An item was "already in the playlist" when its
 * surah, reciter and rewayah matched, so an upload could not be added next
 * to the catalogue recording of the same surah, and a second upload of the
 * same surah could not be added at all. Deleting an upload left it in its
 * playlists as a row that could not be played.
 */
jest.mock(
  'expo-sqlite',
  () => require('@/test-utils/mockExpoSqlite').expoSqliteModule,
);

type MockModule = typeof import('@/test-utils/mockExpoSqlite');
type Playlists = typeof import('../PlaylistService').playlistService;

describe('uploads in playlists', () => {
  let mock: MockModule;
  let playlists: Playlists;
  let playlistId: string;

  const items = async (id = playlistId) =>
    (await playlists.getPlaylistItems(id)).map(item => ({
      surahId: item.surahId,
      rewayatId: item.rewayatId,
      userRecitationId: item.userRecitationId,
    }));

  beforeEach(async () => {
    jest.resetModules();
    mock = require('@/test-utils/mockExpoSqlite');
    playlists = require('../PlaylistService').playlistService;
    playlistId = (await playlists.createPlaylist('Morning', '#6366F1')).id;
  });

  afterEach(async () => {
    await mock.resetDatabases();
  });

  it('an upload can sit next to the catalogue recording of the same surah', async () => {
    await playlists.addToPlaylist(playlistId, '36', 'r1', undefined);
    await playlists.addToPlaylist(playlistId, '36', 'r1', undefined, 'u1');

    expect(await items()).toEqual([
      {surahId: '36', rewayatId: undefined, userRecitationId: 'u1'},
      {surahId: '36', rewayatId: undefined, userRecitationId: undefined},
    ]);
  });

  it('two uploads of the same surah can both be added', async () => {
    await playlists.addToPlaylist(playlistId, '36', 'r1', undefined, 'u1');
    await playlists.addToPlaylist(playlistId, '36', 'r1', undefined, 'u2');

    expect((await items()).map(item => item.userRecitationId)).toEqual([
      'u2',
      'u1',
    ]);
  });

  it('the same recitation is still added only once', async () => {
    await playlists.addToPlaylist(playlistId, '36', 'r1', 'rw1');
    await playlists.addToPlaylist(playlistId, '36', 'r1', 'rw1');
    await playlists.addToPlaylist(playlistId, '2', 'r1', undefined, 'u1');
    await playlists.addToPlaylist(playlistId, '2', 'r1', undefined, 'u1');
    // An empty rewayah and no rewayah are the same thing.
    await playlists.addToPlaylist(playlistId, '2', 'r1', '', 'u1');

    expect(await items()).toHaveLength(2);
  });

  it('removeUploads takes deleted uploads out of every playlist', async () => {
    const other = (await playlists.createPlaylist('Evening', '#10B981')).id;
    await playlists.addToPlaylist(playlistId, '36', 'r1', 'rw1');
    await playlists.addToPlaylist(playlistId, '36', 'r1', undefined, 'u1');
    await playlists.addToPlaylist(playlistId, '2', 'r1', undefined, 'u2');
    await playlists.addToPlaylist(other, '36', 'r1', undefined, 'u1');
    await playlists.addToPlaylist(other, '67', 'r1', undefined, 'u3');

    const removed = await playlists.removeUploads(['u1', 'u3', 'unknown']);

    expect(removed).toBe(3);
    expect(await items()).toEqual([
      {surahId: '2', rewayatId: undefined, userRecitationId: 'u2'},
      {surahId: '36', rewayatId: 'rw1', userRecitationId: undefined},
    ]);
    expect(await items(other)).toEqual([]);
  });

  it('removeUploads with nothing to remove reports zero', async () => {
    await playlists.addToPlaylist(playlistId, '36', 'r1', 'rw1');

    expect(await playlists.removeUploads([])).toBe(0);
    expect(await playlists.removeUploads(['u9'])).toBe(0);
    expect(await items()).toHaveLength(1);
  });
});
