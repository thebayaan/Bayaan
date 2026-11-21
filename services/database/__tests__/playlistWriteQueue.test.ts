// @ai-generated
// The playlists database has one connection, and withTransactionAsync is not
// exclusive. A write started while another transaction is open fails at
// BEGIN, and in the app its ROLLBACK then undoes the first one too: a double
// tap on Save left no playlist at all. Writes must run one after another.
jest.mock(
  'expo-sqlite',
  () => require('@/test-utils/mockExpoSqlite').expoSqliteModule,
);

type MockModule = typeof import('@/test-utils/mockExpoSqlite');
type Database = typeof import('../DatabaseService').databaseService;

describe('playlist writes issued together', () => {
  let mock: MockModule;
  let database: Database;

  const playlist = (id: string) => ({
    id,
    name: `Playlist ${id}`,
    color: '#6366F1',
    createdAt: 1,
    updatedAt: 1,
  });

  const item = (id: string, playlistId: string, orderIndex: number) => ({
    id,
    playlistId,
    surahId: String(orderIndex + 1),
    reciterId: 'r1',
    rewayatId: 'rw1',
    orderIndex,
    addedAt: 1,
  });

  const playlistIds = async () =>
    (await database.getAllPlaylists()).map(p => p.id).sort();

  beforeEach(async () => {
    jest.resetModules();
    mock = require('@/test-utils/mockExpoSqlite');
    database = require('../DatabaseService').databaseService;
    await database.initialize();
  });

  afterEach(async () => {
    await database.close();
    await mock.resetDatabases();
  });

  it('two playlists created in the same tick are both saved', async () => {
    await Promise.all([
      database.createPlaylist(playlist('a')),
      database.createPlaylist(playlist('b')),
    ]);

    expect(await playlistIds()).toEqual(['a', 'b']);
  });

  it('every kind of write waits its turn', async () => {
    await database.createPlaylist(playlist('a'));
    await database.createPlaylist(playlist('gone'));
    await database.addPlaylistItem(item('i0', 'a', 0));

    await Promise.all([
      database.updatePlaylist('a', {name: 'Renamed', updatedAt: 2}),
      database.addPlaylistItem(item('i1', 'a', 1)),
      database.addPlaylistItem(item('i2', 'a', 2)),
      database.removePlaylistItem('i0'),
      database.reorderPlaylistItems('a', ['i2', 'i1']),
      database.remapReciterId('r1', 'r2'),
      database.deletePlaylist('gone'),
      database.createPlaylist(playlist('b')),
    ]);

    expect(await playlistIds()).toEqual(['a', 'b']);
    expect((await database.getPlaylist('a'))?.name).toBe('Renamed');
    expect(
      (await database.getPlaylistItems('a')).map(i => [
        i.id,
        i.orderIndex,
        i.reciterId,
      ]),
    ).toEqual([
      ['i1', 1, 'r2'],
      ['i2', 0, 'r2'],
    ]);
  });

  it('a write that fails does not block or undo the others', async () => {
    await database.createPlaylist(playlist('a'));

    const before = database.createPlaylist(playlist('b'));
    // The same id again: the insert fails and its transaction rolls back.
    const failing = database.createPlaylist(playlist('a'));
    const after = database.createPlaylist(playlist('c'));

    await expect(failing).rejects.toThrow();
    await Promise.all([before, after]);
    expect(await playlistIds()).toEqual(['a', 'b', 'c']);
  });
});
