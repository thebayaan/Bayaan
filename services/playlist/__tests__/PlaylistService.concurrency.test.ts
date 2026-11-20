// @ai-generated
/**
 * Playlist and item ids were only the time in milliseconds, so two things
 * made in the same millisecond got the same id and the second save failed.
 * And "is this surah already in the playlist?" was checked separately from
 * the insert, so two adds issued together both inserted.
 */
jest.mock(
  'expo-sqlite',
  () => require('@/test-utils/mockExpoSqlite').expoSqliteModule,
);

type MockModule = typeof import('@/test-utils/mockExpoSqlite');
type Playlists = typeof import('../PlaylistService').playlistService;

describe('playlists saved at the same moment', () => {
  let mock: MockModule;
  let playlists: Playlists;

  beforeEach(() => {
    jest.resetModules();
    mock = require('@/test-utils/mockExpoSqlite');
    playlists = require('../PlaylistService').playlistService;
    // Everything in a test happens in one millisecond.
    jest.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await mock.resetDatabases();
  });

  it('two playlists made in the same millisecond are both kept', async () => {
    const first = await playlists.createPlaylist('Morning', '#6366F1');
    const second = await playlists.createPlaylist('Evening', '#10B981');

    expect(second.id).not.toBe(first.id);
    expect((await playlists.getAllPlaylists()).map(p => p.name).sort()).toEqual(
      ['Evening', 'Morning'],
    );
  });

  it('two saves issued in the same tick are both kept', async () => {
    await Promise.all([
      playlists.createPlaylist('Morning', '#6366F1'),
      playlists.createPlaylist('Evening', '#10B981'),
    ]);

    expect(await playlists.getAllPlaylists()).toHaveLength(2);
  });

  it('two surahs added in the same millisecond are both kept', async () => {
    const {id} = await playlists.createPlaylist('Morning', '#6366F1');

    await playlists.addToPlaylist(id, '1', 'r1', 'rw1');
    await playlists.addToPlaylist(id, '2', 'r1', 'rw1');

    expect(
      (await playlists.getPlaylistItems(id)).map(item => item.surahId),
    ).toEqual(['2', '1']);
  });

  it('the same surah added twice at once is added once', async () => {
    const {id} = await playlists.createPlaylist('Morning', '#6366F1');

    // A double tap on the playlist row in "Add to collection".
    await Promise.all([
      playlists.addToPlaylist(id, '36', 'r1', 'rw1'),
      playlists.addToPlaylist(id, '36', 'r1', 'rw1'),
    ]);

    expect(await playlists.getPlaylistItems(id)).toHaveLength(1);
  });

  it('different surahs added at once are all kept, in order', async () => {
    const {id} = await playlists.createPlaylist('Morning', '#6366F1');

    await Promise.all([
      playlists.addToPlaylist(id, '1', 'r1', 'rw1'),
      playlists.addToPlaylist(id, '2', 'r1', 'rw1'),
      playlists.addToPlaylist(id, '3', 'r1', 'rw1'),
    ]);

    const items = await playlists.getPlaylistItems(id);
    expect(items.map(item => item.surahId)).toEqual(['3', '2', '1']);
    expect(items.map(item => item.orderIndex)).toEqual([2, 1, 0]);
  });

  it('an add that fails does not block the next one', async () => {
    const {id} = await playlists.createPlaylist('Morning', '#6366F1');
    const database = require('@/services/database/DatabaseService')
      .databaseService as typeof import('@/services/database/DatabaseService').databaseService;
    jest
      .spyOn(database, 'addPlaylistItem')
      .mockRejectedValueOnce(new Error('disk full'));

    const failing = playlists.addToPlaylist(id, '1', 'r1', 'rw1');
    const next = playlists.addToPlaylist(id, '2', 'r1', 'rw1');

    await expect(failing).rejects.toThrow('disk full');
    await next;
    expect(
      (await playlists.getPlaylistItems(id)).map(item => item.surahId),
    ).toEqual(['2']);
  });
});
