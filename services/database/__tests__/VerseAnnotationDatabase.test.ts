import * as SQLite from 'expo-sqlite';
import {VerseAnnotationDatabase} from '../VerseAnnotationDatabase';
import {cleanUpLegacyNotes} from '../migrations/legacyNotesCleanup';
import {migrateUserSyncV1} from '../migrations/userSyncV1';
import {migrateUserSyncV2} from '../migrations/userSyncV2';
import {migrateUserSyncV3} from '../migrations/userSyncV3';

jest.mock('expo-sqlite', () => ({openDatabaseAsync: jest.fn()}));
jest.mock('../migrations/legacyNotesCleanup', () => ({
  cleanUpLegacyNotes: jest.fn(),
}));
jest.mock('../migrations/userSyncV1', () => ({migrateUserSyncV1: jest.fn()}));
jest.mock('../migrations/userSyncV2', () => ({migrateUserSyncV2: jest.fn()}));
jest.mock('../migrations/userSyncV3', () => ({migrateUserSyncV3: jest.fn()}));

const mockDb = {closeAsync: jest.fn()};
const handle = mockDb as unknown as SQLite.SQLiteDatabase;
const openDatabase = jest.mocked(SQLite.openDatabaseAsync);
const migrations = [
  ['legacy notes cleanup', jest.mocked(cleanUpLegacyNotes)],
  ['user sync v1', jest.mocked(migrateUserSyncV1)],
  ['user sync v2', jest.mocked(migrateUserSyncV2)],
  ['user sync v3', jest.mocked(migrateUserSyncV3)],
] as const;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return {promise, resolve, reject};
}

