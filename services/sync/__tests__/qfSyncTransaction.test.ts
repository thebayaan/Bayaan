import type {SQLiteDatabase} from 'expo-sqlite';
import type {VerseAnnotationDatabase} from '@/services/database/VerseAnnotationDatabase';
import type {
  QfSyncSqliteExecutor,
  QfSyncTransactionDatabase,
} from '@/services/sync/qfSyncTransaction';

// Reuse Expo's shipped SQLite WASM so this runs on the repository's Node 20 CI,
// as well as local Node, without a native-module install or Node 22-only API.
const sqlitePromise = (async () => {
  const fs = require('fs');
  const path = require('path');
  global.TextDecoder = require('util').TextDecoder;
  const directory = path.join(
    process.cwd(),
    'node_modules',
    'expo-sqlite',
    'web',
    'wa-sqlite',
  );
  const module = await require(path.join(directory, 'wa-sqlite.js'))({
    wasmBinary: fs.readFileSync(path.join(directory, 'wa-sqlite.wasm')),
  });
  const SQLite = require(path.join(directory, 'sqlite-api.js'));
  return {sqlite3: SQLite.Factory(module), SQLite};
})();
let mockPlatform = 'ios';
const mockRoots = new Map<string, RealSqliteDatabase>();
const mockOpenDatabaseAsync = jest.fn(async (path: string, options = {}) => {
  const root = mockRoots.get(path);
  if (!root || !(options as {useNewConnection?: boolean}).useNewConnection) {
    throw new Error('Web transactions must request a private connection');
  }
  return root.newTransactionHandle();
});

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: (path: string, options: object) =>
    mockOpenDatabaseAsync(path, options),
}));
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  Object.defineProperty(native.Platform, 'OS', {
    configurable: true,
    get: () => mockPlatform,
  });
  return native;
});
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import {VerseAnnotationDatabaseService} from '@/services/database/VerseAnnotationDatabaseService';
import {QfSyncDatabaseService} from '@/services/sync/qfSyncDatabaseService';
import {
  QfSyncCoordinator,
  SqliteQfSyncPullStore,
} from '@/services/sync/qfSyncCoordinator';
import {
  BayaanSyncApiError,
  type BayaanSyncPullRequest,
} from '@/services/sync/bayaanSyncApiClient';
import {
  decodeBayaanSyncPullResponse,
  type BayaanSyncMutation,
} from '@/services/sync/bayaanSyncCodec';
import {withQfSyncTransaction} from '@/services/sync/qfSyncTransaction';
import {migrateUserSyncV1} from '@/services/database/migrations/userSyncV1';
import {migrateUserSyncV2} from '@/services/database/migrations/userSyncV2';

/** Real SQLite file, distinct native handles, async boundaries controlled below. */
class RealSqliteDatabase implements QfSyncTransactionDatabase {
  readonly options = {};
  private readonly dbPromise: Promise<number>;
  readonly transactions: RealSqliteDatabase[] = [];
  activeTransactions = 0;
  forbidSharedSql = false;
  beforeTransactionSql?: () => Promise<void>;
  closed = false;
  sqlCount = 0;

  constructor(
    readonly databasePath: string,
    private readonly root?: RealSqliteDatabase,
  ) {
    this.dbPromise = sqlitePromise.then(({sqlite3}) =>
      sqlite3.open_v2(databasePath),
    );
  }

  newTransactionHandle() {
    const txn = new RealSqliteDatabase(this.databasePath, this);
    this.transactions.push(txn);
    return txn;
  }

  private async beforeSql() {
    if (!this.root && this.forbidSharedSql && this.activeTransactions > 0) {
      throw new Error('SQL escaped the callback transaction handle');
    }
    if (this.root?.beforeTransactionSql) {
      const hook = this.root.beforeTransactionSql;
      this.root.beforeTransactionSql = undefined;
      await hook();
    }
    this.sqlCount += 1;
  }

  async execAsync(sql: string) {
    const {sqlite3} = await sqlitePromise;
    await sqlite3.exec(await this.dbPromise, sql);
    if (this.root && sql === 'BEGIN') this.root.activeTransactions += 1;
  }

