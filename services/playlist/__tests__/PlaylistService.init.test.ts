// @ai-generated
/**
 * A failed open of the playlists database was kept and handed to every
 * later call, so collections stayed broken until the app was restarted.
 */
jest.mock(
  'expo-sqlite',
  () => require('@/test-utils/mockExpoSqlite').expoSqliteModule,
);

type Database =
  typeof import('@/services/database/DatabaseService').databaseService;
type Playlists = typeof import('../PlaylistService').playlistService;

let database: Database;
let playlists: Playlists;

beforeEach(() => {
  jest.resetModules();
  database = require('@/services/database/DatabaseService').databaseService;
  playlists = require('../PlaylistService').playlistService;
});

afterEach(() => {
  jest.restoreAllMocks();
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

it('opens the database only once when it worked', async () => {
  const open = jest.spyOn(database, 'initialize').mockResolvedValue(undefined);

  await playlists.initialize();
  await playlists.initialize();

  expect(open).toHaveBeenCalledTimes(1);
});
