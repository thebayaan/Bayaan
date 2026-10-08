import {
  GUEST_OWNER_SCOPE,
  USER_SYNC_V1_VERSION,
  migrateUserSyncV1,
} from '../migrations/userSyncV1';
import {
  USER_SYNC_V2_VERSION,
  migrateUserSyncV2,
} from '../migrations/userSyncV2';

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

async function createLegacyAnnotationTables(
  db: TestDb,
  notesSchemaExtension = '',
  notesTableOptions = '',
  contentDefinition = 'TEXT NOT NULL',
): Promise<void> {
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
      content ${contentDefinition},
      verse_keys TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      rewayah_id TEXT${notesSchemaExtension}
    )${notesTableOptions};
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

async function createOlderLegacyAnnotationTables(db: TestDb): Promise<void> {
  await db.execAsync(`
    CREATE TABLE bookmarks (
      id TEXT PRIMARY KEY,
      verse_key TEXT NOT NULL UNIQUE,
      surah_number INTEGER NOT NULL,
      ayah_number INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX idx_bookmarks_surah ON bookmarks(surah_number);

    CREATE TABLE notes (
      id TEXT PRIMARY KEY,
      verse_key TEXT NOT NULL,
      surah_number INTEGER NOT NULL,
      ayah_number INTEGER NOT NULL,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX idx_notes_surah ON notes(surah_number);

    CREATE TABLE highlights (
      id TEXT PRIMARY KEY,
      verse_key TEXT NOT NULL UNIQUE,
      surah_number INTEGER NOT NULL,
      ayah_number INTEGER NOT NULL,
      color TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX idx_highlights_surah ON highlights(surah_number);
  `);

  await db.runAsync(
    `INSERT INTO bookmarks
       (id, verse_key, surah_number, ayah_number, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    ['older-bookmark', '18:10', 18, 10, 1101],
  );

  await db.runAsync(
    `INSERT INTO notes
       (id, verse_key, surah_number, ayah_number, content, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      'older-note',
      '18:10',
      18,
      10,
      'legacy note without range columns',
      2101,
      3101,
    ],
  );

  await db.runAsync(
    `INSERT INTO highlights
       (id, verse_key, surah_number, ayah_number, color, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    ['older-highlight', '18:10', 18, 10, 'green', 4101],
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

async function expectMigrationRollback(
  db: TestDb,
  message: string,
): Promise<void> {
  const schema = await db.getAllAsync(
    'SELECT type, name, tbl_name, sql FROM sqlite_master ORDER BY type, name',
  );
  const rows = await Promise.all(
    ['bookmarks', 'notes', 'highlights'].map(table =>
      db.getAllAsync(`SELECT * FROM ${table} ORDER BY id`),
    ),
  );
  await expect(migrateUserSyncV1(db)).rejects.toThrow(message);
  await expect(
    db.getAllAsync(
      'SELECT type, name, tbl_name, sql FROM sqlite_master ORDER BY type, name',
    ),
  ).resolves.toEqual(schema);
  for (const [index, table] of ['bookmarks', 'notes', 'highlights'].entries()) {
    await expect(
      db.getAllAsync(`SELECT * FROM ${table} ORDER BY id`),
    ).resolves.toEqual(rows[index]);
  }
}

describe('userSyncV1 annotation migration', () => {
  it('maps legacy IDs exactly while preserving canonical IDs in every annotation table', async () => {
    const {
      PERSISTED_ID_MIGRATIONS,
    } = require('@/services/rewayah/RewayahIdentity');
    const db = await openTestDb();
    await createLegacyAnnotationTables(db);
    await db.execAsync(
      'DELETE FROM bookmarks; DELETE FROM notes; DELETE FROM highlights;',
    );
    const cases = new Map<string, string>(
      Object.entries(PERSISTED_ID_MIGRATIONS),
    );
    for (const id of Object.values(PERSISTED_ID_MIGRATIONS) as string[])
      cases.set(id, id);
    let ayah = 0;
    for (const [id] of cases) {
      ayah += 1;
      for (const table of ['bookmarks', 'notes', 'highlights']) {
        const extraColumns =
          table === 'notes'
            ? ', content, updated_at'
            : table === 'highlights'
              ? ', color'
              : '';
        const extraValues =
          table === 'notes'
            ? ", 'note', 100"
            : table === 'highlights'
              ? ", 'blue'"
              : '';
        await db.runAsync(
          `INSERT INTO ${table} (id, verse_key, surah_number, ayah_number, created_at, rewayah_id${extraColumns}) VALUES (?, ?, 2, ?, 100, ?${extraValues})`,
          [id, `2:${ayah}`, ayah, id],
        );
      }
    }
    await migrateUserSyncV1(db);
    for (const table of ['bookmarks', 'notes', 'highlights']) {
      const rows = await db.getAllAsync(`SELECT id, rewayah_id FROM ${table}`);
      expect(rows).toHaveLength(cases.size);
      for (const row of rows)
        expect(row.rewayah_id).toBe(cases.get(String(row.id)));
    }
    await db.closeAsync();
  });
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

  it('migrates older legacy annotation tables that predate verse_keys and rewayah_id columns', async () => {
    const db = await openTestDb();
    await createOlderLegacyAnnotationTables(db);

    await migrateUserSyncV1(db);

    await expect(
      db.getAllAsync(
        `SELECT id, owner_scope, verse_key, rewayah_id
         FROM bookmarks
         ORDER BY id`,
      ),
    ).resolves.toEqual([
      {
        id: 'older-bookmark',
        owner_scope: GUEST_OWNER_SCOPE,
        verse_key: '18:10',
        rewayah_id: 'hafs',
      },
    ]);

    await expect(
      db.getAllAsync(
        `SELECT id, owner_scope, verse_key, content, verse_keys, rewayah_id
         FROM notes
         ORDER BY id`,
      ),
    ).resolves.toEqual([
      {
        id: 'older-note',
        owner_scope: GUEST_OWNER_SCOPE,
        verse_key: '18:10',
        content: 'legacy note without range columns',
        verse_keys: null,
        rewayah_id: 'hafs',
      },
    ]);

    await expect(
      db.getAllAsync(
        `SELECT id, owner_scope, verse_key, color, rewayah_id
         FROM highlights
         ORDER BY id`,
      ),
    ).resolves.toEqual([
      {
        id: 'older-highlight',
        owner_scope: GUEST_OWNER_SCOPE,
        verse_key: '18:10',
        color: 'green',
        rewayah_id: 'hafs',
      },
    ]);
  });

  it('preserves fork-owned columns, values and basic definitions in all annotation tables', async () => {
    const db = await openTestDb();
    try {
      await createLegacyAnnotationTables(db);
      for (const table of ['bookmarks', 'notes', 'highlights']) {
        await db.execAsync(`
          ALTER TABLE ${table} ADD COLUMN qf_note_id TEXT;
          ALTER TABLE ${table} ADD COLUMN qf_post_id INTEGER;
          ALTER TABLE ${table} ADD COLUMN fork_counter INTEGER NOT NULL DEFAULT 7;
          ALTER TABLE ${table} ADD COLUMN "fork ""metadata" BLOB;
          UPDATE ${table} SET qf_note_id = 'qariah-' || id,
            qf_post_id = 42, fork_counter = 9, "fork ""metadata" = X'00FF';
        `);
      }
      await db.execAsync(`UPDATE notes SET qf_note_id = NULL, qf_post_id = NULL
        WHERE id = 'note-null-rewayah';`);

      const snapshots = [];
      for (const table of ['bookmarks', 'notes', 'highlights']) {
        snapshots.push({
          table,
          rows: await db.getAllAsync(`SELECT id, qf_note_id, qf_post_id,
            fork_counter, hex("fork ""metadata") AS metadata FROM ${table} ORDER BY id`),
          columns:
            await db.getAllAsync(`SELECT name, type, "notnull", dflt_value, pk
            FROM pragma_table_info('${table}') WHERE name LIKE 'qf_%' OR name LIKE 'fork%'`),
        });
      }
      await migrateUserSyncV1(db);
      await migrateUserSyncV1(db);
      for (const snapshot of snapshots) {
        await expect(
          db.getAllAsync(`SELECT id, qf_note_id, qf_post_id,
          fork_counter, hex("fork ""metadata") AS metadata FROM ${snapshot.table} ORDER BY id`),
        ).resolves.toEqual(snapshot.rows);
        await expect(
          db.getAllAsync(`SELECT name, type, "notnull", dflt_value, pk
          FROM pragma_table_info('${snapshot.table}') WHERE name LIKE 'qf_%' OR name LIKE 'fork%'`),
        ).resolves.toEqual(snapshot.columns);
        await expect(
          db.getAllAsync(
            `SELECT owner_scope, remote_id FROM ${snapshot.table}`,
          ),
        ).resolves.toEqual(
          snapshot.rows.map(() => ({owner_scope: 'guest', remote_id: null})),
        );
      }
      await db.execAsync(`INSERT INTO notes
        (id, verse_key, surah_number, ayah_number, content, created_at, updated_at)
        VALUES ('new-note', '1:1', 1, 1, 'new', 1, 1);`);
      await expect(
        db.getFirstAsync(`SELECT qf_note_id, qf_post_id, fork_counter,
        "fork ""metadata" AS metadata FROM notes WHERE id = 'new-note'`),
      ).resolves.toEqual({
        qf_note_id: null,
        qf_post_id: null,
        fork_counter: 7,
        metadata: null,
      });
      await expect(
        db.execAsync(
          `UPDATE notes SET fork_counter = NULL WHERE id = 'new-note';`,
        ),
      ).rejects.toThrow();
    } finally {
      await db.closeAsync();
    }
  });

  it.each(['inline', 'table', 'index'])(
    'preserves fork %s uniqueness, checks, collation and expression defaults',
    async uniqueKind => {
      const db = await openTestDb();
      try {
        await db.execAsync(
          'PRAGMA foreign_keys = ON; CREATE TABLE fork_labels (id TEXT PRIMARY KEY);',
        );
        await createLegacyAnnotationTables(
          db,
          `,
          qf_note_id TEXT COLLATE NOCASE ${uniqueKind === 'inline' ? 'UNIQUE' : ''},
          qf_post_id TEXT CHECK (qf_post_id IS NULL OR length(qf_post_id) > 0),
          fork_created INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
          fork_label TEXT REFERENCES fork_labels(id),
          "fork,details" TEXT DEFAULT ('x,y(' || 'z)')
          ${uniqueKind === 'table' ? ', CONSTRAINT fork_note_unique UNIQUE(qf_note_id)' : ''}
        `,
        );
        if (uniqueKind === 'index') {
          await db.execAsync(
            'CREATE UNIQUE INDEX fork_note_unique ON notes(qf_note_id);',
          );
        }
        await db.execAsync(`UPDATE notes SET qf_note_id = 'fork-' || id;`);
        const before = await db.getAllAsync(`SELECT id, qf_note_id, qf_post_id,
          fork_created, fork_label, "fork,details" FROM notes ORDER BY id`);
        await migrateUserSyncV1(db);
        await expect(
          db.getAllAsync(`SELECT id, qf_note_id, qf_post_id,
          fork_created, fork_label, "fork,details" FROM notes ORDER BY id`),
        ).resolves.toEqual(before);
        await expect(
          db.execAsync(`UPDATE notes SET qf_note_id = 'FORK-NOTE-NULL-REWAYAH'
          WHERE id = 'note-renamed-rewayah';`),
        ).rejects.toThrow();
        await expect(
          db.execAsync(`UPDATE notes SET qf_post_id = ''`),
        ).rejects.toThrow();
        await expect(
          db.execAsync(`UPDATE notes SET fork_label = 'missing-label'`),
        ).rejects.toThrow();
        await expect(
          db.getAllAsync('PRAGMA foreign_key_list(notes)'),
        ).resolves.toEqual([
          expect.objectContaining({
            table: 'fork_labels',
            from: 'fork_label',
            to: 'id',
          }),
        ]);
        await db.execAsync(`INSERT INTO notes
          (id, verse_key, surah_number, ayah_number, content, created_at, updated_at)
          VALUES ('fork-new', '1:1', 1, 1, 'new', 1, 1);`);
        await expect(
          db.getFirstAsync(`SELECT fork_created, "fork,details" AS details
          FROM notes WHERE id = 'fork-new'`),
        ).resolves.toEqual({
          fork_created: expect.any(Number),
          details: 'x,y(z)',
        });
        await migrateUserSyncV1(db);
      } finally {
        await db.closeAsync();
      }
    },
  );

  it.each(['check', 'column'])(
    'does not let SQL line comments swallow a following %s',
    async kind => {
      const db = await openTestDb();
      try {
        await createLegacyAnnotationTables(
          db,
          `,
        fork_a TEXT DEFAULT 'literal--/*kept*/' -- trailing comment with , )
        , ${kind === 'check' ? "CHECK(fork_a <> '')" : "fork_b TEXT DEFAULT 'second--value'"}
        /* a block comment with , ) */
      `,
        );
        await migrateUserSyncV1(db);
        await expect(
          db.getFirstAsync('SELECT fork_a FROM notes LIMIT 1'),
        ).resolves.toEqual({fork_a: 'literal--/*kept*/'});
        if (kind === 'check') {
          await expect(
            db.execAsync("UPDATE notes SET fork_a = '';"),
          ).rejects.toThrow();
        } else {
          await expect(
            db.getFirstAsync('SELECT fork_b FROM notes LIMIT 1'),
          ).resolves.toEqual({fork_b: 'second--value'});
        }
      } finally {
        await db.closeAsync();
      }
    },
  );

  it.each(['STRICT', 'WITHOUT ROWID'])(
    'rejects %s table options without changing schema or data',
    async options => {
      const db = await openTestDb();
      try {
        await createLegacyAnnotationTables(db, '', ` ${options}`);
        await expectMigrationRollback(db, 'legacy table options');
      } finally {
        await db.closeAsync();
      }
    },
  );

  it.each([
    ['remote_id', 'TEXT', 'qf-123'],
    ['REMOTE_ID', 'TEXT', ''],
    ['owner_scope', 'TEXT', 'qariah:reader'],
    ['server_created_at', 'INTEGER', 0],
    ['server_updated_at', 'INTEGER', 42],
  ])(
    'rejects populated fork field %s before it can be overwritten',
    async (name, type, value) => {
      const db = await openTestDb();
      try {
        await createLegacyAnnotationTables(db);
        await db.execAsync(`ALTER TABLE notes ADD COLUMN "${name}" ${type};`);
        await db.runAsync(`UPDATE notes SET "${name}" = ? WHERE id = ?`, [
          value,
          'note-null-rewayah',
        ]);
        await expectMigrationRollback(db, 'Populated fork column collides');
      } finally {
        await db.closeAsync();
      }
    },
  );

  it('allows existing sync-name fields when every legacy value is NULL', async () => {
    const db = await openTestDb();
    try {
      await createLegacyAnnotationTables(
        db,
        ', remote_id TEXT, owner_scope TEXT, server_created_at INTEGER, server_updated_at INTEGER',
      );
      await migrateUserSyncV1(db);
      await expect(
        db.getAllAsync(
          'SELECT owner_scope, remote_id, server_created_at, server_updated_at FROM notes',
        ),
      ).resolves.toEqual(
        Array.from({length: 3}, () => ({
          owner_scope: 'guest',
          remote_id: null,
          server_created_at: null,
          server_updated_at: null,
        })),
      );
    } finally {
      await db.closeAsync();
    }
  });

  it.each([
    [
      'trigger',
      `CREATE TRIGGER fork_note_changes AFTER INSERT ON notes BEGIN UPDATE notes SET updated_at = 99 WHERE id = new.id; END;`,
    ],
    ['view', 'CREATE VIEW fork_notes_view AS SELECT id, content FROM notes;'],
    [
      'trigger',
      `CREATE TABLE fork_log (id TEXT); CREATE TRIGGER fork_log_changes AFTER INSERT ON fork_log BEGIN DELETE FROM notes WHERE id = new.id; END;`,
    ],
    [
      'view',
      'CREATE VIEW fork_inner AS SELECT id FROM notes; CREATE VIEW fork_outer AS SELECT id FROM fork_inner;',
    ],
  ])(
    'rejects dependent annotation %s without dropping user objects',
    async (kind, sql) => {
      const db = await openTestDb();
      try {
        await createLegacyAnnotationTables(db);
        await db.execAsync(sql);
        await expectMigrationRollback(db, `annotation ${kind}s`);
      } finally {
        await db.closeAsync();
      }
    },
  );

  it('leaves unrelated fork triggers and views intact', async () => {
    const db = await openTestDb();
    try {
      await createLegacyAnnotationTables(db);
      await db.execAsync(`CREATE TABLE fork_log (id TEXT); CREATE VIEW fork_log_view AS SELECT id FROM fork_log;
        CREATE TRIGGER fork_log_changes AFTER INSERT ON fork_log BEGIN DELETE FROM fork_log WHERE id = 'old'; END;`);
      const before = await db.getAllAsync(
        "SELECT name, sql FROM sqlite_master WHERE type IN ('trigger', 'view') ORDER BY name",
      );
      await migrateUserSyncV1(db);
      await expect(
        db.getAllAsync(
          "SELECT name, sql FROM sqlite_master WHERE type IN ('trigger', 'view') ORDER BY name",
        ),
      ).resolves.toEqual(before);
    } finally {
      await db.closeAsync();
    }
  });

  it('preserves known-only and mixed fork indexes, including ordering, collation and predicates', async () => {
    const db = await openTestDb();
    try {
      await createLegacyAnnotationTables(db, ', qf_note_id TEXT');
      await db.execAsync(`CREATE UNIQUE INDEX fork_content ON notes(content);
        CREATE INDEX fork_mixed ON notes(verse_key COLLATE NOCASE, qf_note_id DESC) WHERE qf_note_id IS NOT NULL;`);
      const before = await db.getAllAsync(
        "SELECT name, sql FROM sqlite_master WHERE type = 'index' AND name LIKE 'fork_%' ORDER BY name",
      );
      const mixed = await db.getAllAsync('PRAGMA index_xinfo(fork_mixed)');
      await migrateUserSyncV1(db);
      await expect(
        db.getAllAsync(
          "SELECT name, sql FROM sqlite_master WHERE type = 'index' AND name LIKE 'fork_%' ORDER BY name",
        ),
      ).resolves.toEqual(before);
      // Extra fields move after Bayaan's newly added columns; numeric column ids
      // change, but names, ordering, collation and key membership must not.
      const withoutCid = (rows: Record<string, unknown>[]) =>
        rows.map(({cid: _cid, ...rest}) => rest);
      expect(
        withoutCid(await db.getAllAsync('PRAGMA index_xinfo(fork_mixed)')),
      ).toEqual(withoutCid(mixed));
      await expect(
        db.execAsync(
          "UPDATE notes SET content = 'first note' WHERE id = 'note-renamed-rewayah';",
        ),
      ).rejects.toThrow();
    } finally {
      await db.closeAsync();
    }
  });

  it('preserves table-level fork constraints on standard columns', async () => {
    const db = await openTestDb();
    try {
      await createLegacyAnnotationTables(
        db,
        ', CONSTRAINT fork_unique_content UNIQUE(content), CHECK(length(content) > 0)',
      );
      await migrateUserSyncV1(db);
      await expect(
        db.execAsync(
          "UPDATE notes SET content = 'first note' WHERE id = 'note-renamed-rewayah';",
        ),
      ).rejects.toThrow();
      await expect(
        db.execAsync("UPDATE notes SET content = '';"),
      ).rejects.toThrow();
    } finally {
      await db.closeAsync();
    }
  });

  it.each([
    'TEXT NOT NULL UNIQUE',
    'TEXT NOT NULL COLLATE NOCASE',
    'TEXT NOT NULL CHECK(length(content) > 0)',
  ])(
    'rejects modified standard inline definitions instead of dropping %s',
    async definition => {
      const db = await openTestDb();
      try {
        await createLegacyAnnotationTables(db, '', '', definition);
        await expectMigrationRollback(db, 'modified standard column: content');
      } finally {
        await db.closeAsync();
      }
    },
  );

  it('removes only a legacy explicit global verse index, keeping other constraints', async () => {
    const db = await openTestDb();
    try {
      await createLegacyAnnotationTables(db);
      await db.execAsync(
        'CREATE UNIQUE INDEX legacy_verse ON bookmarks(verse_key);',
      );
      await migrateUserSyncV1(db);
      await db.execAsync(`INSERT INTO bookmarks (id, owner_scope, verse_key, surah_number, ayah_number, created_at)
        VALUES ('account-verse', 'qf:reader', '2:255', 2, 255, 10);`);
      await expect(
        db.getFirstAsync(
          "SELECT name FROM sqlite_master WHERE name = 'legacy_verse'",
        ),
      ).resolves.toBeNull();
      await expect(
        db.execAsync(`INSERT INTO bookmarks (id, owner_scope, verse_key, surah_number, ayah_number, created_at)
        VALUES ('duplicate', 'guest', '2:255', 2, 255, 11);`),
      ).rejects.toThrow();
    } finally {
      await db.closeAsync();
    }
  });

  it('rejects incoming annotation foreign keys before a rename can cascade fork data', async () => {
    const db = await openTestDb();
    try {
      await createLegacyAnnotationTables(db);
      await db.execAsync(`PRAGMA foreign_keys = ON;
        CREATE TABLE fork_links (note_id TEXT REFERENCES notes(id) ON DELETE CASCADE);
        INSERT INTO fork_links VALUES ('note-null-rewayah');`);
      const notes = await db.getAllAsync('SELECT * FROM notes ORDER BY id');
      await expect(migrateUserSyncV1(db)).rejects.toThrow(
        'foreign keys referencing annotations',
      );
      await expect(
        db.getAllAsync('SELECT * FROM notes ORDER BY id'),
      ).resolves.toEqual(notes);
      await expect(db.getAllAsync('SELECT * FROM fork_links')).resolves.toEqual(
        [{note_id: 'note-null-rewayah'}],
      );
      await expect(columnNames(db, 'bookmarks')).resolves.not.toContain(
        'owner_scope',
      );
    } finally {
      await db.closeAsync();
    }
  });

  it('rolls back rather than silently dropping an unsupported fork generated column', async () => {
    const db = await openTestDb();
    try {
      await createLegacyAnnotationTables(db);
      await db.execAsync(`ALTER TABLE notes ADD COLUMN fork_summary TEXT
        GENERATED ALWAYS AS (content || '!') VIRTUAL;`);
      const before = await db.getAllAsync('SELECT * FROM notes ORDER BY id');
      await expect(migrateUserSyncV1(db)).rejects.toThrow(
        'Cannot safely rebuild',
      );
      await expect(
        db.getAllAsync('SELECT * FROM notes ORDER BY id'),
      ).resolves.toEqual(before);
      await expect(columnNames(db, 'bookmarks')).resolves.not.toContain(
        'owner_scope',
      );
      await expect(tableNames(db)).resolves.toEqual([
        'bookmarks',
        'highlights',
        'notes',
      ]);
    } finally {
      await db.closeAsync();
    }
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

describe('userSyncV2 outbox delivery-state migration', () => {
  it('preserves existing operations as ambiguous durable revisions and is rerun safe', async () => {
    const db = await openTestDb();
    await migrateUserSyncV1(db);
    await db.runAsync(
      `INSERT INTO qf_sync_outbox (
         local_operation_id, owner_scope, account_id, resource, mutation_type,
         local_id, remote_id, payload_json, base_server_updated_at, attempts,
         next_attempt_at, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'legacy-operation',
        'qf:reader-a',
        'reader-a',
        'NOTE',
        'CREATE',
        'local-note',
        null,
        '{"content":"possibly sent"}',
        null,
        0,
        null,
        5001,
      ],
    );

    await migrateUserSyncV2(db);
    await migrateUserSyncV2(db);

    await expect(
      db.getFirstAsync(
        `SELECT revision, delivery_state, in_flight_revision,
                in_flight_mutation_type, in_flight_payload_json,
                in_flight_started_at
         FROM qf_sync_outbox
         WHERE local_operation_id = ?`,
        ['legacy-operation'],
      ),
    ).resolves.toEqual({
      revision: 1,
      delivery_state: 'AMBIGUOUS',
      in_flight_revision: null,
      in_flight_mutation_type: null,
      in_flight_payload_json: null,
      in_flight_started_at: null,
    });
    await expect(
      db.getAllAsync(`SELECT version FROM schema_migrations ORDER BY version`),
    ).resolves.toEqual([
      {version: USER_SYNC_V1_VERSION},
      {version: USER_SYNC_V2_VERSION},
    ]);

    await db.closeAsync();
  });
});