  async runAsync(sql: string, params: unknown[] = []) {
    await this.beforeSql();
    const {sqlite3} = await sqlitePromise;
    const db = await this.dbPromise;
    for await (const stmt of sqlite3.statements(db, sql)) {
      sqlite3.bind_collection(stmt, params);
      await sqlite3.step(stmt);
    }
    return {changes: sqlite3.changes(db)};
  }

  async getAllAsync<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    await this.beforeSql();
    const {sqlite3, SQLite} = await sqlitePromise;
    const db = await this.dbPromise;
    const rows: T[] = [];
    for await (const stmt of sqlite3.statements(db, sql)) {
      sqlite3.bind_collection(stmt, params);
      const names = sqlite3.column_names(stmt);
      while ((await sqlite3.step(stmt)) === SQLite.SQLITE_ROW) {
        const values = sqlite3.row(stmt);
        rows.push(
          Object.fromEntries(
            names.map((name: string, index: number) => [name, values[index]]),
          ) as T,
        );
      }
    }
    return rows;
  }

  async getFirstAsync<T>(
    sql: string,
    params: unknown[] = [],
  ): Promise<T | null> {
    return (await this.getAllAsync<T>(sql, params))[0] ?? null;
  }

  async withTransactionAsync(task: () => Promise<void>) {
    await this.execAsync('BEGIN');
    try {
      await task();
      await this.execAsync('COMMIT');
    } catch (error) {
      await this.execAsync('ROLLBACK');
      throw error;
    }
  }

  async withExclusiveTransactionAsync(
    task: (txn: QfSyncSqliteExecutor) => Promise<void>,
  ) {
    if (mockPlatform === 'web')
      throw new Error('Exclusive is unsupported on web');
    const txn = this.newTransactionHandle();
    try {
      await txn.withTransactionAsync(() =>
        task(txn as unknown as QfSyncSqliteExecutor),
      );
    } finally {
      await txn.closeAsync();
    }
  }

  async closeAsync() {
    const {sqlite3} = await sqlitePromise;
    await sqlite3.close(await this.dbPromise);
    this.closed = true;
    if (this.root) this.root.activeTransactions -= 1;
  }
}

let sequence = 0;
async function createServices() {
  const root = new RealSqliteDatabase(`qf-isolation-${++sequence}.db`);
  mockRoots.set(root.databasePath, root);
  await migrateUserSyncV1(root);
  await migrateUserSyncV2(root);
  const provider = {
    initialize: async () => undefined,
    getConnection: async () => root as unknown as SQLiteDatabase,
    close: () => root.closeAsync(),
  };
  const database = provider as unknown as VerseAnnotationDatabase;
  const annotations = new VerseAnnotationDatabaseService(database);
  const sync = new QfSyncDatabaseService({
    database,
    annotations,
  });
  const pull = new SqliteQfSyncPullStore(provider);
  return {root, annotations, sync, pull};
}

function gate() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => {
    resolve = done;
  });
  return {promise, resolve};
}

const bookmarkInput = {
  accountId: 'reader',
  verseKey: '2:255',
  surahNumber: 2,
  ayahNumber: 255,
};
const noteInput = {...bookmarkInput, content: 'Live private note'};

