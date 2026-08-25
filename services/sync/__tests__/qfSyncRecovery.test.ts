import {
  BayaanSyncApiError,
  type BayaanSyncPushRequest,
} from '@/services/sync/bayaanSyncApiClient';
import {
  QfSyncCoordinator,
  type QfSyncPullStore,
  type QfSyncPushStore,
  type QfSyncTransport,
} from '@/services/sync/qfSyncCoordinator';
import type {QfOutboxEntry} from '@/services/sync/qfSyncDatabaseService';
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
  closeAsync(): Promise<void>;
};

class ExpoSqliteWasmDatabase implements TestDatabase {
  private readonly dbPromise: Promise<number>;

  constructor(databaseName: string) {
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
    const originalRunAsync = connection.runAsync.bind(connection);
    let marks = 0;
    connection.runAsync = async (source, params) => {
      if (
        source.includes("SET delivery_state = 'IN_FLIGHT'") &&
        ++marks === 2
      ) {
        throw new Error('inject second reservation failure');
      }
      return originalRunAsync(source, params);
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
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
    ).resolves.toEqual([]);
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
    const {database, annotations, sync} = await createServices(
      'atomic-rollback.db',
    );
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
    const originalRunAsync = connection.runAsync.bind(connection);
    connection.runAsync = async (source, params) => {
      if (source.includes('INSERT INTO qf_sync_state')) {
        throw new Error('inject head failure');
      }
      return originalRunAsync(source, params);
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
    const {database, annotations, sync} = await createServices(
      'correlated-note.db',
    );
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
