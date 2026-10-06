import {PERSISTED_ID_MIGRATIONS} from '@/services/rewayah/RewayahIdentity';

export const USER_SYNC_V1_VERSION = 'user_sync_v1';
export const GUEST_OWNER_SCOPE = 'guest';

type SQLiteLikeDatabase = {
  execAsync(source: string): Promise<void>;
  getAllAsync?(
    source: string,
    params?: unknown[] | Record<string, unknown>,
  ): Promise<unknown[]>;
  getFirstAsync(
    source: string,
    params?: unknown[] | Record<string, unknown>,
  ): Promise<unknown | null>;
};

interface MigrationRow {
  version: string;
}

interface TableRow {
  name: string;
}

interface TableInfoRow {
  name: string;
}

function canonicalRewayahSql(columnName: string): string {
  const value = `COALESCE(${columnName}, 'hafs')`;
  const mappings = Object.entries(PERSISTED_ID_MIGRATIONS)
    .filter(([oldId, newId]) => oldId !== newId)
    .map(([oldId, newId]) => `WHEN '${oldId}' THEN '${newId}'`);
  return `CASE ${value} ${mappings.join(' ')} ELSE ${value} END`;
}

async function tableExists(
  db: SQLiteLikeDatabase,
  tableName: string,
): Promise<boolean> {
  const row = (await db.getFirstAsync(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`,
    [tableName],
  )) as TableRow | null;
  return row !== null;
}

async function hasMigration(db: SQLiteLikeDatabase): Promise<boolean> {
  if (!(await tableExists(db, 'schema_migrations'))) return false;
  const row = (await db.getFirstAsync(
    `SELECT version FROM schema_migrations WHERE version = ?`,
    [USER_SYNC_V1_VERSION],
  )) as MigrationRow | null;
  return row?.version === USER_SYNC_V1_VERSION;
}

async function getTableColumns(
  db: SQLiteLikeDatabase,
  tableName: string,
): Promise<Set<string>> {
  if (!db.getAllAsync) {
    throw new Error(
      'Database does not support getAllAsync required for migration',
    );
  }

  const rows = (await db.getAllAsync(
    `PRAGMA table_info(${tableName})`,
  )) as TableInfoRow[];
  return new Set(rows.map(row => row.name));
}

function legacyRewayahSelect(columns: Set<string>): string {
  return columns.has('rewayah_id')
    ? canonicalRewayahSql('rewayah_id')
    : `'hafs'`;
}

function legacyVerseKeysSelect(columns: Set<string>): string {
  return columns.has('verse_keys') ? 'verse_keys' : 'NULL';
}

async function createFreshBookmarks(db: SQLiteLikeDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE bookmarks (
      id TEXT PRIMARY KEY,
      owner_scope TEXT NOT NULL DEFAULT '${GUEST_OWNER_SCOPE}',
      verse_key TEXT NOT NULL,
      surah_number INTEGER NOT NULL,
      ayah_number INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      rewayah_id TEXT NOT NULL DEFAULT 'hafs',
      remote_id TEXT,
      server_created_at INTEGER,
      server_updated_at INTEGER
    );
  `);
}

async function createFreshNotes(db: SQLiteLikeDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE notes (
      id TEXT PRIMARY KEY,
      owner_scope TEXT NOT NULL DEFAULT '${GUEST_OWNER_SCOPE}',
      verse_key TEXT NOT NULL,
      surah_number INTEGER NOT NULL,
      ayah_number INTEGER NOT NULL,
      content TEXT NOT NULL,
      verse_keys TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      rewayah_id TEXT NOT NULL DEFAULT 'hafs',
      remote_id TEXT,
      server_created_at INTEGER,
      server_updated_at INTEGER
    );
  `);
}

async function createFreshHighlights(db: SQLiteLikeDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE highlights (
      id TEXT PRIMARY KEY,
      owner_scope TEXT NOT NULL DEFAULT '${GUEST_OWNER_SCOPE}',
      verse_key TEXT NOT NULL,
      surah_number INTEGER NOT NULL,
      ayah_number INTEGER NOT NULL,
      color TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      rewayah_id TEXT NOT NULL DEFAULT 'hafs',
      remote_id TEXT,
      server_created_at INTEGER,
      server_updated_at INTEGER
    );
  `);
}

