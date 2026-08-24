import {
  GUEST_OWNER_SCOPE,
  USER_SYNC_V1_VERSION,
  migrateUserSyncV1,
} from '../migrations/userSyncV1';

type TestDb = {
  execAsync(source: string): Promise<void>;
  runAsync(source: string, params?: unknown[]): Promise<unknown>;
  getAllAsync(
    source: string,
    params?: unknown[],
  ): Promise<Record<string, unknown>[]>;
  getFirstAsync(
    source: string,
    params?: unknown[],
  ): Promise<Record<string, unknown> | null>;
  closeAsync(): Promise<void>;
};

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

class ExpoSqliteWasmDatabase implements TestDb {
  private readonly dbPromise: Promise<number>;

  constructor(databaseName: string) {
    this.dbPromise = sqlitePromise.then(({sqlite3}) =>
      sqlite3.open_v2(databaseName),
    );
  }

  async execAsync(source: string): Promise<void> {
    const {sqlite3} = await sqlitePromise;
    const db = await this.dbPromise;
    await sqlite3.exec(db, source);
  }

  async runAsync(source: string, params: unknown[] = []): Promise<unknown> {
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

  async getAllAsync(
    source: string,
    params: unknown[] = [],
  ): Promise<Record<string, unknown>[]> {
    const {sqlite3, SQLite} = await sqlitePromise;
    const db = await this.dbPromise;
    const rows: Record<string, unknown>[] = [];

    for await (const stmt of sqlite3.statements(db, source)) {
      sqlite3.bind_collection(stmt, params);
      const names = sqlite3.column_names(stmt);

      while ((await sqlite3.step(stmt)) === SQLite.SQLITE_ROW) {
        const values = sqlite3.row(stmt);
        rows.push(
          Object.fromEntries(
            names.map((name: string, index: number) => [name, values[index]]),
          ),
        );
      }
    }

    return rows;
  }

  async getFirstAsync(
    source: string,
    params: unknown[] = [],
  ): Promise<Record<string, unknown> | null> {
    const rows = await this.getAllAsync(source, params);
    return rows[0] ?? null;
  }

  async closeAsync(): Promise<void> {
    const {sqlite3} = await sqlitePromise;
    const db = await this.dbPromise;
    await sqlite3.close(db);
  }
}

async function openTestDb(): Promise<TestDb> {
  return new ExpoSqliteWasmDatabase(`:memory:${Math.random()}`);
}

async function createLegacyAnnotationTables(db: TestDb): Promise<void> {
  await db.execAsync(`
    CREATE TABLE bookmarks (
      id TEXT PRIMARY KEY,
      verse_key TEXT NOT NULL UNIQUE,
      surah_number INTEGER NOT NULL,
      ayah_number INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      rewayah_id TEXT
    );
    CREATE INDEX idx_bookmarks_surah ON bookmarks(surah_number);

    CREATE TABLE notes (
      id TEXT PRIMARY KEY,
      verse_key TEXT NOT NULL,
      surah_number INTEGER NOT NULL,
      ayah_number INTEGER NOT NULL,
      content TEXT NOT NULL,
      verse_keys TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      rewayah_id TEXT
    );
    CREATE INDEX idx_notes_surah ON notes(surah_number);

    CREATE TABLE highlights (
      id TEXT PRIMARY KEY,
      verse_key TEXT NOT NULL UNIQUE,
      surah_number INTEGER NOT NULL,
      ayah_number INTEGER NOT NULL,
      color TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      rewayah_id TEXT
    );
    CREATE INDEX idx_highlights_surah ON highlights(surah_number);
  `);

  await db.runAsync(
    `INSERT INTO bookmarks
       (id, verse_key, surah_number, ayah_number, created_at, rewayah_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    ['bookmark-null-rewayah', '2:255', 2, 255, 1001, null],
  );
  await db.runAsync(
    `INSERT INTO bookmarks
       (id, verse_key, surah_number, ayah_number, created_at, rewayah_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    ['bookmark-renamed-rewayah', '36:1', 36, 1, 1002, 'qumbul'],
  );

  await db.runAsync(
    `INSERT INTO notes
       (id, verse_key, surah_number, ayah_number, content, verse_keys, created_at, updated_at, rewayah_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      'note-null-rewayah',
      '2:255',
      2,
      255,
      'first note',
      '2:255,2:256',
      2001,
      3001,
      null,
    ],
  );
  await db.runAsync(
    `INSERT INTO notes
       (id, verse_key, surah_number, ayah_number, content, verse_keys, created_at, updated_at, rewayah_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      'note-renamed-rewayah',
      '2:255',
      2,
      255,
      'second note on same verse',
      null,
      2002,
      3002,
      'shouba',
    ],
  );
  await db.runAsync(
    `INSERT INTO notes
       (id, verse_key, surah_number, ayah_number, content, verse_keys, created_at, updated_at, rewayah_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      'note-preserved-rewayah',
      '36:1',
      36,
      1,
      'range note',
      '36:1,36:2,36:3',
      2003,
      3003,
      'warsh',
    ],
  );

  await db.runAsync(
    `INSERT INTO highlights
       (id, verse_key, surah_number, ayah_number, color, created_at, rewayah_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ['highlight-renamed-rewayah', '2:255', 2, 255, 'purple', 4001, 'qaloon'],
  );
  await db.runAsync(
    `INSERT INTO highlights
       (id, verse_key, surah_number, ayah_number, color, created_at, rewayah_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ['highlight-null-rewayah', '36:1', 36, 1, 'blue', 4002, null],
  );
}

async function tableNames(db: TestDb): Promise<string[]> {
  const rows = await db.getAllAsync(
    `SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name`,
  );
  return rows.map(row => row.name as string);
}

async function columnNames(db: TestDb, table: string): Promise<string[]> {
  const rows = await db.getAllAsync(`PRAGMA table_info(${table})`);
  return rows.map(row => row.name as string);
}

describe('userSyncV1 annotation migration', () => {
  it('backfills legacy annotations to guest scope and preserves rows, note ranges, timestamps, and rewayah semantics', async () => {
    const db = await openTestDb();
    await createLegacyAnnotationTables(db);

    await migrateUserSyncV1(db);

    await expect(tableNames(db)).resolves.toEqual([
      'bookmarks',
      'highlights',
      'notes',
      'qf_guest_imports',
      'qf_note_conflicts',
      'qf_reading_locations',
      'qf_sync_outbox',
      'qf_sync_state',
      'schema_migrations',
    ]);

    await expect(
      db.getAllAsync(
        `SELECT id, owner_scope, verse_key, surah_number, ayah_number, created_at, rewayah_id, remote_id, server_created_at, server_updated_at
         FROM bookmarks
         ORDER BY id`,
      ),
    ).resolves.toEqual([
      {
        id: 'bookmark-null-rewayah',
        owner_scope: GUEST_OWNER_SCOPE,
        verse_key: '2:255',
        surah_number: 2,
        ayah_number: 255,
        created_at: 1001,
        rewayah_id: 'hafs',
        remote_id: null,
        server_created_at: null,
        server_updated_at: null,
      },
      {
        id: 'bookmark-renamed-rewayah',
        owner_scope: GUEST_OWNER_SCOPE,
        verse_key: '36:1',
        surah_number: 36,
        ayah_number: 1,
        created_at: 1002,
        rewayah_id: 'qunbul',
        remote_id: null,
        server_created_at: null,
        server_updated_at: null,
      },
    ]);

    await expect(
      db.getAllAsync(
        `SELECT id, owner_scope, verse_key, content, verse_keys, created_at, updated_at, rewayah_id, remote_id, server_created_at, server_updated_at
         FROM notes
         ORDER BY id`,
      ),
    ).resolves.toEqual([
      {
        id: 'note-null-rewayah',
        owner_scope: GUEST_OWNER_SCOPE,
        verse_key: '2:255',
        content: 'first note',
        verse_keys: '2:255,2:256',
        created_at: 2001,
        updated_at: 3001,
        rewayah_id: 'hafs',
        remote_id: null,
        server_created_at: null,
        server_updated_at: null,
      },
      {
        id: 'note-preserved-rewayah',
        owner_scope: GUEST_OWNER_SCOPE,
        verse_key: '36:1',
        content: 'range note',
        verse_keys: '36:1,36:2,36:3',
        created_at: 2003,
        updated_at: 3003,
        rewayah_id: 'warsh',
        remote_id: null,
        server_created_at: null,
        server_updated_at: null,
      },
      {
        id: 'note-renamed-rewayah',
        owner_scope: GUEST_OWNER_SCOPE,
        verse_key: '2:255',
        content: 'second note on same verse',
        verse_keys: null,
        created_at: 2002,
        updated_at: 3002,
        rewayah_id: 'shubah',
        remote_id: null,
        server_created_at: null,
        server_updated_at: null,
      },
    ]);

    await expect(
      db.getAllAsync(
        `SELECT id, owner_scope, verse_key, color, created_at, rewayah_id
         FROM highlights
         ORDER BY id`,
      ),
    ).resolves.toEqual([
      {
        id: 'highlight-null-rewayah',
        owner_scope: GUEST_OWNER_SCOPE,
        verse_key: '36:1',
        color: 'blue',
        created_at: 4002,
        rewayah_id: 'hafs',
      },
      {
        id: 'highlight-renamed-rewayah',
        owner_scope: GUEST_OWNER_SCOPE,
        verse_key: '2:255',
        color: 'purple',
        created_at: 4001,
        rewayah_id: 'qalun',
      },
    ]);

    await expect(
      db.getFirstAsync(`SELECT version FROM schema_migrations`),
    ).resolves.toEqual({version: USER_SYNC_V1_VERSION});
  });

  it('is rerun safe and enforces bookmark uniqueness only within an owner scope', async () => {
    const db = await openTestDb();
    await createLegacyAnnotationTables(db);
    await migrateUserSyncV1(db);

    await migrateUserSyncV1(db);

    await expect(
      db.getAllAsync(`SELECT version FROM schema_migrations`),
    ).resolves.toEqual([{version: USER_SYNC_V1_VERSION}]);
    await expect(
      db.getFirstAsync(`SELECT COUNT(*) AS count FROM bookmarks`),
    ).resolves.toEqual({count: 2});

    await db.runAsync(
      `INSERT INTO bookmarks
         (id, owner_scope, verse_key, surah_number, ayah_number, created_at, rewayah_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ['account-a-bookmark', 'qf:account-a', '2:255', 2, 255, 5001, 'hafs'],
    );
    await db.runAsync(
      `INSERT INTO bookmarks
         (id, owner_scope, verse_key, surah_number, ayah_number, created_at, rewayah_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ['account-b-bookmark', 'qf:account-b', '2:255', 2, 255, 5002, 'hafs'],
    );

    await expect(
      db.runAsync(
        `INSERT INTO bookmarks
           (id, owner_scope, verse_key, surah_number, ayah_number, created_at, rewayah_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          'duplicate-guest-bookmark',
          GUEST_OWNER_SCOPE,
          '2:255',
          2,
          255,
          5003,
          'hafs',
        ],
      ),
    ).rejects.toThrow();

    await expect(
      db.getAllAsync(
        `SELECT owner_scope, verse_key
         FROM bookmarks
         WHERE verse_key = ?
         ORDER BY owner_scope`,
        ['2:255'],
      ),
    ).resolves.toEqual([
      {owner_scope: GUEST_OWNER_SCOPE, verse_key: '2:255'},
      {owner_scope: 'qf:account-a', verse_key: '2:255'},
      {owner_scope: 'qf:account-b', verse_key: '2:255'},
    ]);
  });

  it('rolls back all schema and data changes when migration DDL fails before recording the version', async () => {
    const db = await openTestDb();
    await createLegacyAnnotationTables(db);
    let injected = false;
    const failingDb = Object.create(db) as TestDb;
    failingDb.execAsync = async (source: string) => {
      if (!injected && source.includes('CREATE TABLE notes (')) {
        injected = true;
        throw new Error('injected migration DDL failure');
      }
      return db.execAsync(source);
    };

    await expect(migrateUserSyncV1(failingDb)).rejects.toThrow(
      'injected migration DDL failure',
    );

    await expect(tableNames(db)).resolves.toEqual([
      'bookmarks',
      'highlights',
      'notes',
    ]);
    await expect(columnNames(db, 'bookmarks')).resolves.not.toContain(
      'owner_scope',
    );
    await expect(
      db.getAllAsync(
        `SELECT id, verse_key, created_at, rewayah_id FROM bookmarks ORDER BY id`,
      ),
    ).resolves.toEqual([
      {
        id: 'bookmark-null-rewayah',
        verse_key: '2:255',
        created_at: 1001,
        rewayah_id: null,
      },
      {
        id: 'bookmark-renamed-rewayah',
        verse_key: '36:1',
        created_at: 1002,
        rewayah_id: 'qumbul',
      },
    ]);
  });
});
