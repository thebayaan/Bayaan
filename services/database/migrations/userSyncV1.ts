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
  pk: number;
  hidden: number;
}

interface PreservedColumn {
  name: string;
  definition: string;
}

interface PreservedSchema {
  columns: PreservedColumn[];
  constraints: string[];
  indexes: string[];
}

// These fields must not overwrite pre-existing fork data during a legacy upgrade.
const NEW_SYNC_COLUMNS = [
  'owner_scope',
  'remote_id',
  'server_created_at',
  'server_updated_at',
];

// Fork-owned columns keep their own identity, separate from the sync contract.
const COMMON_ANNOTATION_COLUMNS = [
  'id',
  'owner_scope',
  'verse_key',
  'surah_number',
  'ayah_number',
  'created_at',
  'rewayah_id',
  'remote_id',
  'server_created_at',
  'server_updated_at',
];

function quoteIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

// Remove comments without changing quoted values/identifiers or fusing tokens.
// Trimming a definition's trailing newline otherwise lets -- swallow the next
// comma, column or CHECK when the rebuild joins definitions together.
function stripSqlComments(sql: string): string {
  let result = '';
  let quote: string | null = null;
  for (let i = 0; i < sql.length; i += 1) {
    const char = sql[i];
    if (quote) {
      result += char;
      if (char === quote) {
        if (quote !== ']' && sql[i + 1] === quote) result += sql[++i];
        else quote = null;
      }
    } else if (char === '-' && sql[i + 1] === '-') {
      const end = sql.indexOf('\n', i + 2);
      result += ' ';
      if (end < 0) break;
      i = end;
    } else if (char === '/' && sql[i + 1] === '*') {
      const end = sql.indexOf('*/', i + 2);
      if (end < 0) throw new Error('Unterminated legacy schema comment');
      result += ' ';
      i = end + 1;
    } else {
      result += char;
      if (char === '"' || char === "'" || char === '`' || char === '[') {
        quote = char === '[' ? ']' : char;
      }
    }
  }
  return result;
}

// Split SQLite's CREATE TABLE column list without splitting nested expressions,
// strings, quoted identifiers or comments. Copy definitions verbatim: PRAGMA
// metadata alone loses UNIQUE/CHECK/COLLATE/REFERENCES and expression defaults.
function sqlDefinitions(sql: string): string[] {
  const opening = sql.indexOf('(');
  if (opening < 0) throw new Error('Missing legacy schema definition');
  const definitions: string[] = [];
  let start = opening + 1;
  let depth = 1;
  let quote: string | null = null;
  for (let i = start; i < sql.length; i += 1) {
    const char = sql[i];
    if (quote) {
      if (char === quote) {
        if (quote !== ']' && sql[i + 1] === quote) i += 1;
        else quote = null;
      }
      continue;
    }
    if (char === '-' && sql[i + 1] === '-') {
      const end = sql.indexOf('\n', i + 2);
      if (end < 0) break;
      i = end;
    } else if (char === '/' && sql[i + 1] === '*') {
      const end = sql.indexOf('*/', i + 2);
      if (end < 0) break;
      i = end + 1;
    } else if (char === '"' || char === "'" || char === '`' || char === '[') {
      quote = char === '[' ? ']' : char;
    } else if (char === '(') {
      depth += 1;
    } else if (char === ')') {
      depth -= 1;
      if (depth === 0) {
        definitions.push(sql.slice(start, i).trim());
        return definitions;
      }
    } else if (char === ',' && depth === 1) {
      definitions.push(sql.slice(start, i).trim());
      start = i + 1;
    }
  }
  throw new Error('Cannot safely parse legacy schema definition');
}

function firstSqlIdentifier(definition: string): {name: string; rest: string} {
  const source = definition.replace(/^(?:\s|--[^\n]*\n|\/\*[\s\S]*?\*\/)+/, '');
  const match =
    /^(?:"((?:[^"]|"")*)"|`((?:[^`]|``)*)`|\[([^\]]*)\]|([^\s("'`[]+))/.exec(
      source,
    );
  if (!match) throw new Error('Cannot safely identify legacy schema column');
  const name = (match[1] ?? match[2] ?? match[3] ?? match[4])
    .replaceAll('""', '"')
    .replaceAll('``', '`');
  return {name: name.toLowerCase(), rest: source.slice(match[0].length).trim()};
}