async function createAnnotationIndexes(db: SQLiteLikeDatabase): Promise<void> {
  await db.execAsync(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_bookmarks_owner_verse_key
      ON bookmarks(owner_scope, verse_key);
    CREATE INDEX IF NOT EXISTS idx_bookmarks_owner_surah
      ON bookmarks(owner_scope, surah_number);

    CREATE INDEX IF NOT EXISTS idx_notes_owner_verse_key
      ON notes(owner_scope, verse_key);
    CREATE INDEX IF NOT EXISTS idx_notes_owner_surah
      ON notes(owner_scope, surah_number);

    CREATE UNIQUE INDEX IF NOT EXISTS idx_highlights_owner_verse_key
      ON highlights(owner_scope, verse_key);
    CREATE INDEX IF NOT EXISTS idx_highlights_owner_surah
      ON highlights(owner_scope, surah_number);
  `);
}

async function rebuildBookmarks(db: SQLiteLikeDatabase): Promise<void> {
  if (!(await tableExists(db, 'bookmarks'))) {
    await createFreshBookmarks(db);
    return;
  }

  await db.execAsync(
    `ALTER TABLE bookmarks RENAME TO bookmarks_legacy_user_sync_v1;`,
  );
  const legacyColumns = await getTableColumns(
    db,
    'bookmarks_legacy_user_sync_v1',
  );
  await createFreshBookmarks(db);
  await db.execAsync(`
    INSERT INTO bookmarks (
      id,
      owner_scope,
      verse_key,
      surah_number,
      ayah_number,
      created_at,
      rewayah_id,
      remote_id,
      server_created_at,
      server_updated_at
    )
    SELECT
      id,
      '${GUEST_OWNER_SCOPE}',
      verse_key,
      surah_number,
      ayah_number,
      created_at,
      ${legacyRewayahSelect(legacyColumns)},
      NULL,
      NULL,
      NULL
    FROM bookmarks_legacy_user_sync_v1;
    DROP TABLE bookmarks_legacy_user_sync_v1;
  `);
}

async function rebuildNotes(db: SQLiteLikeDatabase): Promise<void> {
  if (!(await tableExists(db, 'notes'))) {
    await createFreshNotes(db);
    return;
  }

  await db.execAsync(`ALTER TABLE notes RENAME TO notes_legacy_user_sync_v1;`);
  const legacyColumns = await getTableColumns(db, 'notes_legacy_user_sync_v1');
  await createFreshNotes(db);
  await db.execAsync(`
    INSERT INTO notes (
      id,
      owner_scope,
      verse_key,
      surah_number,
      ayah_number,
      content,
      verse_keys,
      created_at,
      updated_at,
      rewayah_id,
      remote_id,
      server_created_at,
      server_updated_at
    )
    SELECT
      id,
      '${GUEST_OWNER_SCOPE}',
      verse_key,
      surah_number,
      ayah_number,
      content,
      ${legacyVerseKeysSelect(legacyColumns)},
      created_at,
      updated_at,
      ${legacyRewayahSelect(legacyColumns)},
      NULL,
      NULL,
      NULL
    FROM notes_legacy_user_sync_v1;
    DROP TABLE notes_legacy_user_sync_v1;
  `);
}

async function rebuildHighlights(db: SQLiteLikeDatabase): Promise<void> {
  if (!(await tableExists(db, 'highlights'))) {
    await createFreshHighlights(db);
    return;
  }

  await db.execAsync(
    `ALTER TABLE highlights RENAME TO highlights_legacy_user_sync_v1;`,
  );
  const legacyColumns = await getTableColumns(
    db,
    'highlights_legacy_user_sync_v1',
  );
  await createFreshHighlights(db);
  await db.execAsync(`
    INSERT INTO highlights (
      id,
      owner_scope,
      verse_key,
      surah_number,
      ayah_number,
      color,
      created_at,
      rewayah_id,
      remote_id,
      server_created_at,
      server_updated_at
    )
    SELECT
      id,
      '${GUEST_OWNER_SCOPE}',
      verse_key,
      surah_number,
      ayah_number,
      color,
      created_at,
      ${legacyRewayahSelect(legacyColumns)},
      NULL,
      NULL,
      NULL
    FROM highlights_legacy_user_sync_v1;
    DROP TABLE highlights_legacy_user_sync_v1;
  `);
}

async function rebuildAnnotations(db: SQLiteLikeDatabase): Promise<void> {
  await rebuildBookmarks(db);
  await rebuildNotes(db);
  await rebuildHighlights(db);
  await createAnnotationIndexes(db);
}

async function createSyncTables(db: SQLiteLikeDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE qf_sync_state (
      owner_scope TEXT PRIMARY KEY,
      last_mutation_at TEXT,
      last_successful_sync_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE qf_sync_outbox (
      local_operation_id TEXT PRIMARY KEY,
      owner_scope TEXT NOT NULL,
      account_id TEXT NOT NULL,
      resource TEXT NOT NULL,
      mutation_type TEXT NOT NULL,
      local_id TEXT,
      remote_id TEXT,
      payload_json TEXT NOT NULL,
      base_server_updated_at INTEGER,
      attempts INTEGER NOT NULL DEFAULT 0,
      next_attempt_at INTEGER,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX idx_qf_sync_outbox_owner_created
      ON qf_sync_outbox(owner_scope, created_at);

    CREATE TABLE qf_reading_locations (
      id TEXT PRIMARY KEY,
      owner_scope TEXT NOT NULL,
      remote_id TEXT,
      surah_number INTEGER NOT NULL,
      ayah_number INTEGER NOT NULL,
      verse_key TEXT NOT NULL,
      page_number INTEGER,
      rewayah_id TEXT NOT NULL DEFAULT 'hafs',
      last_read_at INTEGER NOT NULL,
      server_updated_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX idx_qf_reading_locations_owner_last_read
      ON qf_reading_locations(owner_scope, last_read_at);
    CREATE UNIQUE INDEX idx_qf_reading_locations_owner_remote
      ON qf_reading_locations(owner_scope, remote_id)
      WHERE remote_id IS NOT NULL;

    CREATE TABLE qf_guest_imports (
      id TEXT PRIMARY KEY,
      owner_scope TEXT NOT NULL,
      guest_owner_scope TEXT NOT NULL DEFAULT '${GUEST_OWNER_SCOPE}',
      imported_at INTEGER NOT NULL,
      bookmark_count INTEGER NOT NULL DEFAULT 0,
      note_count INTEGER NOT NULL DEFAULT 0,
      highlight_count INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX idx_qf_guest_imports_owner_imported
      ON qf_guest_imports(owner_scope, imported_at);

    CREATE TABLE qf_note_conflicts (
      id TEXT PRIMARY KEY,
      owner_scope TEXT NOT NULL,
      note_id TEXT NOT NULL,
      local_content TEXT NOT NULL,
      remote_content TEXT NOT NULL,
      remote_id TEXT,
      base_server_updated_at INTEGER,
      created_at INTEGER NOT NULL,
      resolved_at INTEGER
    );
    CREATE INDEX idx_qf_note_conflicts_owner_note
      ON qf_note_conflicts(owner_scope, note_id);
  `);
}

export async function migrateUserSyncV1(db: SQLiteLikeDatabase): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL;');

  if (await hasMigration(db)) return;

  await db.execAsync('BEGIN;');
  try {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        applied_at INTEGER NOT NULL
      );
    `);

    if (!(await hasMigration(db))) {
      await rebuildAnnotations(db);
      await createSyncTables(db);
      await db.execAsync(`
        INSERT INTO schema_migrations (version, applied_at)
        VALUES ('${USER_SYNC_V1_VERSION}', strftime('%s', 'now') * 1000);
      `);
    }

    await db.execAsync('COMMIT;');
  } catch (error) {
    await db.execAsync('ROLLBACK;');
    throw error;
  }
}
