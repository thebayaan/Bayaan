// @ai-generated
/**
 * A failed open of the playlists database was kept and handed to every
 * later call, so collections stayed broken until the app was restarted.
 */
jest.mock(
  'expo-sqlite',
  () => require('@/test-utils/mockExpoSqlite').expoSqliteModule,
);

type MockModule = typeof import('@/test-utils/mockExpoSqlite');
type Database =
  typeof import('@/services/database/DatabaseService').databaseService;
type Playlists = typeof import('../PlaylistService').playlistService;

let mock: MockModule;
let database: Database;
let playlists: Playlists;

beforeEach(() => {
  jest.resetModules();
  mock = require('@/test-utils/mockExpoSqlite');
  database = require('@/services/database/DatabaseService').databaseService;
  playlists = require('../PlaylistService').playlistService;
});

afterEach(async () => {
  jest.restoreAllMocks();
  await database.close();
  await mock.resetDatabases();
});

it('tries to open the database again after a failed open', async () => {
  const open = jest
    .spyOn(database, 'initialize')
    .mockRejectedValueOnce(new Error('database is locked'))
    .mockResolvedValue(undefined);

  await expect(playlists.initialize()).rejects.toThrow('database is locked');
  await expect(playlists.initialize()).resolves.toBeUndefined();
  expect(open).toHaveBeenCalledTimes(2);
});

it('creates the tables on the retry when the first try failed after the open', async () => {
  // A briefly locked file fails at the first statement (the WAL pragma),
  // after the file is open. The retry used to return at once with that
  // handle and never create the tables, so on a fresh install every
  // collection action failed with "no such table" until a restart.
  const file = await mock.openDatabaseAsync('playlists.db');
  jest
    .spyOn(file, 'execAsync')
    .mockRejectedValueOnce(new Error('database is locked'));
  jest.spyOn(console, 'error').mockImplementation(() => undefined);

  await expect(playlists.getAllPlaylists()).rejects.toThrow(
    'database is locked',
  );
  await expect(playlists.getAllPlaylists()).resolves.toEqual([]);
  await playlists.createPlaylist('Morning', '#6366F1');
  expect((await playlists.getAllPlaylists()).map(p => p.name)).toEqual([
    'Morning',
  ]);
});

it('opens the database only once when it worked', async () => {
  const open = jest.spyOn(database, 'initialize').mockResolvedValue(undefined);

  await playlists.initialize();
  await playlists.initialize();

  expect(open).toHaveBeenCalledTimes(1);
});