function extraColumnDefinitions(extra: PreservedSchema): string {
  return [
    ...extra.columns.map(column => column.definition),
    ...extra.constraints,
  ]
    .map(definition => `,\n      ${definition}\n`)
    .join('');
}

function extraColumnProjection(extra: PreservedSchema): string {
  return extra.columns
    .map(column => `, ${quoteIdentifier(column.name)}`)
    .join('');
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
  additionalColumns: string[] = [],
): Promise<{names: Set<string>; extra: PreservedSchema}> {
  if (!db.getAllAsync) {
    throw new Error(
      'Database does not support getAllAsync required for migration',
    );
  }

  const rows = (await db.getAllAsync(
    `PRAGMA table_xinfo(${quoteIdentifier(tableName)})`,
  )) as TableInfoRow[];
  if (rows.length === 0) {
    throw new Error('Cannot inspect legacy annotation columns safely');
  }
  const options = (await db.getFirstAsync(
    `SELECT wr, strict FROM pragma_table_list WHERE "schema" = 'main' AND name = ?`,
    [tableName],
  )) as {wr: number; strict: number} | null;
  if (!options || options.wr || options.strict) {
    throw new Error('Cannot safely rebuild legacy table options');
  }
  for (const column of rows) {
    if (!NEW_SYNC_COLUMNS.includes(column.name.toLowerCase())) continue;
    const populated = await db.getFirstAsync(
      `SELECT 1 FROM ${quoteIdentifier(tableName)} WHERE ${quoteIdentifier(column.name)} IS NOT NULL LIMIT 1`,
    );
    if (populated !== null) {
      throw new Error(
        `Populated fork column collides with sync field: ${column.name}`,
      );
    }
  }
  const known = new Set([...COMMON_ANNOTATION_COLUMNS, ...additionalColumns]);
  const extra = rows.filter(row => !known.has(row.name.toLowerCase()));
  // PRAGMA cannot reconstruct generated expressions or another primary key.
  // Roll back rather than silently lose an unsupported fork-owned column.
  if (extra.some(column => column.hidden !== 0 || column.pk !== 0)) {
    throw new Error(
      'Cannot safely rebuild fork generated or primary-key columns',
    );
  }
  const schema = (await db.getFirstAsync(
    "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?",
    [tableName],
  )) as {sql: string} | null;
  if (!schema?.sql) throw new Error('Missing legacy annotation schema');
  const definitions = sqlDefinitions(stripSqlComments(schema.sql));
  const byName = new Map<string, string>();
  const constraints: string[] = [];
  const names = new Set(rows.map(row => row.name.toLowerCase()));
  for (const definition of definitions) {
    const identifier = firstSqlIdentifier(definition);
    if (names.has(identifier.name)) {
      // Standard columns are rebuilt with Bayaan's canonical definitions. Only
      // accept the unmodified legacy shapes; silently discarding a fork's inline
      // CHECK/UNIQUE/COLLATE/default here would break its invariants.
      if (known.has(identifier.name)) {
        const expected =
          identifier.name === 'id'
            ? /^(?:TEXT PRIMARY KEY|TEXT)$/i
            : identifier.name === 'verse_key'
              ? /^TEXT NOT NULL(?: UNIQUE)?$/i
              : [
                    'rewayah_id',
                    'verse_keys',
                    'owner_scope',
                    'remote_id',
                  ].includes(identifier.name)
                ? /^TEXT$/i
                : ['server_created_at', 'server_updated_at'].includes(
                      identifier.name,
                    )
                  ? /^INTEGER$/i
                  : ['content', 'color'].includes(identifier.name)
                    ? /^TEXT NOT NULL$/i
                    : /^INTEGER NOT NULL$/i;
        if (!expected.test(identifier.rest.replace(/\s+/g, ' '))) {
          throw new Error(
            `Cannot safely rebuild modified standard column: ${identifier.name}`,
          );
        }
      }
      byName.set(identifier.name, definition);
      continue;
    }
    const constraint =
      identifier.name === 'constraint'
        ? firstSqlIdentifier(identifier.rest).rest
        : definition;
    if (/^(?:UNIQUE|PRIMARY\s+KEY)\s*\(/i.test(constraint)) {
      const parts = sqlDefinitions(constraint).map(firstSqlIdentifier);
      const columns = parts.map(part => part.name);
      // Replace only the legacy single-column verse uniqueness and canonical
      // id primary key. Keep unrelated fork invariants, even on standard columns.
      if (/^PRIMARY\s+KEY/i.test(constraint)) {
        if (columns.length !== 1 || columns[0] !== 'id' || parts[0].rest) {
          throw new Error('Cannot safely rebuild legacy primary key');
        }
        continue;
      }
      if (columns.length === 1 && columns[0] === 'verse_key' && !parts[0].rest)
        continue;
    } else if (!/^(?:CHECK\s*\(|FOREIGN\s+KEY\s*\()/i.test(constraint)) {
      throw new Error('Cannot safely rebuild legacy table constraint');
    }
    constraints.push(definition);
  }
  const columns = extra.map(column => {
    const definition = byName.get(column.name.toLowerCase());
    if (!definition) throw new Error('Missing fork column definition');
    return {name: column.name, definition};
  });
  const indexRows = (await db.getAllAsync(
    "SELECT name, sql FROM sqlite_master WHERE type = 'index' AND tbl_name = ? AND sql IS NOT NULL",
    [tableName],
  )) as {name: string; sql: string}[];
  const indexMetadata = (await db.getAllAsync(
    `PRAGMA index_list(${quoteIdentifier(tableName)})`,
  )) as {name: string; unique: number; partial: number}[];
  const indexes: string[] = [];
  for (const index of indexRows) {
    const indexColumns = (await db.getAllAsync(
      `PRAGMA index_info(${quoteIdentifier(index.name)})`,
    )) as {name: string | null}[];
    if (indexColumns.some(column => column.name === null)) {
      throw new Error('Cannot safely rebuild legacy expression index');
    }
    const metadata = indexMetadata.find(row => row.name === index.name);
    if (!metadata) throw new Error('Missing legacy index metadata');
    if (
      metadata.unique === 1 &&
      metadata.partial === 0 &&
      indexColumns.length === 1 &&
      indexColumns[0].name?.toLowerCase() === 'verse_key'
    )
      continue;
    // Preserve fork indexes on known-only columns as well as mixed/extra ones.
    indexes.push(index.sql);
  }
  return {names, extra: {columns, constraints, indexes}};
}

function legacyRewayahSelect(columns: Set<string>): string {
  return columns.has('rewayah_id')
    ? canonicalRewayahSql('rewayah_id')
    : `'hafs'`;
}

function legacyVerseKeysSelect(columns: Set<string>): string {
  return columns.has('verse_keys') ? 'verse_keys' : 'NULL';
}

async function createFreshBookmarks(
  db: SQLiteLikeDatabase,
  extra: PreservedSchema = {columns: [], constraints: [], indexes: []},
): Promise<void> {
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
      server_updated_at INTEGER${extraColumnDefinitions(extra)}
    );
  `);
}

async function createFreshNotes(
  db: SQLiteLikeDatabase,
  extra: PreservedSchema = {columns: [], constraints: [], indexes: []},
): Promise<void> {
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
      server_updated_at INTEGER${extraColumnDefinitions(extra)}
    );
  `);
}

async function createFreshHighlights(
  db: SQLiteLikeDatabase,
  extra: PreservedSchema = {columns: [], constraints: [], indexes: []},
): Promise<void> {
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
      server_updated_at INTEGER${extraColumnDefinitions(extra)}
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

  const legacyColumns = await getTableColumns(db, 'bookmarks');
  await db.execAsync(
    `ALTER TABLE bookmarks RENAME TO bookmarks_legacy_user_sync_v1;`,
  );
  await createFreshBookmarks(db, legacyColumns.extra);
  const extraProjection = extraColumnProjection(legacyColumns.extra);
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
      server_updated_at${extraProjection}
    )
    SELECT
      id,
      '${GUEST_OWNER_SCOPE}',
      verse_key,
      surah_number,
      ayah_number,
      created_at,
      ${legacyRewayahSelect(legacyColumns.names)},
      NULL,
      NULL,
      NULL${extraProjection}
    FROM bookmarks_legacy_user_sync_v1;
    DROP TABLE bookmarks_legacy_user_sync_v1;
  `);
  for (const index of legacyColumns.extra.indexes) await db.execAsync(index);
}

async function rebuildNotes(db: SQLiteLikeDatabase): Promise<void> {
  if (!(await tableExists(db, 'notes'))) {
    await createFreshNotes(db);
    return;
  }

  const legacyColumns = await getTableColumns(db, 'notes', [
    'content',
    'verse_keys',
    'updated_at',
  ]);
  await db.execAsync(`ALTER TABLE notes RENAME TO notes_legacy_user_sync_v1;`);
  await createFreshNotes(db, legacyColumns.extra);
  const extraProjection = extraColumnProjection(legacyColumns.extra);
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
      server_updated_at${extraProjection}
    )
    SELECT
      id,
      '${GUEST_OWNER_SCOPE}',
      verse_key,
      surah_number,
      ayah_number,
      content,
      ${legacyVerseKeysSelect(legacyColumns.names)},
      created_at,
      updated_at,
      ${legacyRewayahSelect(legacyColumns.names)},
      NULL,
      NULL,
      NULL${extraProjection}
    FROM notes_legacy_user_sync_v1;
    DROP TABLE notes_legacy_user_sync_v1;
  `);
  for (const index of legacyColumns.extra.indexes) await db.execAsync(index);
}