beforeEach(() => {
  jest.resetAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  openDatabase.mockResolvedValue(handle);
  mockDb.closeAsync.mockResolvedValue(undefined);
  for (const [, migration] of migrations) {
    migration.mockResolvedValue(undefined);
  }
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('VerseAnnotationDatabase initialization', () => {
  it('shares one initialization across concurrent and subsequent callers', async () => {
    const database = new VerseAnnotationDatabase('concurrent.db');
    const opening = deferred<SQLite.SQLiteDatabase>();
    openDatabase.mockReturnValueOnce(opening.promise);

    const initializing = database.initialize();
    const concurrent = database.initialize();
    const connection = database.getConnection();
    expect(openDatabase).toHaveBeenCalledTimes(1);
    expect(openDatabase).toHaveBeenCalledWith('concurrent.db');

    opening.resolve(handle);
    await Promise.all([initializing, concurrent]);
    await expect(connection).resolves.toBe(handle);
    await expect(database.initialize()).resolves.toBeUndefined();
    await expect(database.getConnection()).resolves.toBe(handle);
    expect(openDatabase).toHaveBeenCalledTimes(1);
    for (const [, migration] of migrations) {
      expect(migration).toHaveBeenCalledTimes(1);
      expect(migration).toHaveBeenCalledWith(handle);
    }
    expect(mockDb.closeAsync).not.toHaveBeenCalled();
  });

  it.each(migrations)(
    'closes the handle and caches a %s failure, including across close()',
    async (_name, failingMigration) => {
      const database = new VerseAnnotationDatabase();
      const failure = new Error('migration failed');
      const migrationStarted = deferred<void>();
      const migrationResult = deferred<void>();
      failingMigration.mockImplementationOnce(() => {
        migrationStarted.resolve(undefined);
        return migrationResult.promise;
      });

      const results = Promise.allSettled([
        database.initialize(),
        database.initialize(),
        database.getConnection(),
      ]);
      await migrationStarted.promise;
      // Closing while initialization is pending must not reset its promise.
      const closing = database.close();
      migrationResult.reject(failure);
      expect(await results).toEqual([
        {status: 'rejected', reason: failure},
        {status: 'rejected', reason: failure},
        {status: 'rejected', reason: failure},
      ]);
      await closing;

      expect(mockDb.closeAsync).toHaveBeenCalledTimes(1);
      await expect(database.initialize()).rejects.toBe(failure);
      await expect(database.getConnection()).rejects.toBe(failure);
      await database.close();
      await expect(database.initialize()).rejects.toBe(failure);
      await expect(database.getConnection()).rejects.toBe(failure);
      expect(openDatabase).toHaveBeenCalledTimes(1);
      expect(mockDb.closeAsync).toHaveBeenCalledTimes(1);
      const failureIndex = migrations.findIndex(
        ([, migration]) => migration === failingMigration,
      );
      migrations.forEach(([, migration], index) => {
        expect(migration).toHaveBeenCalledTimes(index <= failureIndex ? 1 : 0);
      });
    },
  );

  it.each([new Error('open failed'), undefined])(
    'caches an open failure (%s) without migrations or handle cleanup',
    async failure => {
      const database = new VerseAnnotationDatabase();
      openDatabase.mockRejectedValueOnce(failure);

      const results = await Promise.allSettled([
        database.initialize(),
        database.getConnection(),
      ]);
      expect(results).toEqual([
        {status: 'rejected', reason: failure},
        {status: 'rejected', reason: failure},
      ]);
      await expect(database.initialize()).rejects.toBe(failure);
      await database.close();
      await expect(database.initialize()).rejects.toBe(failure);
      await expect(database.getConnection()).rejects.toBe(failure);
      expect(openDatabase).toHaveBeenCalledTimes(1);
      expect(mockDb.closeAsync).not.toHaveBeenCalled();
      for (const [, migration] of migrations) {
        expect(migration).not.toHaveBeenCalled();
      }
    },
  );

  it('preserves the migration failure when closing the failed handle also fails', async () => {
    const database = new VerseAnnotationDatabase();
    const failure = new Error('migration failed');
    const closeFailure = new Error('close failed');
    jest.mocked(migrateUserSyncV3).mockRejectedValueOnce(failure);
    mockDb.closeAsync.mockRejectedValueOnce(closeFailure);

    const results = await Promise.allSettled([
      database.initialize(),
      database.getConnection(),
    ]);
    expect(results).toEqual([
      {status: 'rejected', reason: failure},
      {status: 'rejected', reason: failure},
    ]);
    expect(console.error).toHaveBeenCalledWith(
      'Failed to close verse annotations database after initialization failure:',
      closeFailure,
    );
    await database.close();
    await expect(database.initialize()).rejects.toBe(failure);
    await expect(database.getConnection()).rejects.toBe(failure);
    expect(openDatabase).toHaveBeenCalledTimes(1);
    expect(mockDb.closeAsync).toHaveBeenCalledTimes(1);
  });

  it('recovers only in a new instance, leaving the failed instance unusable', async () => {
    const database = new VerseAnnotationDatabase('recovery.db');
    const failure = new Error('migration failed');
    jest.mocked(migrateUserSyncV2).mockRejectedValueOnce(failure);
    await expect(database.initialize()).rejects.toBe(failure);
    await database.close();

    const recoveredDb = {closeAsync: jest.fn().mockResolvedValue(undefined)};
    const recoveredHandle = recoveredDb as unknown as SQLite.SQLiteDatabase;
    openDatabase.mockResolvedValueOnce(recoveredHandle);
    const recovered = new VerseAnnotationDatabase('recovery.db');
    await expect(recovered.getConnection()).resolves.toBe(recoveredHandle);
    await expect(database.initialize()).rejects.toBe(failure);
    await expect(database.getConnection()).rejects.toBe(failure);
    expect(openDatabase).toHaveBeenCalledTimes(2);
    expect(openDatabase).toHaveBeenNthCalledWith(2, 'recovery.db');
    expect(mockDb.closeAsync).toHaveBeenCalledTimes(1);
    expect(recoveredDb.closeAsync).not.toHaveBeenCalled();
    expect(migrateUserSyncV3).toHaveBeenCalledTimes(1);
    expect(migrateUserSyncV3).toHaveBeenCalledWith(recoveredHandle);
  });

  it('still allows reopening after closing a successfully initialized instance', async () => {
    const database = new VerseAnnotationDatabase();
    await database.initialize();
    await database.close();
    await expect(database.getConnection()).resolves.toBe(handle);

    expect(mockDb.closeAsync).toHaveBeenCalledTimes(1);
    expect(openDatabase).toHaveBeenCalledTimes(2);
    for (const [, migration] of migrations) {
      expect(migration).toHaveBeenCalledTimes(2);
    }
  });
});
