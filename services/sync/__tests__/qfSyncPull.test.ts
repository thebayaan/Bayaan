import type {
  BayaanSyncMutation,
  BayaanSyncPullPage,
} from '@/services/sync/bayaanSyncCodec';
import {
  QfSyncCoordinator,
  SqliteQfSyncPullStore,
  type QfSyncPullStore,
  type QfSyncPullTransport,
} from '@/services/sync/qfSyncCoordinator';
import type {BayaanSyncPullRequest} from '@/services/sync/bayaanSyncApiClient';
import {migrateUserSyncV1} from '@/services/database/migrations/userSyncV1';
import {migrateUserSyncV2} from '@/services/database/migrations/userSyncV2';

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

class TestSqliteDatabase {
  private readonly dbPromise: Promise<number>;
  transactionCount = 0;

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
    this.transactionCount += 1;
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

async function createSqliteStore(name: string) {
  const database = new TestSqliteDatabase(name);
  await migrateUserSyncV1(database);
  await migrateUserSyncV2(database);
  const store = new SqliteQfSyncPullStore({
    getConnection: async () => database,
  });
  return {database, store};
}

const accountId = 'bayaan-account-a';
const sessionToken = 'opaque-bayaan-session';

function bookmark(resourceId: string, timestamp: number): BayaanSyncMutation {
  return {
    resource: 'BOOKMARK',
    type: 'CREATE',
    resourceId,
    timestamp,
    data: {key: 2, verseNumber: 255, type: 'ayah'},
  };
}

function noteDelete(resourceId: string, timestamp: number): BayaanSyncMutation {
  return {resource: 'NOTE', type: 'DELETE', resourceId, timestamp};
}

function privateNote(
  resourceId: string,
  timestamp: number,
  body: string,
): BayaanSyncMutation {
  return {
    resource: 'NOTE',
    type: 'UPDATE',
    resourceId,
    timestamp,
    data: {body, ranges: ['2:255-2:255'], saveToQR: false},
  };
}

function readingSession(
  resourceId: string,
  timestamp: number,
): BayaanSyncMutation {
  return {
    resource: 'READING_SESSION',
    type: 'UPDATE',
    resourceId,
    timestamp,
    data: {chapterNumber: 3, verseNumber: 7},
  };
}

class MemoryPullStore implements QfSyncPullStore {
  readonly heads = new Map<string, number>();
  readonly resources = new Map<string, BayaanSyncMutation>();
  readonly events: string[] = [];

  async getStoredHead(ownerAccountId: string): Promise<number> {
    return this.heads.get(ownerAccountId) ?? 0;
  }

  async applyPage(
    ownerAccountId: string,
    mutations: BayaanSyncMutation[],
  ): Promise<void> {
    const next = new Map(this.resources);
    for (const mutation of mutations) {
      const key = `${ownerAccountId}:${mutation.resource}:${mutation.resourceId}`;
      if (mutation.type === 'DELETE') next.delete(key);
      else next.set(key, mutation);
    }
    this.resources.clear();
    for (const [key, value] of next) this.resources.set(key, value);
    this.events.push(`apply:${mutations.length}`);
  }

  async commitStableHead(
    ownerAccountId: string,
    expectedHead: number,
    stableHead: number,
    _syncedAt: number,
  ): Promise<boolean> {
    if ((this.heads.get(ownerAccountId) ?? 0) !== expectedHead) return false;
    this.heads.set(ownerAccountId, stableHead);
    this.events.push(`commit:${stableHead}`);
    return true;
  }
}

type PullStep =
  | BayaanSyncPullPage
  | ((
      request: BayaanSyncPullRequest,
    ) => BayaanSyncPullPage | Promise<BayaanSyncPullPage>);

class ScriptedTransport implements QfSyncPullTransport {
  readonly requests: BayaanSyncPullRequest[] = [];
  readonly tokens: string[] = [];

  constructor(private readonly steps: PullStep[]) {}

