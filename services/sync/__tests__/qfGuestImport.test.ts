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
  withExclusiveTransactionAsync(
    task: (db: ExpoSqliteWasmDatabase) => Promise<void>,
  ): Promise<void>;
  closeAsync(): Promise<void>;
};

class ExpoSqliteWasmDatabase implements TestDatabase {
  private readonly dbPromise: Promise<number>;

  constructor(private readonly databaseName: string) {
    this.dbPromise = sqlitePromise.then(({sqlite3}) =>
      sqlite3.open_v2(databaseName),
    );
  }

  async execAsync(source: string): Promise<void> {
    const {sqlite3} = await sqlitePromise;
    const db = await this.dbPromise;
    await sqlite3.exec(db, source);
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
    return {
      changes: sqlite3.changes(db),
      lastInsertRowId: sqlite3.last_insert_rowid(db),
    };
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
    const rows = await this.getAllAsync<T>(source, params);
    return rows[0] ?? null;
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
    task: (db: ExpoSqliteWasmDatabase) => Promise<void>,
  ): Promise<void> {
    const txn = new ExpoSqliteWasmDatabase(this.databaseName);
    // Preserve fixture hooks while executing SQL against the private handle.
    const sharedRun = this.runAsync;
    txn.runAsync = (source, params) => sharedRun.call(txn, source, params);
    try {
      await txn.withTransactionAsync(() => task(txn));
    } finally {
      await txn.closeAsync();
    }
  }

  async closeAsync(): Promise<void> {
    const {sqlite3} = await sqlitePromise;
    const db = await this.dbPromise;
    await sqlite3.close(db);
  }
}

const mockOpenDatabaseAsync = jest.fn(
  async (databaseName: string) => new ExpoSqliteWasmDatabase(databaseName),
);

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: mockOpenDatabaseAsync,
}));

