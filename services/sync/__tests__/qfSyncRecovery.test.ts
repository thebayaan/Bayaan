import {
  BayaanSyncApiError,
  type BayaanSyncPushRequest,
} from '@/services/sync/bayaanSyncApiClient';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
import {
  QfSyncCoordinator,
  type QfSyncPullStore,
  type QfSyncPushStore,
  type QfSyncTransport,
} from '@/services/sync/qfSyncCoordinator';
import type {QfOutboxEntry} from '@/services/sync/qfSyncDatabaseService';
import type {QfSyncSqliteExecutor} from '@/services/sync/qfSyncTransaction';
import type {
  BayaanSyncMutation,
  BayaanSyncPullPage,
  BayaanSyncPushResult,
} from '@/services/sync/bayaanSyncCodec';

const accountId = 'reader-a';
const sessionToken = 'opaque-bayaan-session';

function noteEntry(
  deliveryState: QfOutboxEntry['deliveryState'] = 'PENDING',
): QfOutboxEntry {
  const payloadJson = JSON.stringify({
    verseKey: '2:255',
    surahNumber: 2,
    ayahNumber: 255,
    content: 'Private reflection',
    verseKeys: ['2:255'],
    clientCreatedAt: 1_700_000_000_000,
    clientUpdatedAt: 1_700_000_000_000,
  });
  return {
    localOperationId: 'note-create-1',
    ownerScope: 'qf:reader-a',
    accountId,
    resource: 'NOTE',
    mutationType: 'CREATE',
    localId: 'local-note-1',
    remoteId: null,
    payloadJson,
    baseServerUpdatedAt: null,
    attempts: 0,
    nextAttemptAt: null,
    createdAt: 1_700_000_000_000,
    revision: 1,
    deliveryState,
    inFlightRevision: deliveryState === 'PENDING' ? null : 1,
    inFlightMutationType: deliveryState === 'PENDING' ? null : 'CREATE',
    inFlightPayloadJson: deliveryState === 'PENDING' ? null : payloadJson,
    inFlightStartedAt: deliveryState === 'PENDING' ? null : 1_700_000_001_000,
  };
}

class RecoveryStore implements QfSyncPullStore, QfSyncPushStore {
  head = 7001;
  entries = [noteEntry()];
  readonly events: string[] = [];
  reconcileResult = {acknowledged: 0, ambiguous: 0};

  async getStoredHead(): Promise<number> {
    return this.head;
  }

  async applyPage(
    _accountId: string,
    mutations: BayaanSyncMutation[],
  ): Promise<void> {
    this.events.push(`apply:${mutations.length}`);
  }

  async commitStableHead(
    _accountId: string,
    expectedHead: number,
    stableHead: number,
  ): Promise<boolean> {
    if (this.head !== expectedHead) return false;
    this.head = stableHead;
    this.events.push(`pull-head:${stableHead}`);
    return true;
  }

  async getOutboxEntries(): Promise<QfOutboxEntry[]> {
    return this.entries;
  }

  async reservePushBatch(): Promise<QfOutboxEntry[]> {
    const marked = {
      ...this.entries[0],
      deliveryState: 'IN_FLIGHT' as const,
      inFlightRevision: this.entries[0].revision,
      inFlightMutationType: this.entries[0].mutationType,
      inFlightPayloadJson: this.entries[0].payloadJson,
      inFlightStartedAt: 1_700_000_001_000,
    };
    this.entries = [marked];
    this.events.push('mark');
    return [marked];
  }

  async commitPushSuccess(input: {
    result: BayaanSyncPushResult;
  }): Promise<boolean> {
    this.head = input.result.lastMutationAt;
    this.entries = [];
    this.events.push(`push-head:${input.result.lastMutationAt}`);
    return true;
  }

  async releaseInFlightOperations(input: {retryAt: number}): Promise<void> {
    this.entries = this.entries.map(entry => ({
      ...entry,
      deliveryState: 'PENDING',
      attempts: entry.attempts + 1,
      nextAttemptAt: input.retryAt,
      inFlightRevision: null,
      inFlightMutationType: null,
      inFlightPayloadJson: null,
      inFlightStartedAt: null,
    }));
    this.events.push(`release:${input.retryAt}`);
  }

  async reconcileUncertainOperations(): Promise<{
    acknowledged: number;
    ambiguous: number;
  }> {
    this.events.push('reconcile');
    if (this.reconcileResult.acknowledged > 0) this.entries = [];
    if (this.reconcileResult.ambiguous > 0) {
      this.entries = this.entries.map(entry => ({
        ...entry,
        deliveryState: 'AMBIGUOUS',
      }));
    }
    return this.reconcileResult;
  }

  async rebasePendingOperations(): Promise<void> {
    this.events.push('rebase');
  }
}

class RecoveryTransport implements QfSyncTransport {
  readonly events: string[] = [];
  readonly pushRequests: BayaanSyncPushRequest[] = [];
  pushSteps: Array<BayaanSyncPushResult | Error> = [];
  pullHead = 7002;

  async pull(
    _token: string,
    request: {metadataOnly?: boolean},
  ): Promise<BayaanSyncPullPage> {
    this.events.push(request.metadataOnly ? 'pull:metadata' : 'pull:page');
    return request.metadataOnly
      ? {lastMutationAt: this.pullHead, mutations: []}
      : {
          lastMutationAt: this.pullHead,
          mutations: [],
          page: 1,
          limit: 1000,
          total: 0,
          hasMore: false,
        };
  }

  async push(
    _token: string,
    request: BayaanSyncPushRequest,
  ): Promise<BayaanSyncPushResult> {
    this.events.push('push');
    this.pushRequests.push(request);
    const step = this.pushSteps.shift();
    if (!step) throw new Error('Unexpected push');
    if (step instanceof Error) throw step;
    return step;
  }
}

function createRecoveryCoordinator(
  store: RecoveryStore,
  transport: RecoveryTransport,
) {
  return new QfSyncCoordinator({
    transport,
    store,
    pushStore: store,
    now: () => 10_000,
    sleep: async () => undefined,
    baseBackoffMs: 250,
  });
}

describe('QF push recovery', () => {
  it('pulls and reconciles durable uncertain rows before allowing another post', async () => {
    const store = new RecoveryStore();
    store.entries = [noteEntry('IN_FLIGHT')];
    store.reconcileResult = {acknowledged: 1, ambiguous: 0};
    const transport = new RecoveryTransport();

    await expect(
      createRecoveryCoordinator(store, transport).push({
        accountId,
        sessionToken,
      }),
    ).resolves.toEqual({
      status: 'recovered',
      head: 7002,
      acknowledged: 1,
      ambiguous: 0,
    });
    expect(transport.events).toEqual(['pull:page', 'pull:metadata']);
    expect(transport.pushRequests).toEqual([]);
    expect(store.events).toEqual(['apply:0', 'pull-head:7002', 'reconcile']);
  });

  it('rebases a 409 through a stable pull, rebuilds current intent, and retries once', async () => {
    const store = new RecoveryStore();
    const transport = new RecoveryTransport();
    transport.pushSteps = [
      new BayaanSyncApiError('sync_conflict', 409),
      {
        lastMutationAt: 7003,
        mutations: [
          {
            resource: 'NOTE',
            type: 'CREATE',
            resourceId: 'remote-note-1',
            timestamp: 7003,
            data: {
              body: 'Private reflection',
              ranges: ['2:255-2:255'],
              saveToQR: false,
            },
          },
        ],
      },
    ];

    await expect(
      createRecoveryCoordinator(store, transport).push({
        accountId,
        sessionToken,
      }),
    ).resolves.toEqual({status: 'synced', head: 7003, pushed: 1});

    expect(
      transport.pushRequests.map(request => request.lastMutationAt),
    ).toEqual([7001, 7002]);
    expect(store.events).toEqual([
      'mark',
      'release:10000',
      'apply:0',
      'pull-head:7002',
      'rebase',
      'mark',
      'push-head:7003',
    ]);
  });

  it('backs off after a second 409 without dropping or leaving rows in flight', async () => {
    const store = new RecoveryStore();
    const transport = new RecoveryTransport();
    transport.pushSteps = [
      new BayaanSyncApiError('sync_conflict', 409),
      new BayaanSyncApiError('sync_conflict', 409),
    ];

    await expect(
      createRecoveryCoordinator(store, transport).push({
        accountId,
        sessionToken,
      }),
    ).resolves.toEqual({
      status: 'deferred',
      reason: 'conflict',
      retryAfterMs: 500,
    });
    expect(transport.pushRequests).toHaveLength(2);
    expect(store.entries).toEqual([
      expect.objectContaining({
        localOperationId: 'note-create-1',
        deliveryState: 'PENDING',
        attempts: 2,
        nextAttemptAt: 10_500,
      }),
    ]);
  });

  it('pulls and correlates after a lost response without replaying the batch', async () => {
    const store = new RecoveryStore();
    store.reconcileResult = {acknowledged: 1, ambiguous: 0};
    const transport = new RecoveryTransport();
    transport.pushSteps = [new BayaanSyncApiError('service_unavailable', 503)];

    await expect(
      createRecoveryCoordinator(store, transport).push({
        accountId,
        sessionToken,
      }),
    ).resolves.toEqual({
      status: 'recovered',
      head: 7002,
      acknowledged: 1,
      ambiguous: 0,
    });
    expect(transport.events).toEqual(['push', 'pull:page', 'pull:metadata']);
    expect(transport.pushRequests).toHaveLength(1);
    expect(store.events).toEqual([
      'mark',
      'apply:0',
      'pull-head:7002',
      'reconcile',
    ]);
  });

  it('treats a malformed success response as ambiguous and reconciles before retry', async () => {
    const store = new RecoveryStore();
    store.reconcileResult = {acknowledged: 1, ambiguous: 0};
    const transport = new RecoveryTransport();
    transport.pushSteps = [new BayaanSyncApiError('invalid_response', 200)];

    await expect(
      createRecoveryCoordinator(store, transport).push({
        accountId,
        sessionToken,
      }),
    ).resolves.toEqual({
      status: 'recovered',
      head: 7002,
      acknowledged: 1,
      ambiguous: 0,
    });
    expect(transport.pushRequests).toHaveLength(1);
    expect(store.events).toEqual([
      'mark',
      'apply:0',
      'pull-head:7002',
      'reconcile',
    ]);
  });

  it('quarantines an unprovable note create after pull instead of replaying it', async () => {
    const store = new RecoveryStore();
    store.reconcileResult = {acknowledged: 0, ambiguous: 1};
    const transport = new RecoveryTransport();
    transport.pushSteps = [new BayaanSyncApiError('service_unavailable', 0)];

    await expect(
      createRecoveryCoordinator(store, transport).push({
        accountId,
        sessionToken,
      }),
    ).resolves.toEqual({
      status: 'recovered',
      head: 7002,
      acknowledged: 0,
      ambiguous: 1,
    });
    expect(transport.pushRequests).toHaveLength(1);
    expect(store.entries[0].deliveryState).toBe('AMBIGUOUS');
  });
});

const sqlitePromise = (async () => {
  const fs = require('fs');
  const path = require('path');
  const {TextDecoder} = require('util');
  global.TextDecoder = TextDecoder;
  const waSqliteDir = path.join(
    process.cwd(),
    'node_modules',
    'expo-sqlite',
    'web',
    'wa-sqlite',
  );
  const ModuleFactory = require(path.join(waSqliteDir, 'wa-sqlite.js'));
  const SQLite = require(path.join(waSqliteDir, 'sqlite-api.js'));
  const wasmBinary = fs.readFileSync(path.join(waSqliteDir, 'wa-sqlite.wasm'));
  const module = await ModuleFactory({wasmBinary});
  return {sqlite3: SQLite.Factory(module), SQLite};
})();