async function rebuildHighlights(db: SQLiteLikeDatabase): Promise<void> {
  if (!(await tableExists(db, 'highlights'))) {
    await createFreshHighlights(db);
    return;
  }

  const legacyColumns = await getTableColumns(db, 'highlights', ['color']);
  await db.execAsync(
    `ALTER TABLE highlights RENAME TO highlights_legacy_user_sync_v1;`,
  );
  await createFreshHighlights(db, legacyColumns.extra);
  const extraProjection = extraColumnProjection(legacyColumns.extra);
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
      server_updated_at${extraProjection}
    )
    SELECT
      id,
      '${GUEST_OWNER_SCOPE}',
      verse_key,
      surah_number,
      ayah_number,
      color,
      created_at,
      ${legacyRewayahSelect(legacyColumns.names)},
      NULL,
      NULL,
      NULL${extraProjection}
    FROM highlights_legacy_user_sync_v1;
    DROP TABLE highlights_legacy_user_sync_v1;
  `);
  for (const index of legacyColumns.extra.indexes) await db.execAsync(index);
}

async function rebuildAnnotations(db: SQLiteLikeDatabase): Promise<void> {
  if (!db.getAllAsync) throw new Error('Missing migration schema inspection');
  const dependencies = (await db.getAllAsync(
    "SELECT type, tbl_name, sql FROM sqlite_master WHERE type IN ('trigger', 'view')",
  )) as {type: string; tbl_name: string; sql: string | null}[];
  for (const dependency of dependencies) {
    if (
      ['bookmarks', 'notes', 'highlights'].includes(
        dependency.tbl_name.toLowerCase(),
      ) ||
      /\b(?:bookmarks|notes|highlights)\b/i.test(
        stripSqlComments(dependency.sql ?? ''),
      )
    ) {
      // Rename-first rewrites dependencies to the legacy table name. Fail before
      // any rebuild rather than dropping triggers or stranding dependent views.
      throw new Error(`Cannot safely rebuild annotation ${dependency.type}s`);
    }
  }
  const tables = (await db.getAllAsync(
    "SELECT name FROM sqlite_master WHERE type = 'table'",
  )) as TableRow[];
  // Rename-first rebuilds cannot safely retain references into annotation tables:
  // SQLite rewrites them to the legacy name (and DROP may cascade). Detect them
  // before changing any table, including references from fork-owned tables.
  for (const table of tables) {
    const keys = (await db.getAllAsync(
      `PRAGMA foreign_key_list(${quoteIdentifier(table.name)})`,
    )) as {table: string}[];
    if (
      keys.some(key =>
        ['bookmarks', 'notes', 'highlights'].includes(key.table.toLowerCase()),
      )
    ) {
      throw new Error(
        'Cannot safely rebuild foreign keys referencing annotations',
      );
    }
  }
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