const testRunDatabasePrefix = `qf-guest-import-${Date.now()}-${Math.random()
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
    QfGuestImportService,
  } = require('@/services/sync/qfGuestImportService');
  const database = new VerseAnnotationDatabase(
    `${testRunDatabasePrefix}-${name}`,
  );
  const annotations = new VerseAnnotationDatabaseService(database);
  const guestImport = new QfGuestImportService({
    database,
    now: () => 9000,
    generateId: (() => {
      let value = 0;
      return () => `generated-${++value}`;
    })(),
  });
  await annotations.initialize();
  return {database, annotations, guestImport};
}

describe('QfGuestImportService', () => {
  it('claims guest data and enqueues syncable resources in one at-most-once transaction', async () => {
    const {database, annotations, guestImport} =
      await createServices('merge.db');
    await annotations.addBookmark('2:255', 2, 255, 'warsh');
    await annotations.addNote(
      '18:10',
      18,
      10,
      'Guest reflection',
      ['18:10'],
      'hafs',
    );
    await annotations.upsertHighlight('3:7', 3, 7, 'yellow', 'hafs');

    await expect(guestImport.getOffer('account-a')).resolves.toEqual({
      bookmarkCount: 1,
      noteCount: 1,
      highlightCount: 1,
      totalCount: 3,
    });
    await expect(guestImport.merge('account-a')).resolves.toEqual({
      status: 'merged',
      bookmarkCount: 1,
      noteCount: 1,
      highlightCount: 1,
    });

    await expect(
      annotations.getAllBookmarksInOwnerScope('qf:account-a'),
    ).resolves.toEqual([
      expect.objectContaining({
        ownerScope: 'qf:account-a',
        verseKey: '2:255',
        remoteId: undefined,
      }),
    ]);
    await expect(
      annotations.getAllNotesInOwnerScope('qf:account-a'),
    ).resolves.toEqual([
      expect.objectContaining({
        ownerScope: 'qf:account-a',
        verseKey: '18:10',
        content: 'Guest reflection',
        remoteId: undefined,
      }),
    ]);
    await expect(
      annotations.getHighlightsBySurahInOwnerScope('qf:account-a', 3),
    ).resolves.toEqual([
      expect.objectContaining({ownerScope: 'qf:account-a', verseKey: '3:7'}),
    ]);

    const db = (await database.getConnection()) as TestDatabase;
    const outbox = await db.getAllAsync<{
      account_id: string;
      resource: string;
      delivery_state: string;
      payload_json: string;
    }>(
      `SELECT account_id, resource, delivery_state, payload_json
       FROM qf_sync_outbox WHERE owner_scope = ? ORDER BY resource`,
      ['qf:account-a'],
    );
    expect(outbox.map(row => row.resource)).toEqual(['BOOKMARK', 'NOTE']);
    expect(outbox).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          account_id: 'account-a',
          delivery_state: 'PENDING',
        }),
      ]),
    );
    expect(outbox.map(row => JSON.parse(row.payload_json))).toEqual(
      expect.arrayContaining([
        expect.objectContaining({verseKey: '2:255'}),
        expect.objectContaining({
          verseKey: '18:10',
          content: 'Guest reflection',
        }),
      ]),
    );
    await expect(annotations.getAllBookmarks()).resolves.toHaveLength(0);
    await expect(annotations.getAllNotes()).resolves.toHaveLength(0);
    await expect(annotations.getHighlightsBySurah(3)).resolves.toHaveLength(0);
    await expect(guestImport.getOffer('account-b')).resolves.toBeNull();
    await expect(
      annotations.getAllNotesInOwnerScope('qf:account-b'),
    ).resolves.toEqual([]);
    await expect(guestImport.keepSeparate('account-a')).resolves.toEqual({
      status: 'already_decided',
      decision: 'merge',
    });
    await expect(guestImport.merge('account-a')).resolves.toEqual({
      status: 'already_decided',
      decision: 'merge',
    });
    await expect(
      db.getFirstAsync<{count: number}>(
        `SELECT COUNT(*) AS count FROM qf_sync_outbox WHERE owner_scope = ?`,
        ['qf:account-a'],
      ),
    ).resolves.toEqual({count: 2});
    // An earlier merge covers only the claimed batch, not future guest drafts.
    await annotations.addNote('1:1', 1, 1, 'New guest draft');
    await expect(guestImport.getOffer('account-a')).resolves.toMatchObject({
      noteCount: 1,
      totalCount: 1,
    });
    await expect(guestImport.getOffer('account-b')).resolves.toMatchObject({
      noteCount: 1,
      totalCount: 1,
    });
    await expect(guestImport.merge('account-a')).resolves.toMatchObject({
      status: 'merged',
      noteCount: 1,
    });
    await expect(guestImport.getOffer('account-a')).resolves.toBeNull();
    await expect(annotations.getAllNotes()).resolves.toHaveLength(0);
    await expect(
      annotations.getAllNotesInOwnerScope('qf:account-a'),
    ).resolves.toHaveLength(2);
    await database.close();
  });

  it('records keep-separate explicitly without copying or prompting again', async () => {
    const {database, annotations, guestImport} =
      await createServices('keep-separate.db');
    await annotations.addBookmark('2:255', 2, 255);

    await expect(guestImport.keepSeparate('account-b')).resolves.toEqual({
      status: 'kept_separate',
    });
    await expect(guestImport.getOffer('account-b')).resolves.toBeNull();
    await expect(
      annotations.getAllBookmarksInOwnerScope('qf:account-b'),
    ).resolves.toEqual([]);
    await expect(guestImport.keepSeparate('account-b')).resolves.toEqual({
      status: 'already_decided',
      decision: 'keep_separate',
    });
    await database.close();
  });

  it('offers new rows after keep-separate and merges only the newly consented batch', async () => {
    const {database, annotations, guestImport} = await createServices(
      'new-batch-after-separate.db',
    );
    await annotations.addBookmark('2:255', 2, 255);
    await annotations.addNote('1:1', 1, 1, 'Keep this guest-only');
    await annotations.upsertHighlight('3:7', 3, 7, 'yellow');
    await guestImport.keepSeparate('account-a');
    await expect(guestImport.getOffer('account-a')).resolves.toBeNull();

    await annotations.addBookmark('18:10', 18, 10);
    await annotations.addNote('1:2', 1, 2, 'New guest draft');
    await annotations.upsertHighlight('3:8', 3, 8, 'green');
    await expect(guestImport.getOffer('account-a')).resolves.toEqual({
      bookmarkCount: 1,
      noteCount: 1,
      highlightCount: 1,
      totalCount: 3,
    });
    // Decisions are account-scoped, not global claims on guest-only rows.
    await expect(guestImport.getOffer('account-b')).resolves.toMatchObject({
      totalCount: 6,
    });
    await expect(guestImport.merge('account-a')).resolves.toMatchObject({
      status: 'merged',
      bookmarkCount: 1,
      noteCount: 1,
      highlightCount: 1,
    });
    await expect(annotations.getAllBookmarks()).resolves.toMatchObject([
      {verseKey: '2:255'},
    ]);
    await expect(annotations.getAllNotes()).resolves.toMatchObject([
      {content: 'Keep this guest-only'},
    ]);
    await expect(annotations.getHighlightsBySurah(3)).resolves.toMatchObject([
      {verseKey: '3:7'},
    ]);
    await expect(guestImport.getOffer('account-a')).resolves.toBeNull();
    await expect(guestImport.merge('account-a')).resolves.toEqual({
      status: 'already_decided',
      decision: 'merge',
    });
    // Persisted membership still applies after a service/database reopen.
    await database.close();
    await expect(guestImport.getOffer('account-a')).resolves.toBeNull();
    await annotations.addNote('1:3', 1, 3, 'Third guest batch');
    await expect(guestImport.getOffer('account-a')).resolves.toMatchObject({
      noteCount: 1,
      totalCount: 1,
    });
    await guestImport.keepSeparate('account-a');
    await expect(guestImport.getOffer('account-a')).resolves.toBeNull();
    await database.close();
  });

  it('reconfirms legacy decisions with no batch membership rather than silently importing', async () => {
    const {database, annotations, guestImport} =
      await createServices('legacy-batch.db');
    await annotations.addNote('1:1', 1, 1, 'Unclassified guest draft');
    const db = await database.getConnection();
    await db.runAsync(
      `INSERT INTO qf_guest_imports (id, owner_scope, guest_owner_scope, imported_at)
       VALUES (?, ?, 'guest:keep_separate', 1)`,
      ['guest-decision:account-a', 'qf:account-a'],
    );
    await expect(guestImport.getDecision('account-a')).resolves.toBe(
      'keep_separate',
    );
    await expect(guestImport.getOffer('account-a')).resolves.toMatchObject({
      noteCount: 1,
      totalCount: 1,
    });
    await expect(
      annotations.getAllNotesInOwnerScope('qf:account-a'),
    ).resolves.toEqual([]);
    await guestImport.keepSeparate('account-a');
    await expect(guestImport.getOffer('account-a')).resolves.toBeNull();
    await database.close();
  });

  it('rolls back copied rows, outbox rows, and the decision when enqueue fails', async () => {
    const {database, annotations, guestImport} =
      await createServices('rollback.db');
    await annotations.addBookmark('2:255', 2, 255);
    const db = (await database.getConnection()) as TestDatabase;
    const originalRunAsync = db.runAsync;
    db.runAsync = async function (source, params) {
      if (source.includes('INSERT INTO qf_sync_outbox')) {
        throw new Error('injected enqueue failure');
      }
      return originalRunAsync.call(this, source, params);
    };

    await expect(guestImport.merge('account-c')).rejects.toThrow(
      'injected enqueue failure',
    );
    await expect(
      annotations.getAllBookmarksInOwnerScope('qf:account-c'),
    ).resolves.toEqual([]);
    await expect(guestImport.getDecision('account-c')).resolves.toBeNull();
    await expect(
      db.getFirstAsync<{count: number}>(
        `SELECT COUNT(*) AS count FROM qf_sync_outbox WHERE owner_scope = ?`,
        ['qf:account-c'],
      ),
    ).resolves.toEqual({count: 0});
    await expect(annotations.getAllBookmarks()).resolves.toHaveLength(1);
    await database.close();
  });
});