for (const platform of ['ios', 'web']) {
  describe(`${platform} sync transaction isolation`, () => {
    beforeEach(() => {
      mockPlatform = platform;
      mockOpenDatabaseAsync.mockClear();
    });

    it.each(['PENDING', 'IN_FLIGHT', 'AMBIGUOUS'] as const)(
      'retains a locally deleted bookmark identity across CREATE/UPDATE pulls (%s)',
      async state => {
        const {root, annotations, sync, pull} = await createServices();
        root.forbidSharedSql = true;
        const remote: BayaanSyncMutation = {
          resource: 'BOOKMARK',
          type: 'CREATE',
          resourceId: 'deleted-remote',
          timestamp: 100,
          data: {type: 'ayah', key: 2, verseNumber: 255},
        };
        await pull.applyPage('reader', [remote]);
        await sync.removeBookmark({accountId: 'reader', verseKey: '2:255'});
        const [deleted] = await sync.getOutboxEntries('reader');
        expect(deleted).toMatchObject({
          mutationType: 'DELETE',
          remoteId: remote.resourceId,
        });
        expect(await pull.commitStableHead('reader', 0, 100, 100)).toBe(true);
        let head = 200;
        const transport = {
          pull: jest.fn(
            async (_token: string, request: BayaanSyncPullRequest) => ({
              lastMutationAt: head,
              mutations: request.metadataOnly
                ? []
                : [
                    {
                      ...remote,
                      type:
                        head === 200
                          ? ('CREATE' as const)
                          : ('UPDATE' as const),
                      timestamp: head,
                    },
                  ],
            }),
          ),
          push: jest.fn(async () => {
            throw new BayaanSyncApiError('request_failed', 403);
          }),
        };
        const now = Date.now();
        const coordinator = new QfSyncCoordinator({
          transport,
          store: pull,
          pushStore: sync,
          now: () => now,
        });
        if (state === 'PENDING') {
          await expect(
            coordinator.push({accountId: 'reader', sessionToken: 'fixture'}),
          ).rejects.toMatchObject({status: 403});
          // The retry deadline defers the next delivery without removing intent.
          await expect(
            coordinator.push({accountId: 'reader', sessionToken: 'fixture'}),
          ).resolves.toMatchObject({status: 'idle'});
          expect(transport.push).toHaveBeenCalledTimes(1);
        } else {
          await sync.markOperationInFlight({
            accountId: 'reader',
            localOperationId: deleted.localOperationId,
            startedAt: now,
          });
          if (state === 'AMBIGUOUS')
            await root.runAsync(
              "UPDATE qf_sync_outbox SET delivery_state = 'AMBIGUOUS' WHERE owner_scope = ? AND local_operation_id = ?",
              ['qf:reader', deleted.localOperationId],
            );
        }
        const before = await sync.getOutboxEntries('reader');
        for (head of [200, 300]) {
          await expect(
            coordinator.pull({accountId: 'reader', sessionToken: 'fixture'}),
          ).resolves.toEqual({status: 'synced', head, restarts: 0});
          expect(await pull.getStoredHead('reader')).toBe(head);
          expect(
            await annotations.getAllBookmarksInOwnerScope('qf:reader'),
          ).toEqual([]);
          // No ACK, payload/base/revision rewrite or loss of uncertain evidence.
          expect(await sync.getOutboxEntries('reader')).toEqual(before);
        }
        await pull.applyPage('reader', [
          {...remote, type: 'DELETE', timestamp: 400},
        ]);
        expect(await sync.getOutboxEntries('reader')).toEqual(before);
        // A different remote identity and the same identity in another account
        // are live controls, not suppressed by this account's tombstone.
        await pull.applyPage('reader', [
          {...remote, resourceId: 'live-remote', timestamp: 500},
        ]);
        await pull.applyPage('other-reader', [remote]);
        expect(
          await annotations.getAllBookmarksInOwnerScope('qf:reader'),
        ).toEqual([expect.objectContaining({remoteId: 'live-remote'})]);
        expect(
          await annotations.getAllBookmarksInOwnerScope('qf:other-reader'),
        ).toHaveLength(1);
        expect(await sync.getOutboxEntries('reader')).toEqual(before);
        expect(root.transactions.every(txn => txn.closed)).toBe(true);
        await root.closeAsync();
      },
    );

    it('leaves legacy Favorite rows and pending bookmark work unchanged on excluded reads', async () => {
      const {root, annotations, sync, pull} = await createServices();
      await pull.applyPage('reader', [
        {
          resource: 'BOOKMARK',
          type: 'CREATE',
          resourceId: 'legacy-favorite',
          timestamp: 100,
          data: {type: 'ayah', key: 2, verseNumber: 255},
        },
      ]);
      await sync.addBookmark({
        ...bookmarkInput,
        verseKey: '2:256',
        ayahNumber: 256,
      });
      const beforeRows =
        await annotations.getAllBookmarksInOwnerScope('qf:reader');
      const beforeOutbox = await sync.getOutboxEntries('reader');
      const page = decodeBayaanSyncPullResponse({
        success: true,
        data: {
          lastMutationAt: 200,
          mutations: [255, 256].map(verseNumber => ({
            resource: 'BOOKMARK',
            type: 'UPDATE',
            resourceId:
              verseNumber === 255 ? 'legacy-favorite' : 'new-favorite',
            timestamp: 200,
            data: {
              type: 'ayah',
              key: 2,
              verseNumber,
              isInDefaultCollection: true,
            },
          })),
        },
      });
      expect(page).toEqual({
        lastMutationAt: 200,
        mutations: [],
        receivedMutationCount: 2,
      });
      await pull.applyPage('reader', page.mutations);
      expect(await pull.commitStableHead('reader', 0, 200, 200)).toBe(true);
      expect(
        await annotations.getAllBookmarksInOwnerScope('qf:reader'),
      ).toEqual(beforeRows);
      expect(await sync.getOutboxEntries('reader')).toEqual(beforeOutbox);
      // The schema did not retain membership. Exclusion cannot migrate or
      // safely reinterpret this already persisted remote ID as a collection ID.
      expect(
        (
          await root.getAllAsync<{name: string}>('PRAGMA table_info(bookmarks)')
        ).map(column => column.name),
      ).not.toContain('isInDefaultCollection');
      await root.closeAsync();
    });

    it('keeps successful live highlight, bookmark and note writes after a poisoned pull rolls back', async () => {
      const {root, annotations, sync, pull} = await createServices();
      const entered = gate();
      const release = gate();
      root.beforeTransactionSql = async () => {
        entered.resolve();
        await release.promise;
      };
      // BEGIN is active on the private pull handle. No timer races: release
      // only after all three live writes have returned successfully.
      const poisoned = pull.applyPage('reader', [
        {
          resource: 'BOOKMARK',
          type: 'CREATE',
          resourceId: 'pulled',
          timestamp: 100,
          data: {key: 2, verseNumber: 256},
        },
        {
          resource: 'NOTE',
          type: 'CREATE',
          resourceId: 'poison',
          timestamp: 101,
          data: {body: 'Invalid', ranges: ['2:999-2:999'], saveToQR: false},
        },
      ]);
      const outcome = poisoned.then(
        () => null,
        (error: unknown) => error,
      );
      await entered.promise;
      await annotations.upsertHighlightForOwnerScope(
        'qf:reader',
        '2:255',
        2,
        255,
        'yellow',
      );
      await sync.addBookmark(bookmarkInput);
      await sync.addNote(noteInput);
      release.resolve();
      const error = await outcome;
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain('Invalid verse range');
      expect(
        await annotations.getHighlightsBySurahInOwnerScope('qf:reader', 2),
      ).toHaveLength(1);
      expect(
        await annotations.getAllBookmarksInOwnerScope('qf:reader'),
      ).toHaveLength(1);
      expect(
        await annotations.getNotesForVerseInOwnerScope('qf:reader', '2:255'),
      ).toEqual([expect.objectContaining({content: 'Live private note'})]);
      expect(await sync.getOutboxEntries('reader')).toHaveLength(2);
      expect(
        await root.getFirstAsync(
          'SELECT id FROM bookmarks WHERE remote_id = ?',
          ['pulled'],
        ),
      ).toBeNull();
      expect(await pull.getStoredHead('reader')).toBe(0);
      expect(root.transactions).toHaveLength(3);
      expect(root.transactions.every(txn => txn.closed)).toBe(true);
      if (platform === 'web') {
        expect(mockOpenDatabaseAsync).toHaveBeenCalledWith(root.databasePath, {
          useNewConnection: true,
        });
      }
      await root.closeAsync();
    });

    it('uses only callback handles for pull, local mutations, reservation, ACK, release, recovery and rebase', async () => {
      const {root, sync, pull} = await createServices();
      root.forbidSharedSql = true;
      await sync.addBookmark(bookmarkInput);
      const note = await sync.addNote(noteInput);
      await sync.updateNote({
        accountId: 'reader',
        noteId: note.id,
        content: 'Edited',
      });
      await sync.upsertReadingLocation({...bookmarkInput, lastReadAt: 100});
      await pull.applyPage('reader', [
        {
          resource: 'BOOKMARK',
          type: 'CREATE',
          resourceId: 'remote-bookmark',
          timestamp: 7001,
          data: {key: 2, verseNumber: 255},
        },
      ]);
      expect(await pull.commitStableHead('reader', 0, 7001, 7001)).toBe(true);
      expect(await pull.commitStableHead('reader', 0, 7002, 7002)).toBe(false);
      const [pending] = await sync.getOutboxEntries('reader');
      await sync.markOperationInFlight({
        accountId: 'reader',
        localOperationId: pending.localOperationId,
        startedAt: 1000,
      });
      await sync.releaseInFlightOperations({
        accountId: 'reader',
        localOperationIds: [pending.localOperationId],
        retryAt: 1000,
      });
      const sent = await sync.reservePushBatch({
        accountId: 'reader',
        limit: 1,
        dueAt: 1000,
        startedAt: 1000,
      });
      expect(sent).toHaveLength(1);
      await sync.acknowledgeOperation({
        accountId: 'reader',
        localOperationId: sent[0].localOperationId,
        resourceId: 'acked',
        serverUpdatedAt: 7002,
      });
      const noteBatch = await sync.reservePushBatch({
        accountId: 'reader',
        limit: 10,
        dueAt: Date.now(),
        startedAt: 1001,
      });
      expect(noteBatch).toHaveLength(1);
      expect(
        await sync.commitPushSuccess({
          accountId: 'reader',
          expectedHead: 7001,
          sent: noteBatch,
          result: {
            lastMutationAt: 7002,
            mutations: [
              {
                resource: 'NOTE',
                type: 'CREATE',
                resourceId: 'remote-note',
                timestamp: 7002,
                data: {
                  body: 'Edited',
                  ranges: ['2:255-2:255'],
                  saveToQR: false,
                },
              },
            ],
          },
          syncedAt: 7002,
        }),
      ).toBe(true);
      await sync.reconcileUncertainOperations({
        accountId: 'reader',
        reconciledAt: 1000,
      });
      await sync.rebasePendingOperations({
        accountId: 'reader',
        rebasedAt: 1000,
      });
      await sync.applyRemoteNote({
        ...noteInput,
        remoteId: 'remote-note',
        serverUpdatedAt: 7003,
      });
      // Exercise the conflict-copy annotation helper within the callback too.
      await sync.updateNote({
        accountId: 'reader',
        noteId: note.id,
        content: 'Pending conflict',
      });
      await sync.applyRemoteNote({
        ...noteInput,
        remoteId: 'remote-note',
        content: 'Remote conflict',
        serverUpdatedAt: 7005,
      });
      await sync.removeBookmark({accountId: 'reader', verseKey: '2:255'});
      await sync.deleteNote({accountId: 'reader', noteId: note.id});
      expect(
        await sync.commitPushSuccess({
          accountId: 'reader',
          expectedHead: 7002,
          sent: [],
          result: {lastMutationAt: 7006, mutations: []},
          syncedAt: 7006,
        }),
      ).toBe(true);
      expect(
        root.transactions.every(txn => txn.closed && txn.sqlCount > 0),
      ).toBe(true);
      await root.closeAsync();
    });

    it('does not swallow or retry live lock failures on the shared connection', async () => {
      const {root, annotations} = await createServices();
      await expect(
        withQfSyncTransaction(root, async txn => {
          await txn.runAsync(
            'INSERT INTO bookmarks (id, owner_scope, verse_key, surah_number, ayah_number, created_at) VALUES (?, ?, ?, ?, ?, ?)',
            ['remote', 'qf:reader', '2:256', 2, 256, 100],
          );
          await expect(
            annotations.upsertHighlightForOwnerScope(
              'qf:reader',
              '2:255',
              2,
              255,
              'yellow',
            ),
          ).rejects.toThrow(/locked/);
          throw new Error('poisoned transaction');
        }),
      ).rejects.toThrow('poisoned transaction');
      await annotations.upsertHighlightForOwnerScope(
        'qf:reader',
        '2:255',
        2,
        255,
        'yellow',
      );
      expect(
        await annotations.getHighlightsBySurahInOwnerScope('qf:reader', 2),
      ).toHaveLength(1);
      expect(await root.getAllAsync('SELECT * FROM bookmarks')).toHaveLength(0);
      await root.closeAsync();
    });
  });
}

it('control: a successful live write on a shared transaction handle is silently rolled back', async () => {
  mockPlatform = 'ios';
  const {root, annotations} = await createServices();
  await expect(
    root.withTransactionAsync(async () => {
      await annotations.upsertHighlightForOwnerScope(
        'qf:reader',
        '2:255',
        2,
        255,
        'yellow',
      );
      throw new Error('poisoned transaction');
    }),
  ).rejects.toThrow('poisoned transaction');
  expect(
    await annotations.getHighlightsBySurahInOwnerScope('qf:reader', 2),
  ).toHaveLength(0);
  await root.closeAsync();
});
