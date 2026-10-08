import type * as SQLite from 'expo-sqlite';

interface CountRow {
  count: number;
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

// Pre-sync cleanup of the legacy notes table. Only drops the empty notes_new
// orphan. It deliberately does not touch a legacy single-column
// UNIQUE(verse_key): userSyncV1's own notes rebuild removes it and, unlike a
// generic rebuild, carries fork-owned extra columns with their definitions,
// so rebuilding here first would strip those columns' constraints and indexes
// before userSyncV1 could preserve them. Must not run inside another
// transaction: expo-sqlite forbids nesting withTransactionAsync.
export async function cleanUpLegacyNotes(
  db: SQLite.SQLiteDatabase,
): Promise<void> {
  await dropEmptyNotesOrphan(db);
}
