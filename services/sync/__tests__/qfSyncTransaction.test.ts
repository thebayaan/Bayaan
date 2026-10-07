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
  BayaanSyncApiClient,
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
import {migrateUserSyncV3} from '@/services/database/migrations/userSyncV3';
import {QfSyncLifecycle} from '@/services/sync/qfSyncLifecycle';
import {useQfSyncStore} from '@/store/qfSyncStore';
import {useVerseAnnotationsStore} from '@/store/verseAnnotationsStore';
import * as resourceMapper from '@/services/sync/qfSyncResourceMapper';

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
  await migrateUserSyncV3(root);
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

    it('V3 is additive over V1/V2 saved state, reopens safely and retains published SQL contracts', async () => {
      const path = `qf-upgrade-${platform}-${++sequence}.db`;
      let root = new RealSqliteDatabase(path);
      mockRoots.set(path, root);
      await migrateUserSyncV1(root);
      await root.runAsync(
        `INSERT INTO qf_sync_outbox VALUES ('v1-queued', 'qf:reader', 'reader', 'NOTE', 'CREATE', 'v1-local', NULL, ?, NULL, 0, NULL, 100)`,
        [JSON.stringify({...noteInput, content: 'x'.repeat(200_001)})],
      );
      await migrateUserSyncV2(root);
      for (const state of ['PENDING', 'IN_FLIGHT', 'AMBIGUOUS']) {
        await root.runAsync(
          `INSERT INTO qf_sync_outbox VALUES (?, 'qf:reader', 'reader', 'NOTE', 'CREATE', ?, NULL, ?, NULL, 3, 200, 100, 7, ?, ?, ?, ?, ?)`,
          [
            state,
            `local-${state}`,
            JSON.stringify({content: 'x'.repeat(200_001)}),
            state,
            state === 'PENDING' ? null : 6,
            state === 'PENDING' ? null : 'CREATE',
            state === 'PENDING' ? null : 'immutable sent bytes',
            state === 'PENDING' ? null : 101,
          ],
        );
      }
      await root.runAsync(
        `INSERT INTO notes VALUES ('large-local', 'qf:reader', '2:255', 2, 255, ?, '2:255', 100, 200, 'hafs', NULL, NULL, NULL)`,
        ['x'.repeat(200_001)],
      );
      const before = await root.getAllAsync(
        'SELECT * FROM qf_sync_outbox ORDER BY local_operation_id',
      );
      const columns = await root.getAllAsync(
        'PRAGMA table_info(qf_sync_outbox)',
      );
      const notes = await root.getAllAsync('SELECT * FROM notes');
      root.forbidSharedSql = true;
      await migrateUserSyncV3(root);
      await migrateUserSyncV3(root);
      // These are unchanged published 432baa3 V1/V2 guards, not a native old-binary run.
      await migrateUserSyncV1(root);
      await migrateUserSyncV2(root);
      expect(
        await root.getAllAsync(
          'SELECT * FROM qf_sync_outbox ORDER BY local_operation_id',
        ),
      ).toEqual(before);
      expect(await root.getAllAsync('SELECT * FROM notes')).toEqual(notes);
      expect(
        await root.getAllAsync('PRAGMA table_info(qf_sync_outbox)'),
      ).toEqual(columns);
      // Published positional INSERT still fits: V3 adds no required core columns.
      await root.runAsync(
        `INSERT INTO qf_sync_outbox VALUES ('old-write', 'qf:reader', 'reader', 'NOTE', 'CREATE', 'old-local', NULL, '{}', NULL, 0, NULL, 100, 1, 'PENDING', NULL, NULL, NULL, NULL)`,
      );
      await root.runAsync(
        `UPDATE qf_sync_outbox SET payload_json = ?, revision = revision + 1 WHERE local_operation_id = ?`,
        ['{"content":"old update"}', 'old-write'],
      );
      expect(
        await root.getFirstAsync(
          `SELECT payload_json, revision, delivery_state FROM qf_sync_outbox WHERE local_operation_id = 'old-write'`,
        ),
      ).toEqual({
        payload_json: '{"content":"old update"}',
        revision: 2,
        delivery_state: 'PENDING',
      });
      await root.runAsync(
        `DELETE FROM qf_sync_outbox WHERE local_operation_id = 'old-write'`,
      );
      await root.closeAsync();
      root = new RealSqliteDatabase(path);
      mockRoots.set(path, root);
      // Await the root open before a private connection: wa-sqlite's open_v2
      // uses shared pointer scratch space and cannot open two handles at once.
      expect(
        await root.getFirstAsync('SELECT COUNT(*) AS count FROM notes'),
      ).toEqual({count: 1});
      await migrateUserSyncV3(root);
      expect(
        await root.getAllAsync(
          'SELECT * FROM qf_sync_outbox ORDER BY local_operation_id',
        ),
      ).toEqual(before);
      expect(await root.getAllAsync('SELECT * FROM notes')).toEqual(notes);
      expect(
        await root.getAllAsync(
          'SELECT version FROM schema_migrations ORDER BY version',
        ),
      ).toEqual([
        {version: 'user_sync_v1'},
        {version: 'user_sync_v2'},
        {version: 'user_sync_v3'},
      ]);
      await root.closeAsync();
    });

    it('rolls back failed V3 DDL and its version atomically on a private handle', async () => {
      const root = new RealSqliteDatabase(
        `qf-v3-rollback-${platform}-${++sequence}.db`,
      );
      mockRoots.set(root.databasePath, root);
      await migrateUserSyncV1(root);
      await migrateUserSyncV2(root);
      const make = root.newTransactionHandle.bind(root);
      root.newTransactionHandle = () => {
        const txn = make();
        const run = txn.runAsync.bind(txn);
        txn.runAsync = async (sql, params) => {
          if (sql.includes('CREATE INDEX idx_qf_sync_payload_blocks'))
            throw new Error('DDL fixture failure');
          return run(sql, params);
        };
        return txn;
      };
      await expect(migrateUserSyncV3(root)).rejects.toThrow(
        'DDL fixture failure',
      );
      expect(
        await root.getFirstAsync(
          "SELECT name FROM sqlite_master WHERE name = 'qf_sync_payload_blocks'",
        ),
      ).toBeNull();
      expect(
        await root.getFirstAsync(
          "SELECT version FROM schema_migrations WHERE version = 'user_sync_v3'",
        ),
      ).toBeNull();
      root.newTransactionHandle = make;
      await migrateUserSyncV3(root);
      expect(root.transactions.every(txn => txn.closed)).toBe(true);
      await root.closeAsync();
    });

    it('blocks only unsent NOTE bytes and scans past 100 blocked entries to push healthy neighbors', async () => {
      const {root, sync, pull, annotations} = await createServices();
      root.forbidSharedSql = true;
      const large = 'x'.repeat(200_001);
      // Already queued published rows, not only new-client writes.
      const payload = JSON.stringify({
        ...noteInput,
        clientCreatedAt: 100,
        clientUpdatedAt: 100,
        content: large,
      });
      for (let index = 0; index < 101; index += 1)
        await root.runAsync(
          `INSERT INTO qf_sync_outbox (local_operation_id, owner_scope, account_id, resource, mutation_type, payload_json, created_at, delivery_state) VALUES (?, 'qf:reader', 'reader', 'NOTE', 'CREATE', ?, 1, 'PENDING')`,
          [`blocked-${index}`, payload],
        );
      const note = await sync.addNote({...noteInput, content: large});
      const [original] = (await sync.getOutboxEntries('reader')).filter(
        entry => entry.localId === note.id,
      );
      const healthy = await sync.addNote({...noteInput, content: 'healthy'});
      await sync.addBookmark(bookmarkInput);
      await sync.upsertReadingLocation({...bookmarkInput, lastReadAt: 100});
      await pull.commitStableHead('reader', 0, 100, 100);
      const push = jest.fn(
        async (
          _token: string,
          request: import('@/services/sync/bayaanSyncApiClient').BayaanSyncPushRequest,
        ) => ({
          lastMutationAt: 200,
          mutations: request.mutations.map((mutation, index) => ({
            ...mutation,
            resourceId: `receipt-${index}`,
            timestamp: 200,
          })),
        }),
      );
      const coordinator = new QfSyncCoordinator({
        transport: {pull: jest.fn(), push},
        store: pull,
        pushStore: sync,
        now: () => Date.now(),
      });
      expect(
        await coordinator.push({accountId: 'reader', sessionToken: 'fixture'}),
      ).toMatchObject({status: 'synced', pushed: 3});
      expect(
        push.mock.calls[0][1].mutations
          .map(mutation => mutation.resource)
          .sort(),
      ).toEqual(['BOOKMARK', 'NOTE', 'READING_SESSION']);
      expect(await sync.getSyncStatus('reader')).toMatchObject({
        pendingCount: 102,
        nextPendingAttemptAt: null,
        blockedPayloadCounts: {note_body_too_large: 102},
      });
      expect(await sync.getSyncStatus('other')).toMatchObject({
        pendingCount: 0,
        blockedPayloadCounts: {},
      });
      expect(
        (await sync.getOutboxEntries('reader')).find(
          entry => entry.localId === note.id,
        ),
      ).toEqual(original);
      expect(
        (await annotations.getAllNotesInOwnerScope('qf:reader')).find(
          row => row.id === note.id,
        )?.content,
      ).toBe(large);
      expect(
        (await annotations.getAllNotesInOwnerScope('qf:reader')).find(
          row => row.id === healthy.id,
        )?.remoteId,
      ).toBeDefined();
      await sync.updateNote({
        accountId: 'reader',
        noteId: note.id,
        content: 'shortened',
      });
      const revised = (await sync.getOutboxEntries('reader')).find(
        entry => entry.localId === note.id,
      );
      expect(revised).toMatchObject({
        localOperationId: original.localOperationId,
        revision: original.revision + 1,
        mutationType: 'CREATE',
        deliveryState: 'PENDING',
      });
      expect(
        await root.getFirstAsync(
          'SELECT reason FROM qf_sync_payload_blocks WHERE local_operation_id = ?',
          [original.localOperationId],
        ),
      ).toBeNull();
      expect(
        await coordinator.push({accountId: 'reader', sessionToken: 'fixture'}),
      ).toMatchObject({status: 'synced', pushed: 1});
      await root.closeAsync();
    });

    it.each([
      ['malformed JSON', '{'],
      [
        'string verseKeys',
        JSON.stringify({
          ...noteInput,
          clientCreatedAt: 100,
          clientUpdatedAt: 100,
          verseKeys: '2:255',
        }),
      ],
      [
        'numeric verseKeys',
        JSON.stringify({
          ...noteInput,
          clientCreatedAt: 100,
          clientUpdatedAt: 100,
          verseKeys: [255],
        }),
      ],
      [
        'object verseKeys',
        JSON.stringify({
          ...noteInput,
          clientCreatedAt: 100,
          clientUpdatedAt: 100,
          verseKeys: {length: 1},
        }),
      ],
    ])(
      'conflict rebase preserves blocked %s and lifecycle pushes only the healthy bookmark twice',
      async (_label, invalidPayload) => {
        const {root, sync, pull, annotations} = await createServices();
        root.forbidSharedSql = true;
        const note = await sync.addNote(noteInput);
        const [original] = await sync.getOutboxEntries('reader');
        await root.runAsync(
          'UPDATE qf_sync_outbox SET payload_json = ? WHERE local_operation_id = ?',
          [invalidPayload, original.localOperationId],
        );
        const blockedBefore = await root.getFirstAsync(
          'SELECT * FROM qf_sync_outbox WHERE local_operation_id = ?',
          [original.localOperationId],
        );
        await sync.addBookmark(bookmarkInput);
        let head = 100;
        const transport = {
          pull: jest.fn(async () => ({lastMutationAt: head, mutations: []})),
          push: jest.fn(
            async (
              _token: string,
              request: import('@/services/sync/bayaanSyncApiClient').BayaanSyncPushRequest,
            ) => {
              expect(request.mutations).toHaveLength(1);
              expect(request.mutations[0].resource).toBe('BOOKMARK');
              if (head === 100) {
                head = 150;
                throw new BayaanSyncApiError('sync_conflict', 409);
              }
              head = 200;
              return {
                lastMutationAt: head,
                mutations: [
                  {
                    ...request.mutations[0],
                    resourceId: 'bookmark-receipt',
                    timestamp: head,
                  },
                ],
              };
            },
          ),
        };
        const coordinator = new QfSyncCoordinator({
          transport,
          store: pull,
          pushStore: sync,
          now: () => Date.now(),
        });
        const rebase = jest.spyOn(sync, 'rebasePendingOperations');
        const lifecycle = new QfSyncLifecycle({
          enabled: true,
          coordinator,
          database: sync,
          guestImportService: {
            getOffer: async () => null,
            merge: async () => undefined,
            keepSeparate: async () => undefined,
          },
          getSession: async () => ({
            token: 'fixture',
            expiresAt: 99999,
            profile: {accountId: 'reader'},
          }),
          onSessionRevoked: async () => undefined,
          flushReadingSession: async () => undefined,
          getReadingIntentRevision: () => 0,
          beginAnnotationScopeHandoff: async () => undefined,
          clearActiveViews: () => undefined,
        });
        useQfSyncStore.getState().resetForTesting();
        const reload = jest
          .spyOn(
            useVerseAnnotationsStore.getState(),
            'loadAnnotationsForSurahs',
          )
          .mockResolvedValue(undefined);
        lifecycle.updateContext({
          authStatus: 'authenticated',
          accountId: 'reader',
          online: false,
          appActive: true,
        });
        await lifecycle.waitForIdle();
        lifecycle.updateContext({
          authStatus: 'authenticated',
          accountId: 'reader',
          online: true,
          appActive: true,
        });
        await lifecycle.waitForIdle();
        expect(transport.push).toHaveBeenCalledTimes(2);
        expect(
          transport.push.mock.calls.map(
            ([, request]) => request.lastMutationAt,
          ),
        ).toEqual([100, 150]);
        expect(rebase).toHaveBeenCalledTimes(1);
        expect(await pull.getStoredHead('reader')).toBe(200);
        expect(useQfSyncStore.getState()).toMatchObject({
          status: 'idle',
          errorCode: null,
          diagnostics: {pendingCount: 1, pushedCount: 1, ambiguousCount: 0},
        });
        expect(await sync.getSyncStatus('reader')).toMatchObject({
          pendingCount: 1,
          nextPendingAttemptAt: null,
          blockedPayloadCounts: {invalid_note_shape: 1},
        });
        expect(
          await root.getFirstAsync(
            'SELECT * FROM qf_sync_outbox WHERE local_operation_id = ?',
            [original.localOperationId],
          ),
        ).toEqual(blockedBefore);
        expect(
          await root.getAllAsync(
            'SELECT local_operation_id, reason, revision FROM qf_sync_payload_blocks',
          ),
        ).toEqual([
          {
            local_operation_id: original.localOperationId,
            reason: 'invalid_note_shape',
            revision: original.revision,
          },
        ]);
        expect(
          (await annotations.getAllBookmarksInOwnerScope('qf:reader'))[0]
            .remoteId,
        ).toBe('bookmark-receipt');
        const pullsBefore = transport.pull.mock.calls.length;
        lifecycle.requestSync();
        await lifecycle.waitForIdle();
        expect(transport.pull.mock.calls.length).toBeGreaterThan(pullsBefore);
        expect(transport.push).toHaveBeenCalledTimes(2);
        expect(useQfSyncStore.getState().status).toBe('idle');
        await lifecycle.stop();
        // Old-client write, with no sidecar/revision awareness. Rebase must inspect
        // actual bytes itself, before selecting candidates (no status refresh).
        await root.runAsync(
          'UPDATE qf_sync_outbox SET payload_json = ? WHERE local_operation_id = ?',
          [original.payloadJson, original.localOperationId],
        );
        await sync.rebasePendingOperations({
          accountId: 'reader',
          rebasedAt: Date.now(),
        });
        expect(
          await root.getAllAsync('SELECT * FROM qf_sync_payload_blocks'),
        ).toEqual([]);
        expect(await sync.getOutboxEntries('reader')).toEqual([original]);
        const [eligible] = await sync.reservePushBatch({
          accountId: 'reader',
          limit: 1,
          dueAt: Date.now(),
          startedAt: 300,
        });
        expect(eligible).toMatchObject({
          localOperationId: original.localOperationId,
          localId: note.id,
          mutationType: 'CREATE',
          revision: original.revision,
          inFlightPayloadJson: original.payloadJson,
        });
        // Do not pretend a NOTE CREATE has an authoritative recovery receipt.
        reload.mockRestore();
        rebase.mockRestore();
        await root.closeAsync();
      },
    );

    it('old writers cannot stale-block edited bytes or a reused operation ID, even without revision updates', async () => {
      const {root, sync} = await createServices();
      const note = await sync.addNote({
        ...noteInput,
        content: 'x'.repeat(200_001),
      });
      const [original] = await sync.getOutboxEntries('reader');
      const good = JSON.stringify({
        ...noteInput,
        content: 'old writer valid edit',
        clientCreatedAt: 100,
        clientUpdatedAt: 100,
      });
      await root.runAsync(
        'UPDATE qf_sync_outbox SET payload_json = ? WHERE local_operation_id = ?',
        [good, original.localOperationId],
      );
      expect(await sync.getSyncStatus('reader')).toMatchObject({
        blockedPayloadCounts: {},
        nextPendingAttemptAt: 0,
      });
      const [sent] = await sync.reservePushBatch({
        accountId: 'reader',
        limit: 1,
        dueAt: Date.now(),
        startedAt: 100,
      });
      expect(sent).toMatchObject({
        localOperationId: original.localOperationId,
        revision: original.revision,
        inFlightPayloadJson: good,
      });
      await sync.releaseInFlightOperations({
        accountId: 'reader',
        localOperationIds: [original.localOperationId],
        retryAt: 0,
      });
      await root.runAsync(
        'UPDATE qf_sync_outbox SET payload_json = ? WHERE local_operation_id = ?',
        [original.payloadJson, original.localOperationId],
      );
      await sync.getSyncStatus('reader');
      await root.runAsync(
        'DELETE FROM qf_sync_outbox WHERE local_operation_id = ?',
        [original.localOperationId],
      );
      await root.runAsync(
        `INSERT INTO qf_sync_outbox VALUES (?, 'qf:reader', 'reader', 'NOTE', 'UPDATE', ?, 'different-remote', ?, NULL, 0, NULL, 100, 1, 'PENDING', NULL, NULL, NULL, NULL)`,
        [original.localOperationId, note.id, good],
      );
      expect(
        await sync.reservePushBatch({
          accountId: 'reader',
          limit: 1,
          dueAt: 100,
          startedAt: 100,
        }),
      ).toEqual([
        expect.objectContaining({
          localOperationId: original.localOperationId,
          mutationType: 'UPDATE',
          remoteId: 'different-remote',
          inFlightPayloadJson: good,
        }),
      ]);
      expect(
        await root.getAllAsync('SELECT * FROM qf_sync_payload_blocks'),
      ).toEqual([]);
      await root.closeAsync();
    });

    it('200000 UTF16 units send, 200001 CREATE/UPDATE block, DELETE ignores historical body and sent evidence is immutable', async () => {
      const {root, sync, pull} = await createServices();
      const boundary = '😀'.repeat(100_000);
      const note = await sync.addNote({...noteInput, content: boundary});
      const [create] = await sync.reservePushBatch({
        accountId: 'reader',
        limit: 1,
        dueAt: Date.now(),
        startedAt: 100,
      });
      expect(create.inFlightPayloadJson).toContain(boundary);
      await sync.acknowledgeOperation({
        accountId: 'reader',
        localOperationId: create.localOperationId,
        resourceId: 'remote',
        serverUpdatedAt: 100,
      });
      await sync.updateNote({
        accountId: 'reader',
        noteId: note.id,
        content: boundary + 'x',
      });
      const [blocked] = await sync.getOutboxEntries('reader');
      expect(blocked).toMatchObject({
        mutationType: 'UPDATE',
        remoteId: 'remote',
      });
      expect(
        await sync.reservePushBatch({
          accountId: 'reader',
          limit: 1,
          dueAt: Date.now(),
          startedAt: 101,
        }),
      ).toEqual([]);
      await sync.updateNote({
        accountId: 'reader',
        noteId: note.id,
        content: boundary,
      });
      expect((await sync.getOutboxEntries('reader'))[0]).toMatchObject({
        localOperationId: blocked.localOperationId,
        mutationType: 'UPDATE',
        remoteId: 'remote',
      });
      const [sent] = await sync.reservePushBatch({
        accountId: 'reader',
        limit: 1,
        dueAt: Date.now(),
        startedAt: 102,
      });
      await sync.updateNote({
        accountId: 'reader',
        noteId: note.id,
        content: boundary + 'x',
      });
      const [uncertain] = await sync.getOutboxEntries('reader');
      await sync.getSyncStatus('reader');
      expect((await sync.getOutboxEntries('reader'))[0]).toEqual(uncertain);
      expect(uncertain).toMatchObject({
        deliveryState: 'IN_FLIGHT',
        inFlightRevision: sent.inFlightRevision,
        inFlightPayloadJson: sent.inFlightPayloadJson,
      });
      expect(
        await root.getAllAsync('SELECT * FROM qf_sync_payload_blocks'),
      ).toEqual([]);
      await root.runAsync(
        "UPDATE qf_sync_outbox SET delivery_state = 'AMBIGUOUS' WHERE local_operation_id = ?",
        [sent.localOperationId],
      );
      const before = await sync.getOutboxEntries('reader');
      await sync.getSyncStatus('reader');
      expect(await sync.getOutboxEntries('reader')).toEqual(before);
      await sync.acknowledgeOperation({
        accountId: 'reader',
        localOperationId: sent.localOperationId,
        resourceId: 'remote',
        serverUpdatedAt: 200,
      });
      await sync.deleteNote({accountId: 'reader', noteId: note.id});
      expect(
        await sync.reservePushBatch({
          accountId: 'reader',
          limit: 1,
          dueAt: Date.now(),
          startedAt: 201,
        }),
      ).toEqual([
        expect.objectContaining({mutationType: 'DELETE', remoteId: 'remote'}),
      ]);
      expect(
        await root.getAllAsync('SELECT * FROM qf_sync_payload_blocks'),
      ).toEqual([]);
      expect(await pull.getStoredHead('other')).toBe(0);
      await root.closeAsync();
    });

    it.each([5, 6])(
      'provider ACK followed by local SQLite code %s rolls back and lifecycle retries receipt recovery without duplicate CREATE',
      async code => {
        const {root, sync, pull, annotations} = await createServices();
        await sync.addBookmark(bookmarkInput);
        let head = 100;
        let now = 6000;
        let retry: () => void = () => undefined;
        let sent: Awaited<ReturnType<typeof sync.getOutboxEntries>> = [];
        let failedAck = false;
        let failedRecovery = false;
        const receipt: BayaanSyncMutation = {
          resource: 'BOOKMARK',
          type: 'CREATE',
          resourceId: 'provider-receipt',
          timestamp: 200,
          data: {type: 'ayah', key: 2, verseNumber: 255},
        };
        const make = root.newTransactionHandle.bind(root);
        root.newTransactionHandle = () => {
          const txn = make();
          const run = txn.runAsync.bind(txn);
          txn.runAsync = async (sql, params) => {
            if (
              head === 200 &&
              !failedAck &&
              sql.includes('DELETE FROM qf_sync_outbox')
            ) {
              failedAck = true;
              throw Object.assign(new Error('database is locked'), {code});
            }
            return run(sql, params);
          };
          return txn;
        };
        const read = root.getFirstAsync.bind(root);
        root.getFirstAsync = async (sql, params) => {
          if (
            failedAck &&
            !failedRecovery &&
            sql.includes('last_mutation_at')
          ) {
            failedRecovery = true;
            throw Object.assign(new Error('database table is locked'), {code});
          }
          return read(sql, params);
        };
        const transport = {
          pull: jest.fn(
            async (_token: string, request: BayaanSyncPullRequest) => ({
              lastMutationAt: head,
              mutations: request.metadataOnly || head === 100 ? [] : [receipt],
            }),
          ),
          push: jest.fn(async () => {
            sent = await sync.getOutboxEntries('reader');
            head = 200;
            return {lastMutationAt: head, mutations: [receipt]};
          }),
        };
        const coordinator = new QfSyncCoordinator({
          transport,
          store: pull,
          pushStore: sync,
          now: () => now,
        });
        const pushes: unknown[] = [];
        const lifecycle = new QfSyncLifecycle({
          enabled: true,
          coordinator: {
            pull: input => coordinator.pull(input),
            push: async input => {
              const result = await coordinator.push(input);
              pushes.push(result);
              return result;
            },
          },
          database: sync,
          guestImportService: {
            getOffer: async () => null,
            merge: async () => undefined,
            keepSeparate: async () => undefined,
          },
          getSession: async () => ({
            token: 'fixture',
            expiresAt: 99999,
            profile: {accountId: 'reader'},
          }),
          onSessionRevoked: async () => undefined,
          flushReadingSession: async () => undefined,
          getReadingIntentRevision: () => 0,
          beginAnnotationScopeHandoff: async () => undefined,
          clearActiveViews: () => undefined,
          now: () => now,
          setTimer: (callback, delay) => {
            expect(delay).toBe(1000);
            retry = callback;
            return 42 as unknown as ReturnType<typeof setTimeout>;
          },
          clearTimer: () => undefined,
        });
        useQfSyncStore.getState().resetForTesting();
        const reload = jest
          .spyOn(
            useVerseAnnotationsStore.getState(),
            'loadAnnotationsForSurahs',
          )
          .mockResolvedValue(undefined);
        lifecycle.updateContext({
          authStatus: 'authenticated',
          accountId: 'reader',
          online: false,
          appActive: true,
        });
        await lifecycle.waitForIdle();
        lifecycle.updateContext({
          authStatus: 'authenticated',
          accountId: 'reader',
          online: true,
          appActive: true,
        });
        await lifecycle.waitForIdle();
        expect(useQfSyncStore.getState().errorCode).toBe('local_sqlite_locked');
        expect(transport.push).toHaveBeenCalledTimes(1);
        expect(failedAck && failedRecovery).toBe(true);
        expect(useQfSyncStore.getState()).toMatchObject({
          status: 'retry',
          retryAt: 7000,
          errorCode: 'local_sqlite_locked',
        });
        expect(await sync.getOutboxEntries('reader')).toEqual(sent);
        expect(sent[0]).toMatchObject({
          deliveryState: 'IN_FLIGHT',
          inFlightMutationType: 'CREATE',
          inFlightRevision: 1,
        });
        expect(sent[0].inFlightPayloadJson).toBe(sent[0].payloadJson);
        expect(
          (await annotations.getAllBookmarksInOwnerScope('qf:reader'))[0]
            .remoteId,
        ).toBeUndefined();
        expect(await pull.getStoredHead('reader')).toBe(100);
        now = 7000;
        retry();
        await lifecycle.waitForIdle();
        expect(pushes).toContainEqual(
          expect.objectContaining({
            status: 'recovered',
            acknowledged: 1,
            ambiguous: 0,
          }),
        );
        expect(transport.push).toHaveBeenCalledTimes(1);
        expect(await sync.getOutboxEntries('reader')).toEqual([]);
        expect(
          (await annotations.getAllBookmarksInOwnerScope('qf:reader'))[0]
            .remoteId,
        ).toBe('provider-receipt');
        expect(await pull.getStoredHead('reader')).toBe(200);
        expect(useQfSyncStore.getState().status).toBe('idle');
        await lifecycle.stop();
        reload.mockRestore();
        await root.closeAsync();
      },
    );

    it('only typed unsupported PENDING payloads get markers; mapper and storage failures surface atomically', async () => {
      const {root, sync} = await createServices();
      await sync.addNote({...noteInput, content: 'x'.repeat(200_001)});
      await sync.addNote(noteInput);
      const before = await sync.getOutboxEntries('reader');
      const markers = await root.getAllAsync(
        'SELECT * FROM qf_sync_payload_blocks',
      );
      const mapper = jest
        .spyOn(resourceMapper, 'mapOutboxEntryToSyncMutation')
        .mockImplementation(() => {
          throw new Error('programming failure');
        });
      try {
        await expect(
          sync.reservePushBatch({
            accountId: 'reader',
            limit: 10,
            dueAt: Date.now(),
            startedAt: 100,
          }),
        ).rejects.toThrow('programming failure');
        await expect(
          sync.rebasePendingOperations({accountId: 'reader', rebasedAt: 100}),
        ).rejects.toThrow('programming failure');
      } finally {
        mapper.mockRestore();
      }
      expect(
        await root.getAllAsync('SELECT * FROM qf_sync_payload_blocks'),
      ).toEqual(markers);
      expect(await sync.getOutboxEntries('reader')).toEqual(before);
      const make = root.newTransactionHandle.bind(root);
      root.newTransactionHandle = () => {
        const txn = make();
        const run = txn.runAsync.bind(txn);
        txn.runAsync = async (sql, params) => {
          if (sql.includes('INSERT INTO qf_sync_payload_blocks'))
            throw new Error('storage failure');
          return run(sql, params);
        };
        return txn;
      };
      await expect(sync.getSyncStatus('reader')).rejects.toThrow(
        'storage failure',
      );
      await expect(
        sync.rebasePendingOperations({accountId: 'reader', rebasedAt: 100}),
      ).rejects.toThrow('storage failure');
      root.newTransactionHandle = make;
      expect(await sync.getOutboxEntries('reader')).toEqual(before);
      expect(
        await root.getAllAsync('SELECT * FROM qf_sync_payload_blocks'),
      ).toEqual(markers);
      expect(
        await sync.reservePushBatch({
          accountId: 'reader',
          limit: 10,
          dueAt: Date.now(),
          startedAt: 100,
        }),
      ).toHaveLength(1);
      expect(
        await root.getAllAsync('SELECT reason FROM qf_sync_payload_blocks'),
      ).toEqual([{reason: 'note_body_too_large'}]);
      await root.closeAsync();
    });

    it('mixed-range add preserves existing remote and pending identities and enqueues only inserted rows', async () => {
      const {root, annotations, sync, pull} = await createServices();
      root.forbidSharedSql = true;
      await pull.applyPage('reader', [
        {
          resource: 'BOOKMARK',
          type: 'CREATE',
          resourceId: 'remote-existing',
          timestamp: 100,
          data: {type: 'ayah', key: 2, verseNumber: 255},
        },
      ]);
      const [remoteBefore] =
        await annotations.getAllBookmarksInOwnerScope('qf:reader');
      await sync.addBookmark(bookmarkInput);
      expect(await sync.getOutboxEntries('reader')).toEqual([]);
      expect(
        await annotations.getAllBookmarksInOwnerScope('qf:reader'),
      ).toEqual([remoteBefore]);
      const next = {...bookmarkInput, verseKey: '2:256', ayahNumber: 256};
      await sync.addBookmark(next);
      const [pending] = await sync.getOutboxEntries('reader');
      await sync.reservePushBatch({
        accountId: 'reader',
        limit: 1,
        dueAt: Date.now(),
        startedAt: 101,
      });
      await sync.releaseInFlightOperations({
        accountId: 'reader',
        localOperationIds: [pending.localOperationId],
        retryAt: Date.now() + 60_000,
      });
      const before = await sync.getOutboxEntries('reader');
      await sync.addBookmark(bookmarkInput);
      await sync.addBookmark(next);
      expect(await sync.getOutboxEntries('reader')).toEqual(before);
      expect(
        await annotations.getAllBookmarksInOwnerScope('qf:reader'),
      ).toHaveLength(2);
      expect(root.transactions.every(txn => txn.closed)).toBe(true);
      await root.closeAsync();
    });

    it('overlapping private transactions retain one bookmark and CREATE, or surface a safe lock rejection', async () => {
      const {root, annotations, sync} = await createServices();
      await sync.addBookmark(bookmarkInput);
      const before = await sync.getOutboxEntries('reader');
      const beforeRows =
        await annotations.getAllBookmarksInOwnerScope('qf:reader');
      const entered = gate();
      const release = gate();
      root.beforeTransactionSql = async () => {
        entered.resolve();
        await release.promise;
      };
      const original = sync.addBookmark(bookmarkInput);
      await entered.promise;
      // Pause after BEGIN on one private handle and overlap a distinct handle.
      // SQLite can admit this ordering or reject it; neither permits loss.
      const overlapping = await sync.addBookmark(bookmarkInput).then(
        () => null,
        (error: unknown) => error,
      );
      if (overlapping !== null) {
        expect(overlapping).toBeInstanceOf(Error);
        expect((overlapping as Error).message).toMatch(
          /transaction|locked|busy/i,
        );
      }
      expect(root.transactions.at(-1)).not.toBe(root.transactions.at(-2));
      release.resolve();
      await original;
      expect(await sync.getOutboxEntries('reader')).toEqual(before);
      expect(
        await annotations.getAllBookmarksInOwnerScope('qf:reader'),
      ).toEqual(beforeRows);
      expect(root.transactions.every(txn => txn.closed)).toBe(true);
      await root.closeAsync();
    });

    it.each(['PENDING', 'IN_FLIGHT', 'AMBIGUOUS'] as const)(
      'repeated existing CREATE add retains exact identity and uncertainty (%s)',
      async deliveryState => {
        const {root, sync} = await createServices();
        await sync.addBookmark(bookmarkInput);
        const [created] = await sync.getOutboxEntries('reader');
        if (deliveryState !== 'PENDING') {
          await sync.markOperationInFlight({
            accountId: 'reader',
            localOperationId: created.localOperationId,
            startedAt: 101,
          });
          if (deliveryState === 'AMBIGUOUS')
            await root.runAsync(
              "UPDATE qf_sync_outbox SET delivery_state = 'AMBIGUOUS' WHERE local_operation_id = ?",
              [created.localOperationId],
            );
        }
        const before = await sync.getOutboxEntries('reader');
        await sync.addBookmark(bookmarkInput);
        await sync.addBookmark(bookmarkInput);
        expect(await sync.getOutboxEntries('reader')).toEqual(before);
        await root.closeAsync();
      },
    );

    it.each(['PENDING', 'IN_FLIGHT', 'AMBIGUOUS'] as const)(
      're-add cancels only unsent DELETE and retains uncertain evidence (%s)',
      async deliveryState => {
        const {root, annotations, sync, pull} = await createServices();
        root.forbidSharedSql = true;
        await pull.applyPage('reader', [
          {
            resource: 'BOOKMARK',
            type: 'CREATE',
            resourceId: 'remote-existing',
            timestamp: 100,
            data: {type: 'ayah', key: 2, verseNumber: 255},
          },
        ]);
        await sync.removeBookmark({accountId: 'reader', verseKey: '2:255'});
        const [deleted] = await sync.getOutboxEntries('reader');
        if (deliveryState !== 'PENDING') {
          await sync.markOperationInFlight({
            accountId: 'reader',
            localOperationId: deleted.localOperationId,
            startedAt: 101,
          });
          if (deliveryState === 'AMBIGUOUS')
            await root.runAsync(
              "UPDATE qf_sync_outbox SET delivery_state = 'AMBIGUOUS' WHERE local_operation_id = ?",
              [deleted.localOperationId],
            );
        }
        const [before] = await sync.getOutboxEntries('reader');
        await sync.addBookmark(bookmarkInput);
        const after = await sync.getOutboxEntries('reader');
        if (deliveryState === 'PENDING') {
          expect(after).toEqual([]);
          expect(
            await annotations.getAllBookmarksInOwnerScope('qf:reader'),
          ).toEqual([
            expect.objectContaining({
              remoteId: 'remote-existing',
              serverUpdatedAt: 100,
            }),
          ]);
        } else {
          expect(after).toEqual([
            expect.objectContaining({
              localOperationId: before.localOperationId,
              deliveryState,
              inFlightPayloadJson: before.inFlightPayloadJson,
              inFlightRevision: before.inFlightRevision,
              inFlightMutationType: 'DELETE',
              revision: before.revision + 1,
              mutationType: 'CREATE',
            }),
          ]);
          await sync.addBookmark(bookmarkInput);
          expect(await sync.getOutboxEntries('reader')).toEqual(after);
        }
        await root.closeAsync();
      },
    );

    it.each(['favorites', 'public-notes'])(
      'filtered %s pages retain raw cardinality and commit no head until full traversal and head-only metadata',
      async projection => {
        const {root, annotations, pull} = await createServices();
        await pull.commitStableHead('reader', 0, 100, 100);
        const observed: string[] = [];
        const transport = new BayaanSyncApiClient({
          apiUrl: 'https://fixture.invalid',
          fetchImpl: async url => {
            const query = new URL(url).searchParams;
            expect(await pull.getStoredHead('reader')).toBe(100);
            const metadata = query.get('metadataOnly') === 'true';
            const page = Number(query.get('page'));
            observed.push(metadata ? 'metadata' : `page-${page}`);
            const data = metadata
              ? {lastMutationAt: 200}
              : {
                  lastMutationAt: 200,
                  page,
                  limit: 1000,
                  total: 1001,
                  hasMore: page === 1,
                  mutations:
                    page === 1
                      ? Array.from({length: 1000}, (_, index) =>
                          projection === 'public-notes'
                            ? {
                                resource: 'NOTE',
                                type: 'CREATE',
                                resourceId: `public-${index}`,
                                timestamp: 200,
                                data: {
                                  body: 'public',
                                  ranges: ['2:255-2:255'],
                                  saveToQR: true,
                                },
                              }
                            : {
                                resource: 'BOOKMARK',
                                type: 'CREATE',
                                resourceId: `favorite-${index}`,
                                timestamp: 200,
                                data: {
                                  type: 'ayah',
                                  key: 2,
                                  verseNumber: 255,
                                  isInDefaultCollection: true,
                                },
                              },
                        )
                      : [
                          {
                            resource: 'BOOKMARK',
                            type: 'CREATE',
                            resourceId: 'standalone',
                            timestamp: 200,
                            data: {type: 'ayah', key: 2, verseNumber: 256},
                          },
                        ],
                };
            const bytes = new TextEncoder().encode(
              JSON.stringify({success: true, data}),
            );
            return {
              ok: true,
              status: 200,
              headers: new Headers(),
              body: new ReadableStream({
                start(controller) {
                  controller.enqueue(bytes);
                  controller.close();
                },
              }),
            } as Response;
          },
        });
        const coordinator = new QfSyncCoordinator({transport, store: pull});
        await expect(
          coordinator.pull({accountId: 'reader', sessionToken: 'fixture'}),
        ).resolves.toEqual({status: 'synced', head: 200, restarts: 0});
        expect(observed).toEqual(['page-1', 'page-2', 'metadata']);
        expect(await pull.getStoredHead('reader')).toBe(200);
        expect(
          await annotations.getAllBookmarksInOwnerScope('qf:reader'),
        ).toEqual([
          expect.objectContaining({remoteId: 'standalone', verseKey: '2:256'}),
        ]);
        await root.closeAsync();
      },
    );

    it.each([
      undefined,
      null,
      {},
      'wrong-type',
      ...[
        {resourceId: ''},
        {timestamp: -1},
        {data: {ranges: ['2:999-2:999']}},
        {data: {body: 'x'.repeat(200_001)}},
        {data: {saveToQR: 'true'}},
      ].map(extra => [
        {
          resource: 'NOTE',
          type: 'CREATE',
          resourceId: 'malformed-public',
          timestamp: 200,
          ...extra,
          data: {
            body: 'public',
            ranges: ['2:255-2:255'],
            saveToQR: true,
            ...extra.data,
          },
        },
      ]),
    ])(
      'invalid ordinary/public mutations preserve SQLite annotations, cursor and outbox',
      async mutations => {
        const {root, annotations, sync, pull} = await createServices();
        await sync.addBookmark(bookmarkInput);
        await sync.addNote(noteInput);
        await pull.commitStableHead('reader', 0, 100, 100);
        const beforeBookmarks =
          await annotations.getAllBookmarksInOwnerScope('qf:reader');
        const beforeNotes = await annotations.getNotesForVerseInOwnerScope(
          'qf:reader',
          '2:255',
        );
        const beforeOutbox = await sync.getOutboxEntries('reader');
        const transport = new BayaanSyncApiClient({
          apiUrl: 'https://fixture.invalid',
          fetchImpl: async url => {
            const metadata =
              new URL(url).searchParams.get('metadataOnly') === 'true';
            const bytes = new TextEncoder().encode(
              JSON.stringify({
                success: true,
                data: {
                  lastMutationAt: 200,
                  ...(metadata ? {} : {mutations}),
                },
              }),
            );
            return {
              ok: true,
              status: 200,
              headers: new Headers(),
              body: new ReadableStream({
                start(controller) {
                  controller.enqueue(bytes);
                  controller.close();
                },
              }),
            } as Response;
          },
        });
        const coordinator = new QfSyncCoordinator({transport, store: pull});
        await expect(
          coordinator.pull({accountId: 'reader', sessionToken: 'fixture'}),
        ).rejects.toMatchObject({code: 'invalid_response'});
        expect(await pull.getStoredHead('reader')).toBe(100);
        expect(
          await annotations.getAllBookmarksInOwnerScope('qf:reader'),
        ).toEqual(beforeBookmarks);
        expect(
          await annotations.getNotesForVerseInOwnerScope('qf:reader', '2:255'),
        ).toEqual(beforeNotes);
        expect(await sync.getOutboxEntries('reader')).toEqual(beforeOutbox);
        await root.closeAsync();
      },
    );

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
      expect(root.transactions).toHaveLength(4);
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