type TestDatabase = {
  execAsync(source: string): Promise<void>;
  runAsync(
    source: string,
    params?: unknown[] | Record<string, unknown>,
  ): Promise<unknown>;
  getAllAsync<T extends Record<string, unknown>>(
    source: string,
    params?: unknown[] | Record<string, unknown>,
  ): Promise<T[]>;
  getFirstAsync<T extends Record<string, unknown>>(
    source: string,
    params?: unknown[] | Record<string, unknown>,
  ): Promise<T | null>;
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
  beforeRunAsync?: (source: string) => void;
  closeAsync(): Promise<void>;
};

class ExpoSqliteWasmDatabase implements TestDatabase {
  private readonly dbPromise: Promise<number>;
  beforeRunAsync?: (source: string) => void;

  constructor(private readonly databaseName: string) {
    this.dbPromise = sqlitePromise.then(({sqlite3}) =>
      sqlite3.open_v2(databaseName),
    );
  }

  async execAsync(source: string): Promise<void> {
    const {sqlite3} = await sqlitePromise;
    await sqlite3.exec(await this.dbPromise, source);
  }

  async runAsync(
    source: string,
    params: unknown[] | Record<string, unknown> = [],
  ): Promise<unknown> {
    this.beforeRunAsync?.(source);
    const {sqlite3} = await sqlitePromise;
    const db = await this.dbPromise;
    for await (const stmt of sqlite3.statements(db, source)) {
      sqlite3.bind_collection(stmt, params);
      await sqlite3.step(stmt);
    }
    return {changes: sqlite3.changes(db)};
  }

  async getAllAsync<T extends Record<string, unknown>>(
    source: string,
    params: unknown[] | Record<string, unknown> = [],
  ): Promise<T[]> {
    const {sqlite3, SQLite} = await sqlitePromise;
    const db = await this.dbPromise;
    const rows: T[] = [];
    for await (const stmt of sqlite3.statements(db, source)) {
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

  async getFirstAsync<T extends Record<string, unknown>>(
    source: string,
    params: unknown[] | Record<string, unknown> = [],
  ): Promise<T | null> {
    return (await this.getAllAsync<T>(source, params))[0] ?? null;
  }

  async withTransactionAsync(task: () => Promise<void>): Promise<void> {
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
  ): Promise<void> {
    // Expo native exclusive transactions supply a distinct callback connection.
    await this.dbPromise;
    const txn = new ExpoSqliteWasmDatabase(this.databaseName);
    txn.beforeRunAsync = source => this.beforeRunAsync?.(source);
    try {
      await txn.withTransactionAsync(() =>
        task(txn as unknown as QfSyncSqliteExecutor),
      );
    } finally {
      await txn.closeAsync();
    }
  }

  async closeAsync(): Promise<void> {
    const {sqlite3} = await sqlitePromise;
    await sqlite3.close(await this.dbPromise);
  }
}

const mockOpenDatabaseAsync = jest.fn(
  async (databaseName: string) => new ExpoSqliteWasmDatabase(databaseName),
);

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: mockOpenDatabaseAsync,
}));

const databasePrefix = `qf-push-${Date.now()}-${Math.random()
  .toString(36)
  .slice(2)}`;

async function createServices(name: string) {
  jest.resetModules();
  jest.doMock('expo-sqlite', () => ({
    openDatabaseAsync: mockOpenDatabaseAsync,
  }));
  const {
    VerseAnnotationDatabase,
  } = require('@/services/database/VerseAnnotationDatabase');
  const {
    VerseAnnotationDatabaseService,
  } = require('@/services/database/VerseAnnotationDatabaseService');
  const {
    QfSyncDatabaseService,
  } = require('@/services/sync/qfSyncDatabaseService');
  const {
    QfSyncCoordinator: IntegratedCoordinator,
    SqliteQfSyncPullStore,
  } = require('@/services/sync/qfSyncCoordinator');
  const {
    BayaanSyncApiError: IntegratedApiError,
  } = require('@/services/sync/bayaanSyncApiClient');
  const database = new VerseAnnotationDatabase(`${databasePrefix}-${name}`);
  const annotations = new VerseAnnotationDatabaseService(database);
  const sync = new QfSyncDatabaseService({database, annotations});
  return {
    database,
    annotations,
    sync,
    IntegratedCoordinator,
    SqliteQfSyncPullStore,
    IntegratedApiError,
  };
}

async function seedHead(
  database: {getConnection(): Promise<TestDatabase>},
  head: number,
): Promise<void> {
  const connection = await database.getConnection();
  await connection.runAsync(
    `INSERT INTO qf_sync_state
       (owner_scope, last_mutation_at, created_at, updated_at)
     VALUES (?, ?, ?, ?)`,
    ['qf:reader-a', String(head), head, head],
  );
}

async function createRemoteBackedNote(
  sync: {
    addNote(input: {
      accountId: string;
      verseKey: string;
      surahNumber: number;
      ayahNumber: number;
      content: string;
      verseKeys: string[];
    }): Promise<{id: string}>;
    getOutboxEntries(account: string): Promise<QfOutboxEntry[]>;
    markOperationInFlight(input: {
      accountId: string;
      localOperationId: string;
      startedAt: number;
    }): Promise<QfOutboxEntry>;
    acknowledgeOperation(input: {
      accountId: string;
      localOperationId: string;
      resourceId: string;
      serverCreatedAt: number;
      serverUpdatedAt: number;
    }): Promise<void>;
  },
  content: string,
): Promise<{id: string}> {
  const note = await sync.addNote({
    accountId,
    verseKey: '2:255',
    surahNumber: 2,
    ayahNumber: 255,
    content,
    verseKeys: ['2:255'],
  });
  const [create] = await sync.getOutboxEntries(accountId);
  await sync.markOperationInFlight({
    accountId,
    localOperationId: create.localOperationId,
    startedAt: 6999,
  });
  await sync.acknowledgeOperation({
    accountId,
    localOperationId: create.localOperationId,
    resourceId: 'remote-note-1',
    serverCreatedAt: 7000,
    serverUpdatedAt: 7000,
  });
  return note;
}

