import type * as SQLite from 'expo-sqlite';

interface IndexListRow {
  name: string;
  unique: number;
  origin: string;
}

interface IndexInfoRow {
  name: string | null;
}

interface TableInfoRow {
  name: string;
  type: string;
}

interface CountRow {
  count: number;
}

// Columns of the notes table as created without the old UNIQUE constraint.
const NOTES_BASE_COLUMNS = [
  'id',
  'verse_key',
  'surah_number',
  'ayah_number',
  'content',
  'created_at',
  'updated_at',
];

function quoteIdentifier(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

async function tableExists(
  db: SQLite.SQLiteDatabase,
  table: string,
): Promise<boolean> {
  const row = await db.getFirstAsync<CountRow>(
    `SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name = ?`,
    [table],
  );
  return (row?.count ?? 0) > 0;
}

// Earlier builds mistook the PRIMARY KEY autoindex for a UNIQUE constraint,
// ran the rebuild below on every launch and, once verse_keys and rewayah_id
// existed, left an empty orphan notes_new table behind. Drop it when empty;
// leave it alone (and say so) if it somehow holds rows.
async function dropEmptyNotesOrphan(db: SQLite.SQLiteDatabase): Promise<void> {
  try {
    if (!(await tableExists(db, 'notes_new'))) return;
    if (!(await tableExists(db, 'notes'))) return;
    const row = await db.getFirstAsync<CountRow>(
      'SELECT COUNT(*) AS count FROM notes_new',
    );
    const count = row?.count ?? 0;
    if (count > 0) {
      console.warn(
        `Leaving notes_new in place: it holds ${count} row(s) that may be user data`,
      );
      return;
    }
    await db.execAsync('DROP TABLE notes_new;');
  } catch (error) {
    console.error('Failed to clean up orphan notes_new table:', error);
  }
}

// The one query shape the check below needs, so tests can pass any adapter.
interface IndexReader {
  getAllAsync<T>(source: string, params: string[]): Promise<T[]>;
}

// True only for a real UNIQUE constraint on verse_key alone (index_list origin
// 'u'). The PRIMARY KEY autoindex has origin 'pk' and CREATE INDEX has origin
// 'c'. A composite constraint such as UNIQUE(owner_scope, verse_key) is not the
// legacy one-note-per-verse rule and must never trigger the rebuild below,
// which would turn an owner-scoped table back into the old schema.
export async function hasVerseKeyUniqueConstraint(
  db: IndexReader,
): Promise<boolean> {
  const indexes = await db.getAllAsync<IndexListRow>(
    'SELECT name, "unique", origin FROM pragma_index_list(\'notes\')',
    [],
  );
  for (const index of indexes) {
    if (index.origin !== 'u' || index.unique !== 1) continue;
    const columns = await db.getAllAsync<IndexInfoRow>(
      'SELECT name FROM pragma_index_info(?)',
      [index.name],
    );
    if (columns.length === 1 && columns[0].name === 'verse_key') return true;
  }
  return false;
}

// Migration: drop the UNIQUE(verse_key) constraint from the oldest notes
// schema. SQLite cannot drop a constraint, so the table is rebuilt inside a
// transaction (a failure rolls back and leaves notes untouched), copying an
// explicit column list that includes any later columns (verse_keys,
// rewayah_id) present on the old table.
async function dropNotesUniqueConstraint(
  db: SQLite.SQLiteDatabase,
): Promise<void> {
  try {
    if (!(await hasVerseKeyUniqueConstraint(db))) return;
    const columns = await db.getAllAsync<TableInfoRow>(
      "SELECT name, type FROM pragma_table_info('notes')",
    );
    const extras = columns.filter(c => !NOTES_BASE_COLUMNS.includes(c.name));
    const columnList = [...NOTES_BASE_COLUMNS, ...extras.map(c => c.name)]
      .map(quoteIdentifier)
      .join(', ');
    const extraDefinitions = extras
      .map(c => `,\n          ${quoteIdentifier(c.name)} ${c.type}`)
      .join('');
    await db.withTransactionAsync(async () => {
      await db.execAsync('DROP TABLE IF EXISTS notes_rebuild;');
      await db.execAsync(`
        CREATE TABLE notes_rebuild (
          id TEXT PRIMARY KEY,
          verse_key TEXT NOT NULL,
          surah_number INTEGER NOT NULL,
          ayah_number INTEGER NOT NULL,
          content TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL${extraDefinitions}
        );
      `);
      await db.execAsync(
        `INSERT INTO notes_rebuild (${columnList}) SELECT ${columnList} FROM notes;`,
      );
      await db.execAsync('DROP TABLE notes;');
      await db.execAsync('ALTER TABLE notes_rebuild RENAME TO notes;');
    });
  } catch (error) {
    console.error('Failed to drop UNIQUE constraint from notes table:', error);
  }
}

// Pre-sync cleanup of the legacy notes table. Runs before migrateUserSyncV1 so
// its rebuild sees a plain notes table, and is a no-op once userSyncV1 has
// rebuilt notes (no orphan, no single-column UNIQUE(verse_key)). Must not run
// inside another transaction: expo-sqlite forbids nesting withTransactionAsync.
export async function cleanUpLegacyNotes(
  db: SQLite.SQLiteDatabase,
): Promise<void> {
  await dropEmptyNotesOrphan(db);
  await dropNotesUniqueConstraint(db);
}