  async pull(
    token: string,
    request: BayaanSyncPullRequest,
  ): Promise<BayaanSyncPullPage> {
    this.tokens.push(token);
    this.requests.push(request);
    const step = this.steps.shift();
    if (!step) throw new Error('Unexpected pull');
    return typeof step === 'function' ? step(request) : step;
  }
}

describe('QF stable pull coordinator', () => {
  it('starts an unseen account at zero, pages transactionally, then commits only the matching metadata head', async () => {
    const store = new MemoryPullStore();
    store.resources.set(`${accountId}:NOTE:remote-note-deleted`, {
      resource: 'NOTE',
      type: 'CREATE',
      resourceId: 'remote-note-deleted',
      timestamp: 1,
      data: {body: 'old', ranges: ['2:255-2:255'], saveToQR: false},
    });
    const transport = new ScriptedTransport([
      {
        lastMutationAt: 10,
        mutations: [bookmark('remote-bookmark-1', 8)],
        page: 1,
        limit: 1000,
        total: 1001,
        hasMore: true,
      },
      {
        lastMutationAt: 10,
        mutations: [noteDelete('remote-note-deleted', 9)],
        page: 2,
        limit: 1000,
        total: 1001,
        hasMore: false,
      },
      request => {
        expect(request.metadataOnly).toBe(true);
        expect(store.heads.get(accountId)).toBeUndefined();
        return {lastMutationAt: 10, mutations: []};
      },
    ]);
    const coordinator = new QfSyncCoordinator({
      transport,
      store,
      now: () => 99,
    });

    await expect(coordinator.pull({accountId, sessionToken})).resolves.toEqual({
      status: 'synced',
      head: 10,
      restarts: 0,
    });

    expect(transport.tokens).toEqual([
      sessionToken,
      sessionToken,
      sessionToken,
    ]);
    expect(transport.requests).toEqual([
      {mutationsSince: 0, metadataOnly: false, limit: 1000, page: 1},
      {mutationsSince: 0, metadataOnly: false, limit: 1000, page: 2},
      {mutationsSince: 0, metadataOnly: true},
    ]);
    expect(store.events).toEqual(['apply:1', 'apply:1', 'commit:10']);
    expect(store.heads.get(accountId)).toBe(10);
    expect(store.resources.has(`${accountId}:BOOKMARK:remote-bookmark-1`)).toBe(
      true,
    );
    expect(store.resources.has(`${accountId}:NOTE:remote-note-deleted`)).toBe(
      false,
    );
  });

  it('restarts from the persisted head after a live OFFSET traversal changes', async () => {
    const store = new MemoryPullStore();
    store.heads.set(accountId, 4);
    const transport = new ScriptedTransport([
      {lastMutationAt: 10, mutations: [bookmark('remote-bookmark-1', 8)]},
      {lastMutationAt: 11, mutations: []},
      {lastMutationAt: 11, mutations: [bookmark('remote-bookmark-1', 10)]},
      {lastMutationAt: 11, mutations: []},
    ]);
    const waits: number[] = [];
    const coordinator = new QfSyncCoordinator({
      transport,
      store,
      baseBackoffMs: 25,
      sleep: async delayMs => {
        waits.push(delayMs);
      },
    });

    await expect(coordinator.pull({accountId, sessionToken})).resolves.toEqual({
      status: 'synced',
      head: 11,
      restarts: 1,
    });

    expect(transport.requests).toEqual([
      {mutationsSince: 4, metadataOnly: false, limit: 1000, page: 1},
      {mutationsSince: 4, metadataOnly: true},
      {mutationsSince: 4, metadataOnly: false, limit: 1000, page: 1},
      {mutationsSince: 4, metadataOnly: true},
    ]);
    expect(waits).toEqual([25]);
    expect(store.events).toEqual(['apply:1', 'apply:1', 'commit:11']);
    expect(store.heads.get(accountId)).toBe(11);
  });

  it('bounds unstable restarts, leaves the stored head unchanged, and returns retry backoff', async () => {
    const store = new MemoryPullStore();
    const transport = new ScriptedTransport([
      {lastMutationAt: 1, mutations: []},
      {lastMutationAt: 2, mutations: []},
      {lastMutationAt: 2, mutations: []},
      {lastMutationAt: 3, mutations: []},
      {lastMutationAt: 3, mutations: []},
      {lastMutationAt: 4, mutations: []},
    ]);
    const waits: number[] = [];
    const coordinator = new QfSyncCoordinator({
      transport,
      store,
      maxRestarts: 2,
      baseBackoffMs: 10,
      sleep: async delayMs => {
        waits.push(delayMs);
      },
    });

    await expect(coordinator.pull({accountId, sessionToken})).resolves.toEqual({
      status: 'deferred',
      reason: 'unstable_head',
      retryAfterMs: 40,
      restarts: 2,
    });

    expect(waits).toEqual([10, 20]);
    expect(store.heads.get(accountId)).toBeUndefined();
    expect(store.events).toEqual(['apply:0', 'apply:0', 'apply:0']);
    expect(transport.requests.filter(request => !request.metadataOnly)).toEqual(
      [
        {mutationsSince: 0, metadataOnly: false, limit: 1000, page: 1},
        {mutationsSince: 0, metadataOnly: false, limit: 1000, page: 1},
        {mutationsSince: 0, metadataOnly: false, limit: 1000, page: 1},
      ],
    );
  });

  it.each([
    [
      'contradictory hasMore',
      {
        lastMutationAt: 10,
        mutations: [],
        page: 1,
        limit: 1000,
        total: 1500,
        hasMore: false,
      },
    ],
    [
      'wrong returned page',
      {
        lastMutationAt: 10,
        mutations: [],
        page: 2,
        limit: 1000,
        total: 0,
        hasMore: false,
      },
    ],
    [
      'wrong returned limit',
      {
        lastMutationAt: 10,
        mutations: [],
        page: 1,
        limit: 500,
        total: 0,
        hasMore: false,
      },
    ],
    [
      'incomplete continuation metadata',
      {
        lastMutationAt: 10,
        mutations: [],
        page: 1,
        limit: 1000,
        hasMore: false,
      },
    ],
    [
      'a fully projected page without continuation metadata',
      {lastMutationAt: 10, mutations: [], receivedMutationCount: 1000},
    ],
    [
      'a full page without continuation metadata',
      {
        lastMutationAt: 10,
        mutations: Array.from({length: 1000}, (_, index) =>
          bookmark(`remote-bookmark-${index}`, index + 1),
        ),
      },
    ],
  ])(
    'defers %s without applying it or committing its head',
    async (_name, page) => {
      const store = new MemoryPullStore();
      const transport = new ScriptedTransport([
        page as BayaanSyncPullPage,
        {lastMutationAt: 10, mutations: []},
      ]);
      const coordinator = new QfSyncCoordinator({transport, store});

      await expect(
        coordinator.pull({accountId, sessionToken}),
      ).resolves.toEqual({
        status: 'deferred',
        reason: 'invalid_pagination',
        retryAfterMs: 250,
        restarts: 0,
      });
      expect(store.heads.get(accountId)).toBeUndefined();
      expect(store.events).toEqual([]);
    },
  );
});

describe('SQLite QF pull store', () => {
  it.each([false, true])(
    'compares queued payload dates, not row/server timestamps or insertion order (multiple=%s)',
    async multiple => {
      const {database, store} = await createSqliteStore(
        `reading-payload-time-${multiple}.db`,
      );
      await database.runAsync(
        `INSERT INTO qf_reading_locations (id, owner_scope, remote_id, surah_number, ayah_number, verse_key, last_read_at, server_updated_at, created_at, updated_at) VALUES ('reading', 'qf:reader-a', 'remote', 3, 8, '3:8', ?, 100, 50, 9999)`,
        [multiple ? 3000 : 9999],
      );
      const insert = `INSERT INTO qf_sync_outbox (local_operation_id, owner_scope, account_id, resource, mutation_type, local_id, remote_id, payload_json, base_server_updated_at, created_at, delivery_state) VALUES (?, 'qf:reader-a', 'reader-a', 'READING_SESSION', 'UPDATE', 'reading', 'remote', ?, 100, ?, 'PENDING')`;
      await database.runAsync(insert, [
        'older',
        JSON.stringify({clientUpdatedAt: 1000}),
        5000,
      ]);
      if (multiple)
        await database.runAsync(insert, [
          'newer',
          JSON.stringify({clientUpdatedAt: 3000}),
          500,
        ]);
      const remote: BayaanSyncMutation = {
        resource: 'READING_SESSION',
        type: 'UPDATE',
        resourceId: 'remote',
        timestamp: 200,
        data: {
          chapterNumber: 3,
          verseNumber: 9,
          clientUpdatedAt: new Date(2000).toISOString(),
        },
      };
      await store.applyPage('reader-a', [
        remote,
        remote,
        {...remote, timestamp: 150},
      ]);
      expect(
        await database.getFirstAsync(
          `SELECT verse_key, last_read_at, server_updated_at FROM qf_reading_locations`,
        ),
      ).toEqual({
        verse_key: multiple ? '3:8' : '3:9',
        last_read_at: multiple ? 3000 : 2000,
        server_updated_at: 200,
      });
      expect(
        await database.getAllAsync(
          `SELECT local_operation_id, base_server_updated_at FROM qf_sync_outbox`,
        ),
      ).toEqual(
        multiple
          ? [{local_operation_id: 'newer', base_server_updated_at: 200}]
          : [],
      );
      // Apply-only never advances the stable traversal cursor.
      expect(await store.getStoredHead('reader-a')).toBe(0);
      await database.closeAsync();
    },
  );

  it.each(['PENDING', 'IN_FLIGHT', 'AMBIGUOUS', 'DELETE'])(
    'adopts a remote bookmark without replaying satisfied creates (%s)',
    async state => {
      const {database, store} = await createSqliteStore(
        `qf-bookmark-adopt-${state}.db`,
      );
      await database.runAsync(
        `INSERT INTO bookmarks (id, owner_scope, verse_key, surah_number, ayah_number, created_at, rewayah_id) VALUES ('local', 'qf:reader-a', '2:255', 2, 255, 100, 'warsh')`,
      );
      await database.runAsync(
        `INSERT INTO qf_sync_outbox (local_operation_id, owner_scope, account_id, resource, mutation_type, local_id, payload_json, created_at, revision, delivery_state) VALUES ('intent', 'qf:reader-a', 'reader-a', 'BOOKMARK', ?, 'local', '{}', 100, 1, ?)`,
        [
          state === 'DELETE' ? 'DELETE' : 'CREATE',
          state === 'DELETE' ? 'PENDING' : state,
        ],
      );
      await store.applyPage('reader-a', [bookmark('remote', 200)]);
      expect(
        await database.getFirstAsync(
          `SELECT id, remote_id, rewayah_id FROM bookmarks WHERE owner_scope = 'qf:reader-a'`,
        ),
      ).toEqual({id: 'local', remote_id: 'remote', rewayah_id: 'warsh'});
      expect(
        await database.getAllAsync(
          `SELECT local_operation_id FROM qf_sync_outbox`,
        ),
      ).toHaveLength(state === 'PENDING' ? 0 : 1);
      await database.closeAsync();
    },
  );
  it('resolves an automatic note conflict only after preserving the local copy and its outbox intent', async () => {
    const {database, store} = await createSqliteStore(
      'qf-note-auto-resolution.db',
    );
    await database.runAsync(
      `INSERT INTO notes (id, owner_scope, verse_key, surah_number, ayah_number, content, created_at, updated_at, rewayah_id, remote_id, server_updated_at) VALUES ('canonical', 'qf:reader-a', '2:255', 2, 255, 'old', 100, 100, 'warsh', 'remote', 100)`,
    );
    await database.runAsync(
      `INSERT INTO qf_sync_outbox (local_operation_id, owner_scope, account_id, resource, mutation_type, local_id, remote_id, payload_json, base_server_updated_at, created_at, revision, delivery_state) VALUES ('edit', 'qf:reader-a', 'reader-a', 'NOTE', 'UPDATE', 'canonical', 'remote', ?, 100, 150, 1, 'PENDING')`,
      [
        JSON.stringify({
          verseKey: '2:255',
          surahNumber: 2,
          ayahNumber: 255,
          content: 'local edit',
          clientCreatedAt: 100,
          clientUpdatedAt: 150,
        }),
      ],
    );
    await store.applyPage('reader-a', [
      privateNote('remote', 200, 'remote edit'),
    ]);
    const notes = await database.getAllAsync(
      `SELECT content FROM notes WHERE owner_scope = 'qf:reader-a'`,
    );
    expect(notes).toEqual(
      expect.arrayContaining([
        {content: 'local edit'},
        {content: 'remote edit'},
      ]),
    );
    expect(
      await database.getFirstAsync(
        `SELECT mutation_type FROM qf_sync_outbox WHERE owner_scope = 'qf:reader-a'`,
      ),
    ).toEqual({mutation_type: 'CREATE'});
    expect(
      await database.getFirstAsync(
        `SELECT COUNT(*) AS count FROM qf_note_conflicts WHERE resolved_at IS NULL`,
      ),
    ).toEqual({count: 0});
    expect(
      await database.getFirstAsync(`SELECT resolved_at FROM qf_note_conflicts`),
    ).toEqual({resolved_at: expect.any(Number)});
    await database.closeAsync();
  });

  it('keeps account-scoped heads at zero until a compare-and-set commit succeeds', async () => {
    const {database, store} = await createSqliteStore('qf-pull-head.db');

    await expect(store.getStoredHead('reader-a')).resolves.toBe(0);
    await expect(store.commitStableHead('reader-a', 1, 10, 100)).resolves.toBe(
      false,
    );
    await expect(store.commitStableHead('reader-a', 0, 10, 100)).resolves.toBe(
      true,
    );
    await expect(store.getStoredHead('reader-a')).resolves.toBe(10);
    await expect(store.getStoredHead('reader-b')).resolves.toBe(0);

    await database.closeAsync();
  });

  it('applies bookmark, private note, and reading mutations and tombstones in page transactions', async () => {
    const {database, store} = await createSqliteStore('qf-pull-apply.db');
    await database.runAsync(
      `INSERT INTO qf_reading_locations
        (id, owner_scope, remote_id, surah_number, ayah_number, verse_key, page_number, rewayah_id, last_read_at, server_updated_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'local-reading',
        'qf:reader-a',
        'remote-reading-1',
        2,
        1,
        '2:1',
        88,
        'warsh',
        100,
        100,
        100,
        100,
      ],
    );
    const beforeTransactions = database.transactionCount;

    await store.applyPage('reader-a', [
      bookmark('remote-bookmark-1', 200),
      {
        resource: 'NOTE',
        type: 'CREATE',
        resourceId: 'remote-note-1',
        timestamp: 210,
        data: {
          body: 'Private reflection',
          ranges: ['2:255-2:256'],
          saveToQR: false,
          clientCreatedAt: '2026-08-24T00:00:00.000Z',
        },
      },
      {
        resource: 'READING_SESSION',
        type: 'UPDATE',
        resourceId: 'remote-reading-1',
        timestamp: 220,
        data: {chapterNumber: 3, verseNumber: 7},
      },
    ]);

    expect(database.transactionCount - beforeTransactions).toBe(1);
    await expect(
      database.getAllAsync(
        `SELECT remote_id, verse_key, rewayah_id FROM bookmarks WHERE owner_scope = ?`,
        ['qf:reader-a'],
      ),
    ).resolves.toEqual([
      {remote_id: 'remote-bookmark-1', verse_key: '2:255', rewayah_id: 'hafs'},
    ]);
    await expect(
      database.getAllAsync(
        `SELECT remote_id, verse_key, verse_keys, content, rewayah_id FROM notes WHERE owner_scope = ?`,
        ['qf:reader-a'],
      ),
    ).resolves.toEqual([
      {
        remote_id: 'remote-note-1',
        verse_key: '2:255',
        verse_keys: '2:255,2:256',
        content: 'Private reflection',
        rewayah_id: 'hafs',
      },
    ]);
    await expect(
      database.getAllAsync(
        `SELECT remote_id, verse_key, page_number, rewayah_id FROM qf_reading_locations WHERE owner_scope = ?`,
        ['qf:reader-a'],
      ),
    ).resolves.toEqual([
      {
        remote_id: 'remote-reading-1',
        verse_key: '3:7',
        page_number: 88,
        rewayah_id: 'warsh',
      },
    ]);

    await store.applyPage('reader-a', [
      {
        resource: 'BOOKMARK',
        type: 'DELETE',
        resourceId: 'remote-bookmark-1',
        timestamp: 300,
      },
      noteDelete('remote-note-1', 301),
      {
        resource: 'READING_SESSION',
        type: 'DELETE',
        resourceId: 'remote-reading-1',
        timestamp: 302,
      },
    ]);
    await expect(
      database.getFirstAsync<{count: number}>(
        `SELECT
           (SELECT COUNT(*) FROM bookmarks WHERE owner_scope = ?) +
           (SELECT COUNT(*) FROM notes WHERE owner_scope = ?) +
           (SELECT COUNT(*) FROM qf_reading_locations WHERE owner_scope = ?) AS count`,
        ['qf:reader-a', 'qf:reader-a', 'qf:reader-a'],
      ),
    ).resolves.toEqual({count: 0});

    await database.closeAsync();
  });

  it('rolls back the whole page when one remote mutation is invalid', async () => {
    const {database, store} = await createSqliteStore('qf-pull-rollback.db');

    await expect(
      store.applyPage('reader-a', [
        bookmark('remote-bookmark-rollback', 200),
        {
          resource: 'NOTE',
          type: 'CREATE',
          resourceId: 'remote-note-invalid',
          timestamp: 201,
          data: {
            body: 'invalid range',
            ranges: ['2:999-2:999'],
            saveToQR: false,
          },
        },
      ]),
    ).rejects.toThrow('Invalid verse range');
    await expect(
      database.getFirstAsync<{count: number}>(
        `SELECT COUNT(*) AS count FROM bookmarks WHERE owner_scope = ?`,
        ['qf:reader-a'],
      ),
    ).resolves.toEqual({count: 0});

    await database.closeAsync();
  });

  it('updates an exact remote reading row without overwriting a newer local-only row', async () => {
    const {database, store} = await createSqliteStore(
      'qf-pull-reading-identity.db',
    );
    const insert = `INSERT INTO qf_reading_locations
      (id, owner_scope, remote_id, surah_number, ayah_number, verse_key,
       page_number, rewayah_id, last_read_at, server_updated_at, created_at, updated_at)
      VALUES (?, 'qf:reader-a', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    await database.runAsync(insert, [
      'remote-row',
      'remote-reading-1',
      2,
      1,
      '2:1',
      22,
      'hafs',
      100,
      100,
      100,
      100,
    ]);
    await database.runAsync(insert, [
      'local-row',
      null,
      18,
      10,
      '18:10',
      293,
      'warsh',
      900,
      null,
      900,
      900,
    ]);

    await store.applyPage('reader-a', [
      {
        resource: 'READING_SESSION',
        type: 'UPDATE',
        resourceId: 'remote-reading-1',
        timestamp: 200,
        data: {chapterNumber: 3, verseNumber: 7},
      },
    ]);

    await expect(
      database.getAllAsync(
        `SELECT id, remote_id, verse_key, page_number, rewayah_id
         FROM qf_reading_locations WHERE owner_scope = ? ORDER BY id`,
        ['qf:reader-a'],
      ),
    ).resolves.toEqual([
      {
        id: 'local-row',
        remote_id: null,
        verse_key: '18:10',
        page_number: 293,
        rewayah_id: 'warsh',
      },
      {
        id: 'remote-row',
        remote_id: 'remote-reading-1',
        verse_key: '3:7',
        page_number: 22,
        rewayah_id: 'hafs',
      },
    ]);

    await database.closeAsync();
  });

  it('keeps each resource newer replayed update when an older tombstone follows', async () => {
    const {database, store} = await createSqliteStore(
      'qf-pull-stale-tombstone-replay.db',
    );

    await store.applyPage('reader-a', [
      bookmark('remote-bookmark-replay', 300),
      privateNote('remote-note-replay', 301, 'newer remote note'),
      readingSession('remote-reading-replay', 302),
    ]);
    await store.applyPage('reader-a', [
      {
        resource: 'BOOKMARK',
        type: 'DELETE',
        resourceId: 'remote-bookmark-replay',
        timestamp: 200,
      },
      noteDelete('remote-note-replay', 201),
      {
        resource: 'READING_SESSION',
        type: 'DELETE',
        resourceId: 'remote-reading-replay',
        timestamp: 202,
      },
    ]);

    await expect(
      database.getFirstAsync(
        `SELECT remote_id, verse_key, server_updated_at
         FROM bookmarks WHERE owner_scope = ?`,
        ['qf:reader-a'],
      ),
    ).resolves.toEqual({
      remote_id: 'remote-bookmark-replay',
      verse_key: '2:255',
      server_updated_at: 300,
    });
    await expect(
      database.getFirstAsync(
        `SELECT remote_id, content, server_updated_at
         FROM notes WHERE owner_scope = ?`,
        ['qf:reader-a'],
      ),
    ).resolves.toEqual({
      remote_id: 'remote-note-replay',
      content: 'newer remote note',
      server_updated_at: 301,
    });
    await expect(
      database.getFirstAsync(
        `SELECT remote_id, verse_key, server_updated_at
         FROM qf_reading_locations WHERE owner_scope = ?`,
        ['qf:reader-a'],
      ),
    ).resolves.toEqual({
      remote_id: 'remote-reading-replay',
      verse_key: '3:7',
      server_updated_at: 302,
    });

    await database.closeAsync();
  });

  it('keeps a pending note when a tombstone is not newer than its outbox base', async () => {
    const {database, store} = await createSqliteStore(
      'qf-pull-pending-note-tombstone.db',
    );
    await database.runAsync(
      `INSERT INTO notes
        (id, owner_scope, verse_key, surah_number, ayah_number, content,
         created_at, updated_at, rewayah_id, remote_id, server_created_at,
         server_updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'pending-note',
        'qf:reader-a',
        '2:255',
        2,
        255,
        'remote base',
        100,
        100,
        'warsh',
        'remote-note-pending',
        100,
        100,
      ],
    );
    await database.runAsync(
      `INSERT INTO qf_sync_outbox
        (local_operation_id, owner_scope, account_id, resource, mutation_type,
         local_id, remote_id, payload_json, base_server_updated_at, attempts,
         next_attempt_at, created_at, revision, delivery_state)
       VALUES (?, ?, ?, 'NOTE', 'UPDATE', ?, ?, ?, ?, 0, NULL, ?, 1, 'PENDING')`,
      [
        'pending-note-operation',
        'qf:reader-a',
        'reader-a',
        'pending-note',
        'remote-note-pending',
        JSON.stringify({
          verseKey: '2:255',
          surahNumber: 2,
          ayahNumber: 255,
          content: 'pending local note',
          rewayahId: 'warsh',
          clientCreatedAt: 100,
          clientUpdatedAt: 200,
        }),
        200,
        200,
      ],
    );

    await store.applyPage('reader-a', [noteDelete('remote-note-pending', 150)]);

    await expect(
      database.getAllAsync(
        `SELECT id, remote_id, content, server_updated_at
         FROM notes WHERE owner_scope = ?`,
        ['qf:reader-a'],
      ),
    ).resolves.toEqual([
      {
        id: 'pending-note',
        remote_id: 'remote-note-pending',
        content: 'remote base',
        server_updated_at: 100,
      },
    ]);
    await expect(
      database.getAllAsync(
        `SELECT local_operation_id, mutation_type, local_id
         FROM qf_sync_outbox WHERE owner_scope = ?`,
        ['qf:reader-a'],
      ),
    ).resolves.toEqual([
      {
        local_operation_id: 'pending-note-operation',
        mutation_type: 'UPDATE',
        local_id: 'pending-note',
      },
    ]);
    await expect(
      database.getFirstAsync<{count: number}>(
        `SELECT COUNT(*) AS count FROM qf_note_conflicts WHERE owner_scope = ?`,
        ['qf:reader-a'],
      ),
    ).resolves.toEqual({count: 0});

    await database.closeAsync();
  });

  it('preserves bookmark and reading rows while their local outbox intent is pending', async () => {
    const {database, store} = await createSqliteStore(
      'qf-pull-pending-resource-tombstone.db',
    );
    await database.runAsync(
      `INSERT INTO bookmarks
        (id, owner_scope, verse_key, surah_number, ayah_number, created_at,
         rewayah_id, remote_id, server_created_at, server_updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'pending-bookmark',
        'qf:reader-a',
        '2:255',
        2,
        255,
        100,
        'warsh',
        'remote-bookmark-pending',
        100,
        100,
      ],
    );
    await database.runAsync(
      `INSERT INTO qf_reading_locations
        (id, owner_scope, remote_id, surah_number, ayah_number, verse_key,
         page_number, rewayah_id, last_read_at, server_updated_at, created_at,
         updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'pending-reading',
        'qf:reader-a',
        'remote-reading-pending',
        3,
        7,
        '3:7',
        50,
        'warsh',
        150,
        100,
        100,
        150,
      ],
    );
    const outboxInsert = `INSERT INTO qf_sync_outbox
      (local_operation_id, owner_scope, account_id, resource, mutation_type,
       local_id, remote_id, payload_json, base_server_updated_at, attempts,
       next_attempt_at, created_at, revision, delivery_state)
      VALUES (?, 'qf:reader-a', 'reader-a', ?, 'UPDATE', ?, ?, '{}', 100,
              0, NULL, 150, 1, 'PENDING')`;
    await database.runAsync(outboxInsert, [
      'pending-bookmark-operation',
      'BOOKMARK',
      'pending-bookmark',
      'remote-bookmark-pending',
    ]);
    await database.runAsync(outboxInsert, [
      'pending-reading-operation',
      'READING_SESSION',
      'pending-reading',
      'remote-reading-pending',
    ]);

    await store.applyPage('reader-a', [
      {
        resource: 'BOOKMARK',
        type: 'DELETE',
        resourceId: 'remote-bookmark-pending',
        timestamp: 200,
      },
      {
        resource: 'READING_SESSION',
        type: 'DELETE',
        resourceId: 'remote-reading-pending',
        timestamp: 201,
      },
    ]);

    await expect(
      database.getFirstAsync<{count: number}>(
        `SELECT
           (SELECT COUNT(*) FROM bookmarks WHERE owner_scope = ?) +
           (SELECT COUNT(*) FROM qf_reading_locations WHERE owner_scope = ?) AS count`,
        ['qf:reader-a', 'qf:reader-a'],
      ),
    ).resolves.toEqual({count: 2});
    await expect(
      database.getAllAsync(
        `SELECT resource, mutation_type, local_id
         FROM qf_sync_outbox WHERE owner_scope = ? ORDER BY resource`,
        ['qf:reader-a'],
      ),
    ).resolves.toEqual([
      {
        resource: 'BOOKMARK',
        mutation_type: 'UPDATE',
        local_id: 'pending-bookmark',
      },
      {
        resource: 'READING_SESSION',
        mutation_type: 'UPDATE',
        local_id: 'pending-reading',
      },
    ]);

    await database.closeAsync();
  });
});