describe('SQLite push recovery store', () => {
  it.each([
    'mixed',
    'unsupported-only',
    'changing-head',
    'single-page',
  ] as const)(
    'projects unsupported non-ayah and Favorites reads across all provider pages without cloud writes (%s)',
    async mode => {
      const {database, sync, SqliteQfSyncPullStore, IntegratedCoordinator} =
        await createServices(`bookmark-projection-${mode}.db`);
      const {
        BayaanSyncApiClient,
      } = require('@/services/sync/bayaanSyncApiClient');
      await sync.initialize();
      const store = new SqliteQfSyncPullStore(database);
      await store.commitStableHead(accountId, 0, 7001, 1000);
      await store.commitStableHead('reader-b', 0, 9001, 1000);
      await store.applyPage(accountId, [
        {
          resource: 'BOOKMARK',
          type: 'CREATE',
          resourceId: 'keep',
          timestamp: 7000,
          data: {type: 'ayah', key: 2, verseNumber: 255},
        },
      ]);
      await sync.addNote({
        accountId: 'reader-b',
        verseKey: '3:1',
        surahNumber: 3,
        ayahNumber: 1,
        content: 'private-b',
      });
      const beforeB = await sync.getOutboxEntries('reader-b');
      const nonAyah = (type: string, index: number) => ({
        resource: 'BOOKMARK',
        type: index % 2 ? 'UPDATE' : 'CREATE',
        resourceId: `unsupported-${index}`,
        timestamp: 7002 + index,
        data: {bookmarkType: type, key: 10, verseNumber: null, isReading: null},
      });
      const mutations: unknown[] = Array.from(
        {length: mode === 'single-page' ? 3 : 1000},
        (_, index) =>
          index % 2
            ? {
                resource: 'BOOKMARK',
                type: index % 4 === 1 ? 'CREATE' : 'UPDATE',
                resourceId: `favorite-${index}`,
                timestamp: 7002 + index,
                data: {
                  type: 'ayah',
                  key: 2,
                  verseNumber: 255,
                  isInDefaultCollection: true,
                },
              }
            : nonAyah(['page', 'juz', 'surah'][index % 3], index),
      );
      // In paginated modes, the first page projects to zero effects but continues.
      mutations.push(nonAyah('surah', 1000));
      if (mode !== 'unsupported-only')
        mutations.push(
          {
            resource: 'BOOKMARK',
            type: 'CREATE',
            resourceId: 'delete-me',
            timestamp: 8101,
            data: {type: 'ayah', key: 3, verseNumber: 1},
          },
          {
            resource: 'BOOKMARK',
            type: 'DELETE',
            resourceId: 'delete-me',
            timestamp: 8102,
            data: {},
          },
          {
            resource: 'BOOKMARK',
            type: 'DELETE',
            resourceId: 'unsupported-1',
            timestamp: 8103,
          },
          {
            resource: 'BOOKMARK',
            type: 'UPDATE',
            resourceId: 'keep',
            timestamp: 8104,
            data: {type: 'page', key: 10, verseNumber: null},
          },
          {
            resource: 'BOOKMARK',
            type: 'UPDATE',
            resourceId: 'keep',
            timestamp: 8104,
            data: {
              type: 'ayah',
              key: 2,
              verseNumber: 254,
              isInDefaultCollection: true,
            },
          },
          {
            resource: 'BOOKMARK',
            type: 'UPDATE',
            resourceId: 'keep',
            timestamp: 8105,
            data: {type: 'ayah', key: 2, verseNumber: 256},
          },
          {
            resource: 'BOOKMARK',
            type: 'UPDATE',
            resourceId: 'keep',
            timestamp: 7000,
            data: {type: 'ayah', key: 2, verseNumber: 254},
          },
          {
            resource: 'NOTE',
            type: 'CREATE',
            resourceId: 'private',
            timestamp: 8106,
            data: {body: 'neighbor', ranges: ['2:255-2:255'], saveToQR: false},
          },
          {
            resource: 'READING_SESSION',
            type: 'UPDATE',
            resourceId: 'reading',
            timestamp: 8107,
            data: {chapterNumber: 3, verseNumber: 7},
          },
        );
      const calls: Array<{
        page: number | null;
        metadata: boolean;
        since: number;
      }> = [];
      let metadataChecks = 0;
      const fetchImpl = jest.fn(async (input: string, init: RequestInit) => {
        expect(init.method).toBe('GET');
        const url = new URL(input);
        const metadata = url.searchParams.get('metadataOnly') === 'true';
        const page = Number(url.searchParams.get('page'));
        const limit = Number(url.searchParams.get('limit'));
        calls.push({
          page: metadata ? null : page,
          metadata,
          since: Number(url.searchParams.get('mutationsSince')),
        });
        // No cursor advance before a matching metadata recheck, even on replay.
        expect(await sync.getStoredHead(accountId)).toBe(7001);
        const head =
          mode === 'changing-head' && metadataChecks > 0 ? 9000 : 8999;
        if (metadata) metadataChecks += 1;
        const data = metadata
          ? {lastMutationAt: mode === 'changing-head' ? 9000 : head}
          : {
              lastMutationAt: head,
              mutations: mutations.slice((page - 1) * limit, page * limit),
              page,
              limit,
              total: mutations.length,
              hasMore: page * limit < mutations.length,
            };
        const bytes = new TextEncoder().encode(
          JSON.stringify({success: true, data}),
        );
        return {
          ok: true,
          status: 200,
          headers: new Headers({'content-length': String(bytes.length)}),
          body: new ReadableStream({
            start(c) {
              c.enqueue(bytes);
              c.close();
            },
          }),
        } as Response;
      });
      const coordinator = new IntegratedCoordinator({
        transport: new BayaanSyncApiClient({
          apiUrl: 'https://dummy.test',
          fetchImpl,
        }),
        store,
        pushStore: sync,
        sleep: async () => undefined,
      });
      await expect(
        coordinator.pull({accountId, sessionToken: 'dummy-a'}),
      ).resolves.toMatchObject({
        status: 'synced',
        head: mode === 'changing-head' ? 9000 : 8999,
        restarts: mode === 'changing-head' ? 1 : 0,
      });
      expect(calls.map(call => call.page)).toEqual(
        mode === 'changing-head'
          ? [1, 2, null, 1, 2, null]
          : mode === 'single-page'
            ? [1, null]
            : [1, 2, null],
      );
      expect(calls.every(call => call.since === 7001)).toBe(true);
      const db = await database.getConnection();
      expect(
        await db.getAllAsync(
          "SELECT remote_id, verse_key FROM bookmarks WHERE owner_scope = 'qf:reader-a'",
        ),
      ).toEqual([
        {
          remote_id: 'keep',
          verse_key: mode === 'unsupported-only' ? '2:255' : '2:256',
        },
      ]);
      expect(
        await db.getAllAsync(
          "SELECT content FROM notes WHERE owner_scope = 'qf:reader-a'",
        ),
      ).toEqual(mode === 'unsupported-only' ? [] : [{content: 'neighbor'}]);
      expect(
        await db.getAllAsync(
          "SELECT verse_key FROM qf_reading_locations WHERE owner_scope = 'qf:reader-a'",
        ),
      ).toEqual(mode === 'unsupported-only' ? [] : [{verse_key: '3:7'}]);
      expect(await sync.getOutboxEntries(accountId)).toEqual([]);
      expect(await sync.getOutboxEntries('reader-b')).toEqual(beforeB);
      expect(await sync.getStoredHead('reader-b')).toBe(9001);
      await expect(
        coordinator.push({accountId, sessionToken: 'dummy-a'}),
      ).resolves.toMatchObject({status: 'idle'});
      expect(
        fetchImpl.mock.calls.every(([, init]) => init.method === 'GET'),
      ).toBe(true);
      await database.close();
    },
  );

  it.each(['plain', 'escaped'] as const)(
    'restarts oversized %s note pages at a smaller limit and reaches the SQLite head',
    async encoding => {
      const {database, sync, SqliteQfSyncPullStore, IntegratedCoordinator} =
        await createServices(`bytes-${encoding}.db`);
      const {
        BayaanSyncApiClient,
      } = require('@/services/sync/bayaanSyncApiClient');
      await sync.initialize();
      const store = new SqliteQfSyncPullStore(database);
      await store.commitStableHead('reader-b', 0, 9001, 1000);
      // Both controls require six JSON bytes; avoid NUL because the test
      // adapter reads TEXT through a null-terminated WASM string conversion.
      const body = (encoding === 'plain' ? 'a' : '\u0001').repeat(200_000);
      const mutations = Array.from({length: 12}, (_, index) => ({
        resource: 'NOTE',
        type: 'CREATE',
        resourceId: `note-${index}`,
        timestamp: 100 + index,
        data: {body, ranges: ['2:255-2:255'], saveToQR: false},
      }));
      const limits: number[] = [];
      const fetchImpl = jest.fn(async (input: string, init: RequestInit) => {
        expect(init.method).toBe('GET');
        const url = new URL(input);
        const metadata = url.searchParams.get('metadataOnly') === 'true';
        const page = Number(url.searchParams.get('page'));
        const limit = Number(url.searchParams.get('limit'));
        if (!metadata) limits.push(limit);
        expect(await sync.getStoredHead(accountId)).toBe(0);
        const data = metadata
          ? {lastMutationAt: 200}
          : {
              lastMutationAt: 200,
              mutations: mutations.slice((page - 1) * limit, page * limit),
              page,
              limit,
              total: mutations.length,
              hasMore: page * limit < mutations.length,
            };
        const bytes = new TextEncoder().encode(
          JSON.stringify({success: true, data}),
        );
        return {
          ok: true,
          status: 200,
          headers: new Headers({'content-length': String(bytes.length)}),
          body: new ReadableStream({
            start(c) {
              c.enqueue(bytes);
              c.close();
            },
          }),
        } as Response;
      });
      const coordinator = new IntegratedCoordinator({
        transport: new BayaanSyncApiClient({
          apiUrl: 'https://dummy.test',
          fetchImpl,
        }),
        store,
        pushStore: sync,
      });
      await expect(
        coordinator.pull({accountId, sessionToken: 'dummy-a'}),
      ).resolves.toMatchObject({status: 'synced', head: 200});
      expect(limits[0]).toBe(1000);
      expect(limits.at(-1)).toBe(encoding === 'plain' ? 7 : 1);
      const db = await database.getConnection();
      expect(
        await db.getFirstAsync(
          "SELECT COUNT(*) AS count FROM notes WHERE owner_scope = 'qf:reader-a'",
        ),
      ).toEqual({count: 12});
      expect(
        await db.getFirstAsync(
          "SELECT content FROM notes WHERE owner_scope = 'qf:reader-a' AND remote_id = 'note-0'",
        ),
      ).toEqual({content: body});
      expect(await sync.getStoredHead('reader-b')).toBe(9001);
      expect(await sync.getOutboxEntries(accountId)).toEqual([]);
      await database.close();
    },
  );

  it.each(['declared', 'stream'] as const)(
    'recovers a BFF GET 502 %s size marker after partial SQLite application and restarts from the uncommitted head',
    async sizeMode => {
      const {database, sync, SqliteQfSyncPullStore, IntegratedCoordinator} =
        await createServices(`bff-size-${sizeMode}.db`);
      const {
        BayaanSyncApiClient,
      } = require('@/services/sync/bayaanSyncApiClient');
      await sync.initialize();
      const store = new SqliteQfSyncPullStore(database);
      await store.commitStableHead(accountId, 0, 7001, 1000);
      await store.commitStableHead('reader-b', 0, 9001, 1000);
      await sync.addNote({
        accountId: 'reader-b',
        verseKey: '3:1',
        surahNumber: 3,
        ayahNumber: 1,
        content: 'private-b',
      });
      const beforeB = await sync.getOutboxEntries('reader-b');
      const body = '\u0001'.repeat(200_000);
      const mutations = [
        {
          resource: 'BOOKMARK',
          type: 'CREATE',
          resourceId: 'neighbor',
          timestamp: 7002,
          data: {type: 'ayah', key: 2, verseNumber: 255},
        },
        ...Array.from({length: 6}, (_, index) => ({
          resource: 'BOOKMARK',
          type: 'CREATE',
          resourceId: `unsupported-${index}`,
          timestamp: 7003 + index,
          data: {
            type: ['page', 'juz', 'surah'][index % 3],
            key: 10,
            verseNumber: null,
          },
        })),
        ...Array.from({length: 3}, (_, index) => ({
          resource: 'NOTE',
          type: 'CREATE',
          resourceId: `large-${index}`,
          timestamp: 7010 + index,
          data: {body, ranges: ['2:255-2:255'], saveToQR: false},
        })),
      ];
      const calls: Array<{
        page: number;
        limit: number;
        metadata: boolean;
        since: number;
      }> = [];
      const sizesRejected: Array<{page: number; limit: number}> = [];
      let appliedBeforeSizeError = false;
      let metadataChecks = 0;
      const fetchImpl = jest.fn(async (input: string, init: RequestInit) => {
        expect(init.method).toBe('GET');
        const url = new URL(input);
        const metadata = url.searchParams.get('metadataOnly') === 'true';
        const page = Number(url.searchParams.get('page'));
        const limit = Number(url.searchParams.get('limit'));
        calls.push({
          page,
          limit,
          metadata,
          since: Number(url.searchParams.get('mutationsSince')),
        });
        expect(await sync.getStoredHead(accountId)).toBe(7001);
        expect(await sync.getStoredHead('reader-b')).toBe(9001);
        const head = metadataChecks ? 9000 : 8999;
        if (metadata) metadataChecks += 1;
        const data = metadata
          ? {lastMutationAt: 9000}
          : {
              lastMutationAt: head,
              mutations: mutations.slice((page - 1) * limit, page * limit),
              page,
              limit,
              total: mutations.length,
              hasMore: page * limit < mutations.length,
            };
        const encoded = new TextEncoder().encode(
          JSON.stringify({success: true, data}),
        );
        // Dummy BFF contract: either declared or streamed upstream bytes cross
        // the GET-only 2 MiB bound, producing the same small typed 502 envelope.
        const oversized =
          sizeMode === 'declared'
            ? encoded.length > 2 * 1024 * 1024
            : [encoded.slice(0, 512), encoded.slice(512)].reduce(
                (sum, chunk) => sum + chunk.length,
                0,
              ) >
              2 * 1024 * 1024;
        if (oversized) {
          sizesRejected.push({page, limit});
          const db = await database.getConnection();
          appliedBeforeSizeError ||=
            (await db.getFirstAsync(
              "SELECT remote_id FROM bookmarks WHERE owner_scope = 'qf:reader-a'",
            )) !== null;
          return new Response(
            JSON.stringify({
              error: {
                code: 'QF_SYNC_RESPONSE_TOO_LARGE',
                message: 'Provider page exceeded the GET response bound',
              },
            }),
            {status: 502, headers: {'content-type': 'application/json'}},
          );
        }
        return new Response(encoded, {
          status: 200,
          headers: {'content-length': String(encoded.length)},
        });
      });
      const coordinator = new IntegratedCoordinator({
        transport: new BayaanSyncApiClient({
          apiUrl: 'https://dummy.test',
          fetchImpl,
        }),
        store,
        pushStore: sync,
        sleep: async () => undefined,
      });
      await expect(
        coordinator.pull({accountId, sessionToken: 'dummy-a'}),
      ).resolves.toMatchObject({status: 'synced', head: 9000, restarts: 1});
      expect(appliedBeforeSizeError).toBe(true);
      expect(sizesRejected).toContainEqual({limit: 7, page: 2});
      const pages = calls.filter(call => !call.metadata);
      for (let index = 1; index < pages.length; index += 1)
        if (pages[index].limit !== pages[index - 1].limit)
          expect(pages[index].page).toBe(1);
      expect(pages.at(-1)?.limit).toBe(1);
      expect(calls.every(call => call.since === 7001)).toBe(true);
      expect(metadataChecks).toBe(2);
      const db = await database.getConnection();
      expect(
        await db.getAllAsync(
          "SELECT remote_id FROM bookmarks WHERE owner_scope = 'qf:reader-a'",
        ),
      ).toEqual([{remote_id: 'neighbor'}]);
      expect(
        await db.getFirstAsync(
          "SELECT COUNT(*) AS count FROM notes WHERE owner_scope = 'qf:reader-a'",
        ),
      ).toEqual({count: 3});
      expect(
        await db.getFirstAsync(
          "SELECT content FROM notes WHERE owner_scope = 'qf:reader-a' AND remote_id = 'large-0'",
        ),
      ).toEqual({content: body});
      expect(await sync.getOutboxEntries(accountId)).toEqual([]);
      expect(await sync.getOutboxEntries('reader-b')).toEqual(beforeB);
      expect(await sync.getStoredHead('reader-b')).toBe(9001);
      await expect(
        coordinator.push({accountId, sessionToken: 'dummy-a'}),
      ).resolves.toMatchObject({status: 'idle'});
      expect(
        fetchImpl.mock.calls.every(([, init]) => init.method === 'GET'),
      ).toBe(true);
      await database.close();
    },
  );

  it.each([
    ['generic', 502, {error: {code: 'QF_SYNC_UPSTREAM_ERROR'}}],
    ['invalid-upstream', 502, {error: {code: 'QF_SYNC_INVALID_RESPONSE'}}],
    ['wrong-status', 503, {error: {code: 'QF_SYNC_RESPONSE_TOO_LARGE'}}],
    ['wrong-shape', 502, {code: 'QF_SYNC_RESPONSE_TOO_LARGE'}],
    [
      'private-extra',
      502,
      {error: {code: 'QF_SYNC_RESPONSE_TOO_LARGE', private: 'never-log'}},
    ],
    ['invalid-json', 502, '{not-json'],
    [
      'invalid-ayah',
      200,
      {
        success: true,
        data: {
          lastMutationAt: 7002,
          mutations: [
            {
              resource: 'BOOKMARK',
              type: 'CREATE',
              resourceId: 'invalid',
              timestamp: 7002,
              data: {type: 'ayah', key: 2, verseNumber: null},
            },
          ],
          page: 1,
          limit: 1000,
          total: 1,
          hasMore: false,
        },
      },
    ],
  ])(
    'does not shrink the pull limit for %s BFF responses',
    async (name, status, body) => {
      const {database, sync, SqliteQfSyncPullStore, IntegratedCoordinator} =
        await createServices(`non-size-${name}.db`);
      const {
        BayaanSyncApiClient,
      } = require('@/services/sync/bayaanSyncApiClient');
      await sync.initialize();
      const fetchImpl = jest.fn(
        async () =>
          new Response(typeof body === 'string' ? body : JSON.stringify(body), {
            status: Number(status),
          }),
      );
      const coordinator = new IntegratedCoordinator({
        transport: new BayaanSyncApiClient({
          apiUrl: 'https://dummy.test',
          fetchImpl,
        }),
        store: new SqliteQfSyncPullStore(database),
      });
      await expect(
        coordinator.pull({accountId, sessionToken: 'dummy-a'}),
      ).rejects.toMatchObject({
        code: status === 200 ? 'invalid_response' : 'service_unavailable',
      });
      expect(fetchImpl).toHaveBeenCalledTimes(1);
      expect(await sync.getStoredHead(accountId)).toBe(0);
      await database.close();
    },
  );

  it.each(['PENDING', 'IN_FLIGHT', 'AMBIGUOUS'] as const)(
    'does not resurrect a locally deleted note while its %s tombstone owns the remote identity',
    async state => {
      const {database, sync, SqliteQfSyncPullStore, IntegratedCoordinator} =
        await createServices(`note-delete-pull-${state}.db`);
      const {
        BayaanSyncApiClient,
      } = require('@/services/sync/bayaanSyncApiClient');
      await sync.initialize();
      const store = new SqliteQfSyncPullStore(database);
      const note = await createRemoteBackedNote(sync, 'delete locally');
      await sync.deleteNote({accountId, noteId: note.id});
      if (state !== 'PENDING') {
        const [entry] = await sync.getOutboxEntries(accountId);
        await sync.markOperationInFlight({
          accountId,
          localOperationId: entry.localOperationId,
          startedAt: 7001,
        });
        if (state === 'AMBIGUOUS') {
          const db = await database.getConnection();
          await db.runAsync(
            "UPDATE qf_sync_outbox SET delivery_state = 'AMBIGUOUS' WHERE owner_scope = 'qf:reader-a'",
          );
        }
      }
      const before = await sync.getOutboxEntries(accountId);
      const fetchImpl = async (input: string) => {
        const url = new URL(input);
        const data =
          url.searchParams.get('metadataOnly') === 'true'
            ? {lastMutationAt: 7002}
            : {
                lastMutationAt: 7002,
                mutations: [
                  {
                    resource: 'NOTE',
                    type: 'UPDATE',
                    resourceId: 'remote-note-1',
                    timestamp: 7002,
                    data: {
                      body: 'other device update',
                      ranges: ['2:255-2:255'],
                      saveToQR: false,
                    },
                  },
                ],
                page: 1,
                limit: 1000,
                total: 1,
                hasMore: false,
              };
        const bytes = new TextEncoder().encode(
          JSON.stringify({success: true, data}),
        );
        return {
          ok: true,
          status: 200,
          headers: new Headers({'content-length': String(bytes.length)}),
          body: new ReadableStream({
            start(c) {
              c.enqueue(bytes);
              c.close();
            },
          }),
        } as Response;
      };
      const coordinator = new IntegratedCoordinator({
        transport: new BayaanSyncApiClient({
          apiUrl: 'https://dummy.test',
          fetchImpl,
        }),
        store,
      });
      await expect(
        coordinator.pull({accountId, sessionToken: 'dummy-a'}),
      ).resolves.toMatchObject({status: 'synced'});
      const db = await database.getConnection();
      expect(
        await db.getAllAsync(
          "SELECT * FROM notes WHERE owner_scope = 'qf:reader-a'",
        ),
      ).toEqual([]);
      expect(await sync.getOutboxEntries(accountId)).toEqual(before);
      // The same remote ID in B is not hidden by A's delete.
      await store.applyPage('reader-b', [
        {
          resource: 'NOTE',
          type: 'UPDATE',
          resourceId: 'remote-note-1',
          timestamp: 7002,
          data: {body: 'private-b', ranges: ['2:255-2:255'], saveToQR: false},
        },
      ]);
      expect(
        await db.getAllAsync(
          "SELECT content FROM notes WHERE owner_scope = 'qf:reader-b'",
        ),
      ).toEqual([{content: 'private-b'}]);
      await database.close();
    },
  );
  it.each([
    403,
    429,
    502,
    'head-only',
    'duplicate-identities',
    'oversized',
    'post-size-marker',
  ] as const)(
    'real wire %s cannot partially acknowledge a SQLite note batch or mutate another account',
    async fault => {
      const {database, sync, SqliteQfSyncPullStore, IntegratedCoordinator} =
        await createServices(`wire-${fault}.db`);
      const {
        BayaanSyncApiClient,
      } = require('@/services/sync/bayaanSyncApiClient');
      await sync.initialize();
      const store = new SqliteQfSyncPullStore(database);
      await store.commitStableHead(accountId, 0, 7001, 1000);
      await store.commitStableHead('reader-b', 0, 9001, 1000);
      for (const content of ['one', 'two'])
        await sync.addNote({
          accountId,
          verseKey: '2:255',
          surahNumber: 2,
          ayahNumber: 255,
          content,
        });
      await sync.addNote({
        accountId: 'reader-b',
        verseKey: '3:1',
        surahNumber: 3,
        ayahNumber: 1,
        content: 'private-b',
      });
      const before = await sync.getOutboxEntries('reader-b');
      const fetchImpl = async (input: string, init: RequestInit) => {
        const url = new URL(input);
        let status = 200;
        let body: unknown;
        if (init.method === 'POST') {
          if (fault === 'oversized') {
            return new Response(null, {
              status: 200,
              headers: {'content-length': String(2 * 1024 * 1024 + 1)},
            });
          }
          if (
            typeof fault === 'number' ||
            fault === 'duplicate-identities' ||
            fault === 'post-size-marker'
          ) {
            status = typeof fault === 'number' ? fault : 502;
            body = {
              error: {
                code:
                  fault === 403
                    ? 'QF_SYNC_FORBIDDEN'
                    : fault === 'post-size-marker'
                      ? 'QF_SYNC_RESPONSE_TOO_LARGE'
                      : 'QF_SYNC_UPSTREAM_ERROR',
              },
            };
          } else {
            const requests = JSON.parse(String(init.body)).mutations;
            body = {
              success: true,
              data: {
                lastMutationAt: 7002,
                mutations:
                  fault === 'head-only'
                    ? []
                    : requests.map((mutation: BayaanSyncMutation) => ({
                        ...mutation,
                        resourceId: 'duplicate-note-id',
                        timestamp: 7002,
                      })),
              },
            };
          }
        } else
          body = {
            success: true,
            data:
              url.searchParams.get('metadataOnly') === 'true'
                ? {lastMutationAt: 7001}
                : {
                    lastMutationAt: 7001,
                    mutations: [],
                    page: 1,
                    limit: 1000,
                    total: 0,
                    hasMore: false,
                  },
          };
        const bytes = new TextEncoder().encode(JSON.stringify(body));
        return {
          ok: status === 200,
          status,
          headers: new Headers({
            'content-length': String(bytes.length),
            'retry-after': '120',
          }),
          body: new ReadableStream({
            start(c) {
              c.enqueue(bytes);
              c.close();
            },
          }),
        } as Response;
      };
      const coordinator = new IntegratedCoordinator({
        transport: new BayaanSyncApiClient({
          apiUrl: 'https://dummy.test',
          fetchImpl,
        }),
        store,
        pushStore: sync,
      });
      if (fault === 403 || fault === 429)
        await expect(
          coordinator.push({accountId, sessionToken: 'dummy-a'}),
        ).rejects.toMatchObject({
          code: fault === 429 ? 'rate_limited' : 'request_failed',
          status: fault,
          ...(fault === 429 ? {retryAfterMs: 120_000} : {}),
        });
      else
        await expect(
          coordinator.push({accountId, sessionToken: 'dummy-a'}),
        ).resolves.toMatchObject({
          status: 'recovered',
          acknowledged: 0,
          ambiguous: 2,
        });
      expect(await sync.getStoredHead(accountId)).toBe(7001);
      const outbox = await sync.getOutboxEntries(accountId);
      expect(outbox).toHaveLength(2);
      expect(
        outbox.every(
          (entry: QfOutboxEntry) =>
            entry.deliveryState ===
            (fault === 403 || fault === 429 ? 'PENDING' : 'AMBIGUOUS'),
        ),
      ).toBe(true);
      expect(await sync.getOutboxEntries('reader-b')).toEqual(before);
      expect(await sync.getStoredHead('reader-b')).toBe(9001);
      await database.close();
    },
  );

  it.each(['NOTE', 'BOOKMARK', 'UNKNOWN', 'CONFLICTING'] as const)(
    'rejects a malformed %s page through the real codec without advancing either SQLite account cursor',
    async resource => {
      const {database, sync, SqliteQfSyncPullStore, IntegratedCoordinator} =
        await createServices('poisoned-page.db');
      const {
        BayaanSyncApiClient,
      } = require('@/services/sync/bayaanSyncApiClient');
      await sync.initialize();
      const store = new SqliteQfSyncPullStore(database);
      await store.commitStableHead(accountId, 0, 7001, 1000);
      await store.commitStableHead('reader-b', 0, 9001, 1000);
      const bytes = new TextEncoder().encode(
        JSON.stringify({
          success: true,
          data: {
            lastMutationAt: 7002,
            mutations: [
              {
                resource: 'BOOKMARK',
                type: 'CREATE',
                resourceId: 'valid-neighbor',
                timestamp: 7002,
                data: {type: 'ayah', key: 2, verseNumber: 255},
              },
              {
                resource: resource === 'NOTE' ? 'NOTE' : 'BOOKMARK',
                type: 'CREATE',
                resourceId: 'poison',
                timestamp: 7002,
                data:
                  resource === 'NOTE'
                    ? {body: 'private', ranges: [], saveToQR: false}
                    : resource === 'UNKNOWN'
                      ? {type: 'unknownType', key: 10, verseNumber: null}
                      : resource === 'CONFLICTING'
                        ? {
                            type: 'page',
                            bookmarkType: 'ayah',
                            key: 10,
                            verseNumber: null,
                          }
                        : {type: 'ayah', key: 10, verseNumber: null},
              },
            ],
            page: 1,
            limit: 1000,
            total: 1,
            hasMore: false,
          },
        }),
      );
      const fetchImpl = async () =>
        ({
          ok: true,
          status: 200,
          headers: new Headers({'content-length': String(bytes.length)}),
          body: new ReadableStream({
            start(c) {
              c.enqueue(bytes);
              c.close();
            },
          }),
        }) as Response;
      const coordinator = new IntegratedCoordinator({
        transport: new BayaanSyncApiClient({
          apiUrl: 'https://dummy.test',
          fetchImpl,
        }),
        store,
        pushStore: sync,
      });
      await expect(
        coordinator.pull({accountId, sessionToken: 'dummy-a'}),
      ).rejects.toMatchObject({code: 'invalid_response'});
      expect(await sync.getStoredHead(accountId)).toBe(7001);
      expect(await sync.getStoredHead('reader-b')).toBe(9001);
      expect(await sync.getOutboxEntries(accountId)).toEqual([]);
      const db = await database.getConnection();
      expect(await db.getAllAsync('SELECT * FROM notes')).toEqual([]);
      expect(await db.getAllAsync('SELECT * FROM bookmarks')).toEqual([]);
      await database.close();
    },
  );

  it('converges two SQLite devices through the real API codec with offline edits, reconnect and a separate dummy account', async () => {
    const a = await createServices('device-a-connected.db');
    const b = await createServices('device-b-connected.db');
    const {
      BayaanSyncApiClient,
    } = require('@/services/sync/bayaanSyncApiClient');
    await a.sync.initialize();
    await b.sync.initialize();
    const heads = new Map([
      ['reader-a', 7001],
      ['reader-b', 7001],
    ]);
    const log = new Map<string, BayaanSyncMutation[]>([
      ['reader-a', []],
      ['reader-b', []],
    ]);
    const posts: Array<{account: string; mutations: BayaanSyncMutation[]}> = [];
    const fetchImpl = async (input: string, init: RequestInit) => {
      const url = new URL(input);
      const account =
        new Headers(init.headers).get('Authorization') === 'Bearer dummy-b'
          ? 'reader-b'
          : 'reader-a';
      const history = log.get(account)!;
      let head = heads.get(account)!;
      let data: Record<string, unknown>;
      if (init.method === 'POST') {
        expect(Number(url.searchParams.get('lastMutationAt'))).toBe(head);
        const body = JSON.parse(String(init.body));
        const mutations = body.mutations.map(
          (mutation: BayaanSyncMutation) => ({
            ...mutation,
            resourceId: mutation.resourceId ?? `${account}-reading`,
            timestamp: ++head,
          }),
        );
        history.push(...mutations);
        heads.set(account, head);
        posts.push({account, mutations});
        data = {lastMutationAt: head, mutations};
      } else {
        const mutations = history.filter(
          mutation =>
            mutation.timestamp > Number(url.searchParams.get('mutationsSince')),
        );
        data =
          url.searchParams.get('metadataOnly') === 'true'
            ? {lastMutationAt: head}
            : {
                lastMutationAt: head,
                mutations,
                page: 1,
                limit: 1000,
                total: mutations.length,
                hasMore: false,
              };
      }
      const bytes = new TextEncoder().encode(
        JSON.stringify({success: true, data}),
      );
      return {
        ok: true,
        status: 200,
        headers: new Headers({'content-length': String(bytes.length)}),
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(bytes);
            controller.close();
          },
        }),
      } as Response;
    };
    const makeCoordinator = (device: typeof a) =>
      new device.IntegratedCoordinator({
        transport: new BayaanSyncApiClient({
          apiUrl: 'https://dummy.test',
          fetchImpl,
        }),
        store: new device.SqliteQfSyncPullStore(device.database),
        pushStore: device.sync,
      });
    const ca = makeCoordinator(a);
    const cb = makeCoordinator(b);
    const input = {accountId, sessionToken: 'dummy-a'};
    await a.sync.upsertReadingLocation({
      accountId,
      verseKey: '3:1',
      surahNumber: 3,
      ayahNumber: 1,
      lastReadAt: 1000,
    });
    await ca.pull(input);
    await ca.push(input);
    await cb.pull(input);
    // Both devices go offline. B's older intent must not revert A on reconnect.
    await b.sync.upsertReadingLocation({
      accountId,
      verseKey: '3:2',
      surahNumber: 3,
      ayahNumber: 2,
      lastReadAt: 2000,
    });
    await a.sync.upsertReadingLocation({
      accountId,
      verseKey: '3:3',
      surahNumber: 3,
      ayahNumber: 3,
      lastReadAt: 3000,
    });
    await ca.pull(input);
    await ca.push(input);
    await cb.pull(input);
    await cb.push(input);
    expect(posts.filter(item => item.account === accountId)).toHaveLength(2);
    expect(await b.sync.getLatestReadingLocation(accountId)).toMatchObject({
      verseKey: '3:3',
      lastReadAt: 3000,
    });
    expect(await b.sync.getOutboxEntries(accountId)).toEqual([]);
    // Reverse the device winner to check the reciprocal path and later pull.
    await a.sync.upsertReadingLocation({
      accountId,
      verseKey: '3:4',
      surahNumber: 3,
      ayahNumber: 4,
      lastReadAt: 4000,
    });
    await b.sync.upsertReadingLocation({
      accountId,
      verseKey: '3:5',
      surahNumber: 3,
      ayahNumber: 5,
      lastReadAt: 5000,
    });
    await cb.pull(input);
    await cb.push(input);
    await ca.pull(input);
    await ca.push(input);
    expect(posts.filter(item => item.account === accountId)).toHaveLength(3);
    for (const device of [a, b]) {
      expect(
        await device.sync.getLatestReadingLocation(accountId),
      ).toMatchObject({verseKey: '3:5', lastReadAt: 5000});
      expect(await device.sync.getOutboxEntries(accountId)).toEqual([]);
      expect(await device.sync.getStoredHead(accountId)).toBe(
        heads.get(accountId),
      );
    }
    await b.sync.upsertReadingLocation({
      accountId: 'reader-b',
      verseKey: '4:1',
      surahNumber: 4,
      ayahNumber: 1,
      lastReadAt: 6000,
    });
    await cb.pull({accountId: 'reader-b', sessionToken: 'dummy-b'});
    await cb.push({accountId: 'reader-b', sessionToken: 'dummy-b'});
    expect(await b.sync.getLatestReadingLocation(accountId)).toMatchObject({
      verseKey: '3:5',
    });
    expect(await a.sync.getLatestReadingLocation('reader-b')).toBeNull();
    expect(posts[3].account).toBe('reader-b');
    await a.database.close();
    await b.database.close();
  });

  it.each(
    [false, true].flatMap(remoteBacked =>
      ['PENDING', 'IN_FLIGHT', 'AMBIGUOUS'].flatMap(delivery =>
        [1000, 2000, 3000].map(remoteTime => ({
          remoteBacked,
          delivery,
          remoteTime,
        })),
      ),
    ),
  )(
    'reconciles durable reading intent through pull -> recovery -> push: %j',
    async ({remoteBacked, delivery, remoteTime}) => {
      const {database, sync, IntegratedCoordinator, SqliteQfSyncPullStore} =
        await createServices(
          `reading-intent-${remoteBacked}-${delivery}-${remoteTime}.db`,
        );
      await sync.initialize();
      await seedHead(database, 7001);
      await sync.upsertReadingLocation({
        accountId,
        verseKey: '3:7',
        surahNumber: 3,
        ayahNumber: 7,
        lastReadAt: 500,
      });
      if (remoteBacked) {
        const [create] = await sync.getOutboxEntries(accountId);
        await sync.markOperationInFlight({
          accountId,
          localOperationId: create.localOperationId,
          startedAt: 7000,
        });
        await sync.acknowledgeOperation({
          accountId,
          localOperationId: create.localOperationId,
          resourceId: 'remote-reading',
          serverUpdatedAt: 7000,
        });
      }
      await sync.upsertReadingLocation({
        accountId,
        verseKey: '3:8',
        surahNumber: 3,
        ayahNumber: 8,
        lastReadAt: 2000,
      });
      // Another account on this device must not have its intent or cursor touched.
      await sync.upsertReadingLocation({
        accountId: 'reader-b',
        verseKey: '4:1',
        surahNumber: 4,
        ayahNumber: 1,
        lastReadAt: 2500,
      });
      const foreign = await sync.getOutboxEntries('reader-b');
      const [queued] = await sync.getOutboxEntries(accountId);
      if (delivery !== 'PENDING') {
        await sync.markOperationInFlight({
          accountId,
          localOperationId: queued.localOperationId,
          startedAt: 7001,
        });
        if (delivery === 'AMBIGUOUS') {
          const db = await database.getConnection();
          await db.runAsync(
            `UPDATE qf_sync_outbox SET delivery_state = 'AMBIGUOUS' WHERE local_operation_id = ?`,
            [queued.localOperationId],
          );
        }
      }
      let cloud: BayaanSyncMutation = {
        resource: 'READING_SESSION',
        type: 'UPDATE',
        resourceId: 'remote-reading',
        timestamp: 7002,
        data: {
          chapterNumber: 3,
          verseNumber: 9,
          clientCreatedAt: new Date(500).toISOString(),
          clientUpdatedAt: new Date(remoteTime).toISOString(),
        },
      };
      const requests: BayaanSyncPushRequest[] = [];
      const transport = {
        pull: async (
          _token: string,
          request: {metadataOnly?: boolean},
        ): Promise<BayaanSyncPullPage> =>
          request.metadataOnly
            ? {lastMutationAt: cloud.timestamp, mutations: []}
            : {
                lastMutationAt: cloud.timestamp,
                mutations: [cloud],
                page: 1,
                limit: 1000,
                total: 1,
                hasMore: false,
              },
        push: async (
          _token: string,
          request: BayaanSyncPushRequest,
        ): Promise<BayaanSyncPushResult> => {
          requests.push(request);
          expect(request.mutations[0].type).toBe('UPDATE');
          cloud = {
            ...request.mutations[0],
            resourceId: 'remote-reading',
            timestamp: 7003,
          };
          return {lastMutationAt: 7003, mutations: [cloud]};
        },
      };
      const coordinator = new IntegratedCoordinator({
        transport,
        store: new SqliteQfSyncPullStore(database),
        pushStore: sync,
        now: () => 8001,
      });
      await coordinator.pull({accountId, sessionToken});
      if (delivery !== 'PENDING') {
        const [uncertain] = await sync.getOutboxEntries(accountId);
        expect(uncertain.deliveryState).toBe(delivery);
        expect(uncertain.inFlightPayloadJson).toBe(queued.payloadJson);
      }
      await coordinator.push({accountId, sessionToken});
      // A recovered immutable revision can leave current intent ready to push.
      if (
        (await sync.getOutboxEntries(accountId)).some(
          (entry: QfOutboxEntry) => entry.deliveryState === 'PENDING',
        )
      ) {
        await coordinator.push({accountId, sessionToken});
      }
      expect(requests).toHaveLength(remoteTime < 2000 ? 1 : 0);
      expect(cloud.data?.verseNumber).toBe(remoteTime < 2000 ? 8 : 9);
      expect(Date.parse(String(cloud.data?.clientUpdatedAt))).toBe(
        Math.max(2000, remoteTime),
      );
      expect(await sync.getOutboxEntries(accountId)).toEqual([]);
      expect(await sync.getOutboxEntries('reader-b')).toEqual(foreign);
      expect(await sync.getStoredHead('reader-b')).toBe(0);
      expect(await sync.getLatestReadingLocation(accountId)).toMatchObject({
        verseKey: remoteTime < 2000 ? '3:8' : '3:9',
        lastReadAt: Math.max(2000, remoteTime),
      });
      await database.close();
    },
  );

  it('drains a newer pending revision after restart recovery without another external trigger', async () => {
    const databaseName = 'lifecycle-restart-newer-bookmark-delete.db';
    let services = await createServices(databaseName);
    await services.sync.initialize();
    await seedHead(services.database, 7001);
    await services.sync.addBookmark({
      accountId,
      verseKey: '2:255',
      surahNumber: 2,
      ayahNumber: 255,
    });
    const [created] = await services.sync.getOutboxEntries(accountId);
    await services.sync.markOperationInFlight({
      accountId,
      localOperationId: created.localOperationId,
      startedAt: 7001,
    });
    await services.sync.removeBookmark({accountId, verseKey: '2:255'});
    await services.database.close();

    services = await createServices(databaseName);
    await services.sync.initialize();
    const pushRequests: BayaanSyncPushRequest[] = [];
    const transport = {
      pull: async (
        _token: string,
        request: {metadataOnly?: boolean},
      ): Promise<BayaanSyncPullPage> =>
        request.metadataOnly
          ? {lastMutationAt: 7002, mutations: []}
          : {
              lastMutationAt: 7002,
              mutations: [
                {
                  resource: 'BOOKMARK',
                  type: 'CREATE',
                  resourceId: 'remote-bookmark-1',
                  timestamp: 7002,
                  data: {key: 2, verseNumber: 255},
                },
              ],
              page: 1,
              limit: 1000,
              total: 1,
              hasMore: false,
            },
      push: async (
        _token: string,
        request: BayaanSyncPushRequest,
      ): Promise<BayaanSyncPushResult> => {
        pushRequests.push(request);
        return {
          lastMutationAt: 7003,
          mutations: request.mutations.map(mutation => {
            if (!mutation.resourceId) {
              throw new Error('expected a remote-backed delete');
            }
            return {
              resource: mutation.resource,
              type: mutation.type,
              resourceId: mutation.resourceId,
              timestamp: 7003,
            };
          }),
        };
      },
    };
    const coordinator = new services.IntegratedCoordinator({
      transport,
      store: new services.SqliteQfSyncPullStore(services.database),
      pushStore: services.sync,
      now: () => 8001,
    });
    const {QfSyncLifecycle} = require('@/services/sync/qfSyncLifecycle');
    const {useQfSyncStore} = require('@/store/qfSyncStore');
    useQfSyncStore.getState().resetForTesting();
    const lifecycle = new QfSyncLifecycle({
      enabled: true,
      coordinator,
      guestImportService: {
        getOffer: async () => null,
        merge: async () => undefined,
        keepSeparate: async () => undefined,
      },
      database: services.sync,
      getSession: async () => ({
        token: sessionToken,
        expiresAt: 99_999,
        profile: {accountId},
      }),
      onSessionRevoked: async () => undefined,
      flushReadingSession: async () => undefined,
      getReadingIntentRevision: () => 0,
      now: () => 8001,
    });

    lifecycle.updateContext({
      authStatus: 'authenticated',
      accountId,
      online: true,
      appActive: true,
    });
    await lifecycle.waitForIdle();

    expect(pushRequests).toHaveLength(1);
    expect(pushRequests[0].mutations).toEqual([
      expect.objectContaining({
        resource: 'BOOKMARK',
        type: 'DELETE',
        resourceId: 'remote-bookmark-1',
      }),
    ]);
    await expect(services.sync.getOutboxEntries(accountId)).resolves.toEqual(
      [],
    );
    await services.database.close();
  });

  it('preserves an uncertain NOTE UPDATE when pull observes a different remote update', async () => {
    const {database, annotations, sync, SqliteQfSyncPullStore} =
      await createServices('nonmatching-note-update.db');
    await sync.initialize();
    const note = await createRemoteBackedNote(sync, 'initial remote note');
    await sync.updateNote({
      accountId,
      noteId: note.id,
      content: 'sent local update',
    });
    const [candidate] = await sync.getOutboxEntries(accountId);
    const sent = await sync.markOperationInFlight({
      accountId,
      localOperationId: candidate.localOperationId,
      startedAt: 7001,
    });
    const pullStore = new SqliteQfSyncPullStore(database);

    await pullStore.applyPage(accountId, [
      {
        resource: 'NOTE',
        type: 'UPDATE',
        resourceId: 'remote-note-1',
        timestamp: 7002,
        data: {
          body: 'different remote update',
          ranges: ['2:255-2:255'],
          saveToQR: false,
        },
      },
    ]);

    await expect(
      annotations.getAllNotesInOwnerScope('qf:reader-a'),
    ).resolves.toEqual([
      expect.objectContaining({id: note.id, content: 'sent local update'}),
    ]);
    await expect(sync.getOutboxEntries(accountId)).resolves.toEqual([
      expect.objectContaining({
        localOperationId: candidate.localOperationId,
        deliveryState: 'IN_FLIGHT',
        inFlightPayloadJson: sent.inFlightPayloadJson,
      }),
    ]);
    await expect(
      sync.reconcileUncertainOperations({accountId, reconciledAt: 8001}),
    ).resolves.toEqual({acknowledged: 0, ambiguous: 0});
    const [pending] = await sync.getOutboxEntries(accountId);
    expect(pending).toMatchObject({
      localOperationId: candidate.localOperationId,
      mutationType: 'UPDATE',
      deliveryState: 'PENDING',
    });
    expect(JSON.parse(pending.payloadJson)).toMatchObject({
      content: 'sent local update',
    });
    await database.close();
  });

  it('preserves an uncertain NOTE UPDATE when pull observes a remote tombstone', async () => {
    const {database, annotations, sync, SqliteQfSyncPullStore} =
      await createServices('nonmatching-note-tombstone.db');
    await sync.initialize();
    const note = await createRemoteBackedNote(sync, 'initial remote note');
    await sync.updateNote({
      accountId,
      noteId: note.id,
      content: 'sent local update',
    });
    const [candidate] = await sync.getOutboxEntries(accountId);
    const sent = await sync.markOperationInFlight({
      accountId,
      localOperationId: candidate.localOperationId,
      startedAt: 7001,
    });
    const pullStore = new SqliteQfSyncPullStore(database);

    await pullStore.applyPage(accountId, [
      {
        resource: 'NOTE',
        type: 'DELETE',
        resourceId: 'remote-note-1',
        timestamp: 7002,
      },
    ]);

    await expect(
      annotations.getAllNotesInOwnerScope('qf:reader-a'),
    ).resolves.toEqual([
      expect.objectContaining({id: note.id, content: 'sent local update'}),
    ]);
    await expect(sync.getOutboxEntries(accountId)).resolves.toEqual([
      expect.objectContaining({
        localOperationId: candidate.localOperationId,
        deliveryState: 'IN_FLIGHT',
        inFlightPayloadJson: sent.inFlightPayloadJson,
      }),
    ]);
    await database.close();
  });

  it('preserves a newer local NOTE revision when pull proves a lost UPDATE succeeded', async () => {
    const {
      database,
      annotations,
      sync,
      IntegratedCoordinator,
      SqliteQfSyncPullStore,
      IntegratedApiError,
    } = await createServices('integrated-lost-note-update.db');
    await sync.initialize();
    await seedHead(database, 7001);
    const note = await sync.addNote({
      accountId,
      verseKey: '2:255',
      surahNumber: 2,
      ayahNumber: 255,
      content: 'initial remote note',
      verseKeys: ['2:255'],
    });
    let [create] = await sync.getOutboxEntries(accountId);
    await sync.markOperationInFlight({
      accountId,
      localOperationId: create.localOperationId,
      startedAt: 6999,
    });
    await sync.acknowledgeOperation({
      accountId,
      localOperationId: create.localOperationId,
      resourceId: 'remote-note-1',
      serverCreatedAt: 7000,
      serverUpdatedAt: 7000,
    });
    await sync.updateNote({
      accountId,
      noteId: note.id,
      content: 'sent revision',
    });
    [create] = await sync.getOutboxEntries(accountId);
    let sentMutation: BayaanSyncPushRequest['mutations'][number] | undefined;
    const transport = {
      push: async (_token: string, request: BayaanSyncPushRequest) => {
        sentMutation = request.mutations[0];
        await sync.updateNote({
          accountId,
          noteId: note.id,
          content: 'newer local revision',
        });
        throw new IntegratedApiError('service_unavailable', 503);
      },
      pull: async (
        _token: string,
        request: {metadataOnly?: boolean},
      ): Promise<BayaanSyncPullPage> => {
        if (request.metadataOnly) {
          return {lastMutationAt: 7002, mutations: []};
        }
        if (!sentMutation) throw new Error('Expected sent NOTE update');
        return {
          lastMutationAt: 7002,
          mutations: [
            {
              ...sentMutation,
              resourceId: 'remote-note-1',
              timestamp: 7002,
            } as BayaanSyncMutation,
          ],
          page: 1,
          limit: 1000,
          total: 1,
          hasMore: false,
        };
      },
    };
    const coordinator = new IntegratedCoordinator({
      transport,
      store: new SqliteQfSyncPullStore(database),
      pushStore: sync,
      now: () => 8001,
    });

    await expect(coordinator.push({accountId, sessionToken})).resolves.toEqual({
      status: 'recovered',
      head: 7002,
      acknowledged: 0,
      ambiguous: 0,
    });
    await expect(
      annotations.getAllNotesInOwnerScope('qf:reader-a'),
    ).resolves.toEqual([
      expect.objectContaining({
        id: note.id,
        remoteId: 'remote-note-1',
        content: 'newer local revision',
      }),
    ]);
    await expect(sync.getOutboxEntries(accountId)).resolves.toEqual([
      expect.objectContaining({
        localOperationId: create.localOperationId,
        mutationType: 'UPDATE',
        remoteId: 'remote-note-1',
        deliveryState: 'PENDING',
        revision: 2,
        inFlightRevision: null,
      }),
    ]);
    await database.close();
  });

  it('rebases a bookmark create already satisfied by the 409 pull without retrying it', async () => {
    const {
      database,
      sync,
      IntegratedCoordinator,
      SqliteQfSyncPullStore,
      IntegratedApiError,
    } = await createServices('integrated-409-bookmark.db');
    await sync.initialize();
    await seedHead(database, 7001);
    await sync.addBookmark({
      accountId,
      verseKey: '2:255',
      surahNumber: 2,
      ayahNumber: 255,
    });
    let pushes = 0;
    const transport = {
      push: async () => {
        pushes += 1;
        throw new IntegratedApiError('sync_conflict', 409);
      },
      pull: async (
        _token: string,
        request: {metadataOnly?: boolean},
      ): Promise<BayaanSyncPullPage> =>
        request.metadataOnly
          ? {lastMutationAt: 7002, mutations: []}
          : {
              lastMutationAt: 7002,
              mutations: [
                {
                  resource: 'BOOKMARK',
                  type: 'CREATE',
                  resourceId: 'remote-bookmark-1',
                  timestamp: 7002,
                  data: {key: 2, verseNumber: 255},
                },
              ],
              page: 1,
              limit: 1000,
              total: 1,
              hasMore: false,
            },
    };
    const coordinator = new IntegratedCoordinator({
      transport,
      store: new SqliteQfSyncPullStore(database),
      pushStore: sync,
      now: () => 8001,
    });

    await expect(coordinator.push({accountId, sessionToken})).resolves.toEqual({
      status: 'idle',
      head: 7002,
    });
    expect(pushes).toBe(1);
    await expect(sync.getOutboxEntries(accountId)).resolves.toEqual([]);
    await database.close();
  });

  it('rebases an exact NOTE create returned by the 409 pull without creating it twice', async () => {
    const {
      database,
      annotations,
      sync,
      IntegratedCoordinator,
      SqliteQfSyncPullStore,
      IntegratedApiError,
    } = await createServices('integrated-409-note.db');
    await sync.initialize();
    await seedHead(database, 7001);
    const note = await sync.addNote({
      accountId,
      verseKey: '2:255',
      surahNumber: 2,
      ayahNumber: 255,
      content: 'local note create',
      verseKeys: ['2:255'],
    });
    let sentMutation: BayaanSyncPushRequest['mutations'][number] | undefined;
    let pushes = 0;
    const transport = {
      push: async (_token: string, request: BayaanSyncPushRequest) => {
        pushes += 1;
        sentMutation = request.mutations[0];
        throw new IntegratedApiError('sync_conflict', 409);
      },
      pull: async (
        _token: string,
        request: {metadataOnly?: boolean},
      ): Promise<BayaanSyncPullPage> => {
        if (request.metadataOnly) {
          return {lastMutationAt: 7002, mutations: []};
        }
        if (!sentMutation?.data) throw new Error('Expected sent NOTE create');
        return {
          lastMutationAt: 7002,
          mutations: [
            {
              resource: 'NOTE',
              type: 'CREATE',
              resourceId: 'remote-note-1',
              timestamp: 7002,
              data: sentMutation.data,
            },
          ],
          page: 1,
          limit: 1000,
          total: 1,
          hasMore: false,
        };
      },
    };
    const coordinator = new IntegratedCoordinator({
      transport,
      store: new SqliteQfSyncPullStore(database),
      pushStore: sync,
      now: () => 8001,
    });

    await expect(coordinator.push({accountId, sessionToken})).resolves.toEqual({
      status: 'idle',
      head: 7002,
    });
    expect(pushes).toBe(1);
    await expect(sync.getOutboxEntries(accountId)).resolves.toEqual([]);
    await expect(
      annotations.getAllNotesInOwnerScope('qf:reader-a'),
    ).resolves.toEqual([
      expect.objectContaining({
        id: note.id,
        remoteId: 'remote-note-1',
        content: 'local note create',
      }),
    ]);
    await database.close();
  });

  it('keeps an ordinary pending BOOKMARK DELETE through 409 rebase and retries it', async () => {
    const {
      database,
      sync,
      IntegratedCoordinator,
      SqliteQfSyncPullStore,
      IntegratedApiError,
    } = await createServices('integrated-409-bookmark-delete.db');
    await sync.initialize();
    await seedHead(database, 7001);
    await sync.addBookmark({
      accountId,
      verseKey: '2:255',
      surahNumber: 2,
      ayahNumber: 255,
    });
    const [create] = await sync.getOutboxEntries(accountId);
    await sync.markOperationInFlight({
      accountId,
      localOperationId: create.localOperationId,
      startedAt: 6999,
    });
    await sync.acknowledgeOperation({
      accountId,
      localOperationId: create.localOperationId,
      resourceId: 'remote-bookmark-1',
      serverCreatedAt: 7000,
      serverUpdatedAt: 7000,
    });
    await sync.removeBookmark({accountId, verseKey: '2:255'});
    const pushed: BayaanSyncPushRequest[] = [];
    const transport = {
      push: async (_token: string, request: BayaanSyncPushRequest) => {
        pushed.push(request);
        if (pushed.length === 1) {
          throw new IntegratedApiError('sync_conflict', 409);
        }
        return {
          lastMutationAt: 7003,
          mutations: [
            {
              resource: 'BOOKMARK' as const,
              type: 'DELETE' as const,
              resourceId: 'remote-bookmark-1',
              timestamp: 7003,
            },
          ],
        };
      },
      pull: async (
        _token: string,
        request: {metadataOnly?: boolean},
      ): Promise<BayaanSyncPullPage> =>
        request.metadataOnly
          ? {lastMutationAt: 7002, mutations: []}
          : {
              lastMutationAt: 7002,
              mutations: [],
              page: 1,
              limit: 1000,
              total: 0,
              hasMore: false,
            },
    };
    const coordinator = new IntegratedCoordinator({
      transport,
      store: new SqliteQfSyncPullStore(database),
      pushStore: sync,
      now: () => 8001,
    });

    await expect(coordinator.push({accountId, sessionToken})).resolves.toEqual({
      status: 'synced',
      head: 7003,
      pushed: 1,
    });
    expect(pushed).toHaveLength(2);
    expect(pushed[1]).toMatchObject({
      lastMutationAt: 7002,
      mutations: [
        {
          resource: 'BOOKMARK',
          type: 'DELETE',
          resourceId: 'remote-bookmark-1',
        },
      ],
    });
    await database.close();
  });

  it('keeps a pending NOTE UPDATE through an unrelated 409 pull and retries it', async () => {
    const {
      database,
      sync,
      IntegratedCoordinator,
      SqliteQfSyncPullStore,
      IntegratedApiError,
    } = await createServices('integrated-409-note-update.db');
    await sync.initialize();
    await seedHead(database, 7001);
    const note = await createRemoteBackedNote(sync, 'initial remote note');
    await sync.updateNote({
      accountId,
      noteId: note.id,
      content: 'pending local update',
    });
    const pushed: BayaanSyncPushRequest[] = [];
    const transport = {
      push: async (_token: string, request: BayaanSyncPushRequest) => {
        pushed.push(request);
        if (pushed.length === 1) {
          throw new IntegratedApiError('sync_conflict', 409);
        }
        return {
          lastMutationAt: 7003,
          mutations: [
            {
              ...request.mutations[0],
              resourceId: 'remote-note-1',
              timestamp: 7003,
            },
          ],
        };
      },
      pull: async (
        _token: string,
        request: {metadataOnly?: boolean},
      ): Promise<BayaanSyncPullPage> =>
        request.metadataOnly
          ? {lastMutationAt: 7002, mutations: []}
          : {
              lastMutationAt: 7002,
              mutations: [],
              page: 1,
              limit: 1000,
              total: 0,
              hasMore: false,
            },
    };
    const coordinator = new IntegratedCoordinator({
      transport,
      store: new SqliteQfSyncPullStore(database),
      pushStore: sync,
      now: () => 8001,
    });

    await expect(coordinator.push({accountId, sessionToken})).resolves.toEqual({
      status: 'synced',
      head: 7003,
      pushed: 1,
    });
    expect(pushed).toHaveLength(2);
    expect(pushed[1]).toMatchObject({
      lastMutationAt: 7002,
      mutations: [
        {
          resource: 'NOTE',
          type: 'UPDATE',
          resourceId: 'remote-note-1',
          data: {body: 'pending local update'},
        },
      ],
    });
    await database.close();
  });

  it('rebases reading intent changed during the 409 pull into one remote-backed UPDATE retry', async () => {
    const {
      database,
      sync,
      IntegratedCoordinator,
      SqliteQfSyncPullStore,
      IntegratedApiError,
    } = await createServices('integrated-409-reading.db');
    await sync.initialize();
    await seedHead(database, 7001);
    await sync.upsertReadingLocation({
      accountId,
      verseKey: '3:7',
      surahNumber: 3,
      ayahNumber: 7,
      lastReadAt: 1000,
    });
    const pushed: BayaanSyncPushRequest[] = [];
    let changed = false;
    const transport = {
      push: async (_token: string, request: BayaanSyncPushRequest) => {
        pushed.push(request);
        if (pushed.length === 1) {
          throw new IntegratedApiError('sync_conflict', 409);
        }
        return {
          lastMutationAt: 7003,
          mutations: request.mutations.map(mutation => ({
            ...mutation,
            resourceId: 'remote-reading-1',
            timestamp: 7003,
          })),
        };
      },
      pull: async (
        _token: string,
        request: {metadataOnly?: boolean},
      ): Promise<BayaanSyncPullPage> => {
        if (request.metadataOnly) {
          return {lastMutationAt: 7002, mutations: []};
        }
        if (!changed) {
          changed = true;
          await sync.upsertReadingLocation({
            accountId,
            verseKey: '3:8',
            surahNumber: 3,
            ayahNumber: 8,
            lastReadAt: 2000,
          });
        }
        return {
          lastMutationAt: 7002,
          mutations: [
            {
              resource: 'READING_SESSION',
              type: 'CREATE',
              resourceId: 'remote-reading-1',
              timestamp: 7002,
              data: {
                chapterNumber: 3,
                verseNumber: 7,
                clientCreatedAt: '1970-01-01T00:00:01.000Z',
                clientUpdatedAt: '1970-01-01T00:00:01.000Z',
              },
            },
          ],
          page: 1,
          limit: 1000,
          total: 1,
          hasMore: false,
        };
      },
    };
    const coordinator = new IntegratedCoordinator({
      transport,
      store: new SqliteQfSyncPullStore(database),
      pushStore: sync,
      now: () => 8001,
    });

    await expect(coordinator.push({accountId, sessionToken})).resolves.toEqual({
      status: 'synced',
      head: 7003,
      pushed: 1,
    });
    expect(pushed).toHaveLength(2);
    expect(pushed[1]).toMatchObject({
      lastMutationAt: 7002,
      mutations: [
        {
          resource: 'READING_SESSION',
          type: 'UPDATE',
          resourceId: 'remote-reading-1',
          data: {chapterNumber: 3, verseNumber: 8},
        },
      ],
    });
    await database.close();
  });

  it('reserves a whole batch atomically when a later row cannot be marked', async () => {
    const {database, sync} = await createServices('atomic-reservation.db');
    await sync.initialize();
    await sync.addNote({
      accountId,
      verseKey: '2:255',
      surahNumber: 2,
      ayahNumber: 255,
      content: 'first',
    });
    await sync.addNote({
      accountId,
      verseKey: '2:256',
      surahNumber: 2,
      ayahNumber: 256,
      content: 'second',
    });
    const connection = (await database.getConnection()) as TestDatabase;
    let marks = 0;
    connection.beforeRunAsync = source => {
      if (
        source.includes("SET delivery_state = 'IN_FLIGHT'") &&
        ++marks === 2
      ) {
        throw new Error('inject second reservation failure');
      }
    };

    await expect(
      sync.reservePushBatch({
        accountId,
        limit: 100,
        startedAt: 7001,
        dueAt: 7001,
      }),
    ).rejects.toThrow('inject second reservation failure');
    await expect(sync.getOutboxEntries(accountId)).resolves.toEqual([
      expect.objectContaining({deliveryState: 'PENDING'}),
      expect.objectContaining({deliveryState: 'PENDING'}),
    ]);
    await database.close();
  });

  it('applies canonical returned data for every resource before advancing the success head', async () => {
    const {database, annotations, sync} = await createServices(
      'success-returned-data.db',
    );
    await sync.initialize();
    await seedHead(database, 7001);
    await sync.addBookmark({
      accountId,
      verseKey: '2:255',
      surahNumber: 2,
      ayahNumber: 255,
    });
    await sync.addNote({
      accountId,
      verseKey: '2:255',
      surahNumber: 2,
      ayahNumber: 255,
      content: 'local note',
    });
    await sync.upsertReadingLocation({
      accountId,
      verseKey: '3:7',
      surahNumber: 3,
      ayahNumber: 7,
      lastReadAt: 1000,
    });
    const sent = await sync.reservePushBatch({
      accountId,
      limit: 100,
      startedAt: 7001,
      dueAt: 7001,
    });
    const mutations = sent.map((entry: QfOutboxEntry): BayaanSyncMutation => {
      if (entry.resource === 'BOOKMARK') {
        return {
          resource: 'BOOKMARK',
          type: 'CREATE',
          resourceId: 'remote-bookmark-1',
          timestamp: 7002,
          data: {key: 2, verseNumber: 256},
        };
      }
      if (entry.resource === 'NOTE') {
        return {
          resource: 'NOTE',
          type: 'CREATE',
          resourceId: 'remote-note-1',
          timestamp: 7002,
          data: {
            body: 'canonical server note',
            ranges: ['2:256-2:256'],
            saveToQR: false,
          },
        };
      }
      return {
        resource: 'READING_SESSION',
        type: 'CREATE',
        resourceId: 'remote-reading-1',
        timestamp: 7002,
        data: {
          chapterNumber: 3,
          verseNumber: 8,
          clientUpdatedAt: '1970-01-01T00:00:09.000Z',
        },
      };
    });

    await expect(
      sync.commitPushSuccess({
        accountId,
        expectedHead: 7001,
        sent,
        result: {lastMutationAt: 7002, mutations},
        syncedAt: 7002,
      }),
    ).resolves.toBe(true);
    await expect(sync.getStoredHead(accountId)).resolves.toBe(7002);
    await expect(
      annotations.getAllBookmarksInOwnerScope('qf:reader-a'),
    ).resolves.toEqual([
      expect.objectContaining({
        verseKey: '2:256',
        remoteId: 'remote-bookmark-1',
      }),
    ]);
    await expect(
      annotations.getAllNotesInOwnerScope('qf:reader-a'),
    ).resolves.toEqual([
      expect.objectContaining({
        content: 'canonical server note',
        verseKey: '2:256',
        remoteId: 'remote-note-1',
      }),
    ]);
    await expect(sync.getReadingLocations(accountId)).resolves.toEqual([
      expect.objectContaining({
        verseKey: '3:8',
        remoteId: 'remote-reading-1',
        lastReadAt: 9000,
      }),
    ]);
    await database.close();
  });

  it('applies a returned DELETE by remote ID before acknowledging and advancing the head', async () => {
    const {database, annotations, sync} = await createServices(
      'success-returned-delete.db',
    );
    await sync.initialize();
    await seedHead(database, 7001);
    await sync.addBookmark({
      accountId,
      verseKey: '2:255',
      surahNumber: 2,
      ayahNumber: 255,
    });
    const [create] = await sync.getOutboxEntries(accountId);
    await sync.markOperationInFlight({
      accountId,
      localOperationId: create.localOperationId,
      startedAt: 6999,
    });
    await sync.acknowledgeOperation({
      accountId,
      localOperationId: create.localOperationId,
      resourceId: 'remote-bookmark-1',
      serverCreatedAt: 7000,
      serverUpdatedAt: 7000,
    });
    await sync.removeBookmark({accountId, verseKey: '2:255'});
    const connection = (await database.getConnection()) as TestDatabase;
    await connection.runAsync(
      `INSERT INTO bookmarks
         (id, owner_scope, verse_key, surah_number, ayah_number, created_at,
          rewayah_id, remote_id, server_created_at, server_updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?),
              (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'pulled-bookmark',
        'qf:reader-a',
        '2:255',
        2,
        255,
        7000,
        'hafs',
        'remote-bookmark-1',
        7000,
        7000,
        'unrelated-bookmark',
        'qf:reader-a',
        '2:256',
        2,
        256,
        7000,
        'hafs',
        'remote-bookmark-2',
        7000,
        7000,
      ],
    );
    const sent = await sync.reservePushBatch({
      accountId,
      limit: 100,
      startedAt: 7001,
      dueAt: 7001,
    });

    await expect(
      sync.commitPushSuccess({
        accountId,
        expectedHead: 7001,
        sent,
        result: {
          lastMutationAt: 7002,
          mutations: [
            {
              resource: 'BOOKMARK',
              type: 'DELETE',
              resourceId: 'remote-bookmark-2',
              timestamp: 7002,
            },
          ],
        },
        syncedAt: 7002,
      }),
    ).rejects.toThrow('Push response mutation does not match sent intent');
    await expect(sync.getStoredHead(accountId)).resolves.toBe(7001);
    await expect(sync.getOutboxEntries(accountId)).resolves.toEqual([
      expect.objectContaining({
        deliveryState: 'IN_FLIGHT',
        remoteId: 'remote-bookmark-1',
      }),
    ]);
    await expect(
      annotations.getAllBookmarksInOwnerScope('qf:reader-a'),
    ).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({remoteId: 'remote-bookmark-1'}),
        expect.objectContaining({remoteId: 'remote-bookmark-2'}),
      ]),
    );

    await expect(
      sync.commitPushSuccess({
        accountId,
        expectedHead: 7001,
        sent,
        result: {
          lastMutationAt: 7002,
          mutations: [
            {
              resource: 'BOOKMARK',
              type: 'DELETE',
              resourceId: 'remote-bookmark-1',
              timestamp: 7002,
            },
          ],
        },
        syncedAt: 7002,
      }),
    ).resolves.toBe(true);
    await expect(sync.getStoredHead(accountId)).resolves.toBe(7002);
    await expect(
      annotations.getAllBookmarksInOwnerScope('qf:reader-a'),
    ).resolves.toEqual([
      expect.objectContaining({remoteId: 'remote-bookmark-2'}),
    ]);
    await expect(sync.getOutboxEntries(accountId)).resolves.toEqual([]);
    await database.close();
  });

  it('correlates a lost bookmark CREATE by verse and preserves a newer DELETE', async () => {
    const {
      database,
      annotations,
      sync,
      IntegratedCoordinator,
      SqliteQfSyncPullStore,
      IntegratedApiError,
    } = await createServices('integrated-lost-bookmark-delete.db');
    await sync.initialize();
    await seedHead(database, 7001);
    await sync.addBookmark({
      accountId,
      verseKey: '2:255',
      surahNumber: 2,
      ayahNumber: 255,
    });
    const transport = {
      push: async () => {
        await sync.removeBookmark({accountId, verseKey: '2:255'});
        throw new IntegratedApiError('service_unavailable', 503);
      },
      pull: async (
        _token: string,
        request: {metadataOnly?: boolean},
      ): Promise<BayaanSyncPullPage> =>
        request.metadataOnly
          ? {lastMutationAt: 7002, mutations: []}
          : {
              lastMutationAt: 7002,
              mutations: [
                {
                  resource: 'BOOKMARK',
                  type: 'CREATE',
                  resourceId: 'remote-bookmark-1',
                  timestamp: 7002,
                  data: {key: 2, verseNumber: 255},
                },
              ],
              page: 1,
              limit: 1000,
              total: 1,
              hasMore: false,
            },
    };
    const coordinator = new IntegratedCoordinator({
      transport,
      store: new SqliteQfSyncPullStore(database),
      pushStore: sync,
      now: () => 8001,
    });

    await expect(coordinator.push({accountId, sessionToken})).resolves.toEqual({
      status: 'recovered',
      head: 7002,
      acknowledged: 1,
      ambiguous: 0,
    });
    await expect(
      annotations.getAllBookmarksInOwnerScope('qf:reader-a'),
    ).resolves.toEqual([]);
    await expect(sync.getOutboxEntries(accountId)).resolves.toEqual([
      expect.objectContaining({
        mutationType: 'DELETE',
        remoteId: 'remote-bookmark-1',
        deliveryState: 'PENDING',
        inFlightRevision: null,
      }),
    ]);
    await database.close();
  });

  it('rolls back acknowledgements and remote metadata when head advancement fails', async () => {
    const {database, annotations, sync} =
      await createServices('atomic-rollback.db');
    await sync.initialize();
    const bookmark = await sync.addBookmark({
      accountId,
      verseKey: '2:255',
      surahNumber: 2,
      ayahNumber: 255,
    });
    const [candidate] = await sync.getOutboxEntries(accountId);
    const sent = await sync.markOperationInFlight({
      accountId,
      localOperationId: candidate.localOperationId,
      startedAt: 7001,
    });
    const connection = (await database.getConnection()) as TestDatabase;
    await connection.runAsync(
      `INSERT INTO qf_sync_state
         (owner_scope, last_mutation_at, created_at, updated_at)
       VALUES (?, ?, ?, ?)`,
      ['qf:reader-a', '7001', 7001, 7001],
    );
    connection.beforeRunAsync = source => {
      if (source.includes('INSERT INTO qf_sync_state')) {
        throw new Error('inject head failure');
      }
    };

    await expect(
      sync.commitPushSuccess({
        accountId,
        expectedHead: 7001,
        sent: [sent],
        result: {
          lastMutationAt: 7002,
          mutations: [
            {
              resource: 'BOOKMARK',
              type: 'CREATE',
              resourceId: 'remote-bookmark-1',
              timestamp: 7002,
              data: {key: 2, verseNumber: 255},
            },
          ],
        },
        syncedAt: 7002,
      }),
    ).rejects.toThrow('inject head failure');

    await expect(sync.getStoredHead(accountId)).resolves.toBe(7001);
    await expect(sync.getOutboxEntries(accountId)).resolves.toEqual([
      expect.objectContaining({
        localOperationId: candidate.localOperationId,
        deliveryState: 'IN_FLIGHT',
      }),
    ]);
    await expect(
      annotations.getAllBookmarksInOwnerScope('qf:reader-a'),
    ).resolves.toEqual([
      expect.objectContaining({id: bookmark.id, remoteId: undefined}),
    ]);
    await database.close();
  });

  it('preserves immutable bookmark evidence while remove/add coalesces current intent', async () => {
    const {database, sync} = await createServices('bookmark-coalescing.db');
    await sync.initialize();
    await sync.addBookmark({
      accountId,
      verseKey: '2:255',
      surahNumber: 2,
      ayahNumber: 255,
    });
    const [candidate] = await sync.getOutboxEntries(accountId);
    const sent = await sync.markOperationInFlight({
      accountId,
      localOperationId: candidate.localOperationId,
      startedAt: 7001,
    });

    await sync.removeBookmark({accountId, verseKey: '2:255'});
    await sync.addBookmark({
      accountId,
      verseKey: '2:255',
      surahNumber: 2,
      ayahNumber: 255,
    });

    await expect(sync.getOutboxEntries(accountId)).resolves.toEqual([
      expect.objectContaining({
        localOperationId: candidate.localOperationId,
        mutationType: 'CREATE',
        deliveryState: 'IN_FLIGHT',
        revision: 3,
        inFlightRevision: 1,
        inFlightMutationType: 'CREATE',
        inFlightPayloadJson: sent.inFlightPayloadJson,
      }),
    ]);
    await database.close();
  });

  it('cancels an unsent remote bookmark delete when the final intent is add', async () => {
    const {database, annotations, sync} = await createServices(
      'bookmark-delete-add.db',
    );
    await sync.initialize();
    await sync.addBookmark({
      accountId,
      verseKey: '2:255',
      surahNumber: 2,
      ayahNumber: 255,
    });
    const [candidate] = await sync.getOutboxEntries(accountId);
    await sync.markOperationInFlight({
      accountId,
      localOperationId: candidate.localOperationId,
      startedAt: 7001,
    });
    await sync.acknowledgeOperation({
      accountId,
      localOperationId: candidate.localOperationId,
      resourceId: 'remote-bookmark-1',
      serverCreatedAt: 7002,
      serverUpdatedAt: 7002,
    });

    await sync.removeBookmark({accountId, verseKey: '2:255'});
    await sync.addBookmark({
      accountId,
      verseKey: '2:255',
      surahNumber: 2,
      ayahNumber: 255,
    });

    await expect(sync.getOutboxEntries(accountId)).resolves.toEqual([]);
    await expect(
      annotations.getAllBookmarksInOwnerScope('qf:reader-a'),
    ).resolves.toEqual([
      expect.objectContaining({
        verseKey: '2:255',
        remoteId: 'remote-bookmark-1',
        serverUpdatedAt: 7002,
      }),
    ]);
    await database.close();
  });

  it('durably quarantines an unprovable in-flight note create', async () => {
    const {database, sync} = await createServices('ambiguous-note.db');
    await sync.initialize();
    await sync.addNote({
      accountId,
      verseKey: '2:255',
      surahNumber: 2,
      ayahNumber: 255,
      content: 'Could have reached the server',
    });
    const [candidate] = await sync.getOutboxEntries(accountId);
    await sync.markOperationInFlight({
      accountId,
      localOperationId: candidate.localOperationId,
      startedAt: 7001,
    });

    await expect(
      sync.reconcileUncertainOperations({accountId, reconciledAt: 8001}),
    ).resolves.toEqual({acknowledged: 0, ambiguous: 1});
    await expect(sync.getOutboxEntries(accountId)).resolves.toEqual([
      expect.objectContaining({
        localOperationId: candidate.localOperationId,
        deliveryState: 'AMBIGUOUS',
        inFlightRevision: 1,
        inFlightMutationType: 'CREATE',
      }),
    ]);
    await database.close();
  });

  it('correlates one exact pulled note create without replaying or duplicating it', async () => {
    const {database, annotations, sync} =
      await createServices('correlated-note.db');
    await sync.initialize();
    const note = await sync.addNote({
      accountId,
      verseKey: '2:255',
      surahNumber: 2,
      ayahNumber: 255,
      content: 'Response was lost',
    });
    const [candidate] = await sync.getOutboxEntries(accountId);
    const sent = await sync.markOperationInFlight({
      accountId,
      localOperationId: candidate.localOperationId,
      startedAt: 7001,
    });
    if (!sent.inFlightPayloadJson) {
      throw new Error('Expected durable note create evidence');
    }
    const payload = JSON.parse(sent.inFlightPayloadJson) as {
      clientCreatedAt: number;
    };
    const connection = (await database.getConnection()) as TestDatabase;
    await connection.runAsync(
      `INSERT INTO notes
         (id, owner_scope, verse_key, surah_number, ayah_number, content,
          verse_keys, created_at, updated_at, rewayah_id, remote_id,
          server_created_at, server_updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'pulled-duplicate',
        'qf:reader-a',
        '2:255',
        2,
        255,
        'Response was lost',
        '2:255',
        payload.clientCreatedAt,
        7002,
        'hafs',
        'remote-note-1',
        7002,
        7002,
      ],
    );

    await expect(
      sync.reconcileUncertainOperations({accountId, reconciledAt: 8001}),
    ).resolves.toEqual({acknowledged: 1, ambiguous: 0});
    await expect(sync.getOutboxEntries(accountId)).resolves.toEqual([]);
    await expect(
      annotations.getAllNotesInOwnerScope('qf:reader-a'),
    ).resolves.toEqual([
      expect.objectContaining({
        id: note.id,
        remoteId: 'remote-note-1',
        content: 'Response was lost',
      }),
    ]);
    await database.close();
  });
});
