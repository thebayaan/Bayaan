import * as SQLite from 'expo-sqlite';
import type {
  VerseBookmark,
  VerseNote,
  VerseHighlight,
  HighlightColor,
  AnnotationRowChanges, // @ai
} from '@/types/verse-annotations';
import {
  ALL_REWAYAH_IDS,
  PERSISTED_ID_MIGRATIONS,
  type RewayahId,
} from '@/services/rewayah/RewayahIdentity';

// Database row types (snake_case)
interface BookmarkRow {
  id: string;
  verse_key: string;
  surah_number: number;
  ayah_number: number;
  created_at: number;
  rewayah_id: string | null;
}

interface NoteRow {
  id: string;
  verse_key: string;
  surah_number: number;
  ayah_number: number;
  content: string;
  verse_keys: string | null;
  created_at: number;
  updated_at: number;
  rewayah_id: string | null;
}

interface HighlightRow {
  id: string;
  verse_key: string;
  surah_number: number;
  ayah_number: number;
  color: string;
  created_at: number;
  rewayah_id: string | null;
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// @ai-start
// The single-row bookmark / highlight writes, shared by the one-row methods
// and applyAnnotationChanges so both write rows the same way.
const INSERT_BOOKMARK_SQL = `INSERT OR IGNORE INTO bookmarks (id, verse_key, surah_number, ayah_number, created_at, rewayah_id)
       VALUES (?, ?, ?, ?, ?, ?)`;
const UPSERT_HIGHLIGHT_SQL = `INSERT INTO highlights (id, verse_key, surah_number, ayah_number, color, created_at, rewayah_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(verse_key) DO UPDATE SET color = excluded.color, rewayah_id = excluded.rewayah_id`;
// @ai-end

function parseRewayahId(value: string | null): RewayahId | undefined {
  if (!value) return undefined;
  // Trust DB values were written by our own code; still narrow through the
  // known-set to be safe if a hand-edited DB surfaces something unexpected.
  const known = new Set<RewayahId>(ALL_REWAYAH_IDS);
  return known.has(value as RewayahId) ? (value as RewayahId) : undefined;
}

function mapBookmarkRow(row: BookmarkRow): VerseBookmark {
  return {
    id: row.id,
    verseKey: row.verse_key,
    surahNumber: row.surah_number,
    ayahNumber: row.ayah_number,
    createdAt: row.created_at,
    rewayahId: parseRewayahId(row.rewayah_id),
  };
}

function mapNoteRow(row: NoteRow): VerseNote {
  return {
    id: row.id,
    verseKey: row.verse_key,
    surahNumber: row.surah_number,
    ayahNumber: row.ayah_number,
    content: row.content,
    verseKeys: row.verse_keys ? row.verse_keys.split(',') : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    rewayahId: parseRewayahId(row.rewayah_id),
  };
}

function mapHighlightRow(row: HighlightRow): VerseHighlight {
  return {
    id: row.id,
    verseKey: row.verse_key,
    surahNumber: row.surah_number,
    ayahNumber: row.ayah_number,
    color: row.color as HighlightColor,
    createdAt: row.created_at,
    rewayahId: parseRewayahId(row.rewayah_id),
  };
}

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

// True only for a real UNIQUE constraint on verse_key (index_list origin 'u').
// The PRIMARY KEY autoindex has origin 'pk' and CREATE INDEX has origin 'c'.
async function hasVerseKeyUniqueConstraint(
  db: SQLite.SQLiteDatabase,
): Promise<boolean> {
  const indexes = await db.getAllAsync<IndexListRow>(
    'SELECT name, "unique", origin FROM pragma_index_list(\'notes\')',
  );
  for (const index of indexes) {
    if (index.origin !== 'u' || index.unique !== 1) continue;
    const columns = await db.getAllAsync<IndexInfoRow>(
      'SELECT name FROM pragma_index_info(?)',
      [index.name],
    );
    if (columns.some(c => c.name === 'verse_key')) return true;
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

class VerseAnnotationDatabaseService {
  private db: SQLite.SQLiteDatabase | null = null;
  private initPromise: Promise<void> | null = null;
  private ready = false;

  async initialize(): Promise<void> {
    if (this.ready) return;

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      try {
        this.db = await SQLite.openDatabaseAsync('verse-annotations.db');
        await this.createTables();
        this.ready = true;
      } catch (error) {
        console.error(
          'Failed to initialize verse annotations database:',
          error,
        );
        this.initPromise = null;
        throw error;
      }
    })();

    return this.initPromise;
  }

  private async ensureReady(): Promise<SQLite.SQLiteDatabase> {
    if (!this.ready && this.initPromise) {
      await this.initPromise;
    }
    if (!this.db || !this.ready) {
      throw new Error('Database not initialized');
    }
    return this.db;
  }

  // @ai-start
  // Tail of the writes. withTransactionAsync is not exclusive: a statement
  // run on the connection while applyAnnotationChanges has its transaction
  // open joins that transaction (and its ROLLBACK undoes it), and a second
  // BEGIN fails. Every write therefore starts once the one before it is done.
  private writeQueue: Promise<unknown> = Promise.resolve();

  private serializeWrite<T>(write: () => Promise<T>): Promise<T> {
    const result = this.writeQueue.then(write, write);
    this.writeQueue = result.catch(() => undefined);
    return result;
  }
  // @ai-end

  private async createTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.execAsync('PRAGMA journal_mode = WAL;');

    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS bookmarks (
        id TEXT PRIMARY KEY,
        verse_key TEXT NOT NULL UNIQUE,
        surah_number INTEGER NOT NULL,
        ayah_number INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      );
    `);

    await this.db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_bookmarks_surah
      ON bookmarks(surah_number);
    `);

    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS notes (
        id TEXT PRIMARY KEY,
        verse_key TEXT NOT NULL,
        surah_number INTEGER NOT NULL,
        ayah_number INTEGER NOT NULL,
        content TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);

    await dropEmptyNotesOrphan(this.db);
    await dropNotesUniqueConstraint(this.db);

    await this.db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_notes_surah
      ON notes(surah_number);
    `);

    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS highlights (
        id TEXT PRIMARY KEY,
        verse_key TEXT NOT NULL UNIQUE,
        surah_number INTEGER NOT NULL,
        ayah_number INTEGER NOT NULL,
        color TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
    `);

    await this.db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_highlights_surah
      ON highlights(surah_number);
    `);

    // Migration: add verse_keys column to notes table
    try {
      await this.db.execAsync(`ALTER TABLE notes ADD COLUMN verse_keys TEXT;`);
    } catch {
      // Column already exists
    }

    // Migration: add rewayah_id column to all three annotation tables.
    // Legacy rows created before rewayah support existed are backfilled
    // to 'hafs' (the only reading the app showed pre-feature). Idempotent
    // on rerun — the UPDATE only touches NULLs, new saves stamp their
    // own rewayah via service callers.
    for (const table of ['bookmarks', 'notes', 'highlights']) {
      try {
        await this.db.execAsync(
          `ALTER TABLE ${table} ADD COLUMN rewayah_id TEXT;`,
        );
      } catch (err) {
        // Idempotent: the column already exists on reruns. Re-throw any
        // other error (disk full, locked DB, etc.) so callers can fail
        // loudly instead of silently corrupting subsequent INSERTs.
        const msg = err instanceof Error ? err.message : String(err);
        if (!msg.toLowerCase().includes('duplicate column')) throw err;
      }
      await this.db.execAsync(
        `UPDATE ${table} SET rewayah_id = 'hafs' WHERE rewayah_id IS NULL;`,
      );
    }

    // One-shot rename of pre-canonical rewayah slugs to the canonical ones.
    // Pre-canonical ids (qumbul, shouba, qaloon, doori, soosi, bazzi)
    // shipped only in TestFlight — the rename table in RewayahIdentity is
    // the single source of truth. Idempotent: once applied, rows match the
    // `=` clause once; on rerun the WHERE matches nothing and the UPDATE is
    // a no-op. Safe to run every boot.
    for (const table of ['bookmarks', 'notes', 'highlights']) {
      for (const [oldId, newId] of Object.entries(PERSISTED_ID_MIGRATIONS)) {
        if (oldId === newId) continue;
        await this.db.execAsync(
          `UPDATE ${table} SET rewayah_id = '${newId}' WHERE rewayah_id = '${oldId}';`,
        );
      }
    }
  }

  // Bookmark operations
  async addBookmark(
    verseKey: string,
    surahNumber: number,
    ayahNumber: number,
    rewayahId?: string,
  ): Promise<VerseBookmark> {
    const db = await this.ensureReady();

    const bookmark: VerseBookmark = {
      id: generateId(),
      verseKey,
      surahNumber,
      ayahNumber,
      createdAt: Date.now(),
      rewayahId: rewayahId as VerseBookmark['rewayahId'],
    };

    // @ai-start
    // OR IGNORE: `verse_key` is UNIQUE, so a plain INSERT of an
    // already-bookmarked verse raises SQLITE_CONSTRAINT and rejects. That is
    // reachable whenever the caller's `isBookmarked` is stale, and the
    // rejection used to abort the toggle handler mid-way (leaving the sheet
    // open). Bookmarking is idempotent by intent — swallow the duplicate.
    await this.serializeWrite(() =>
      db.runAsync(INSERT_BOOKMARK_SQL, [
        bookmark.id,
        bookmark.verseKey,
        bookmark.surahNumber,
        bookmark.ayahNumber,
        bookmark.createdAt,
        bookmark.rewayahId ?? null,
      ]),
    );
    // @ai-end

    return bookmark;
  }

  async removeBookmark(verseKey: string): Promise<void> {
    const db = await this.ensureReady();
    // @ai-start
    await this.serializeWrite(() =>
      db.runAsync(`DELETE FROM bookmarks WHERE verse_key = ?`, [verseKey]),
    );
    // @ai-end
  }

  async getBookmarksBySurah(surahNumber: number): Promise<VerseBookmark[]> {
    const db = await this.ensureReady();
    const rows = (await db.getAllAsync(
      `SELECT * FROM bookmarks WHERE surah_number = ? ORDER BY ayah_number`,
      [surahNumber],
    )) as BookmarkRow[];
    return rows.map(mapBookmarkRow);
  }

  async getAllBookmarks(): Promise<VerseBookmark[]> {
    const db = await this.ensureReady();
    const rows = (await db.getAllAsync(
      `SELECT * FROM bookmarks ORDER BY created_at DESC`,
    )) as BookmarkRow[];
    return rows.map(mapBookmarkRow);
  }

  async isBookmarked(verseKey: string): Promise<boolean> {
    const db = await this.ensureReady();
    const row = await db.getFirstAsync(
      `SELECT id FROM bookmarks WHERE verse_key = ?`,
      [verseKey],
    );
    return row !== null;
  }

  // Note operations
  async addNote(
    verseKey: string,
    surahNumber: number,
    ayahNumber: number,
    content: string,
    verseKeys?: string[],
    rewayahId?: string,
  ): Promise<VerseNote> {
    const db = await this.ensureReady();

    const now = Date.now();
    const id = generateId();
    const verseKeysStr = verseKeys?.length ? verseKeys.join(',') : null;

    // @ai-start
    await this.serializeWrite(() =>
      db.runAsync(
        `INSERT INTO notes (id, verse_key, surah_number, ayah_number, content, verse_keys, created_at, updated_at, rewayah_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          verseKey,
          surahNumber,
          ayahNumber,
          content,
          verseKeysStr,
          now,
          now,
          rewayahId ?? null,
        ],
      ),
    );
    // @ai-end

    return {
      id,
      verseKey,
      surahNumber,
      ayahNumber,
      content,
      verseKeys: verseKeys?.length ? verseKeys : undefined,
      createdAt: now,
      updatedAt: now,
      rewayahId: rewayahId as VerseNote['rewayahId'],
    };
  }

  async updateNote(noteId: string, content: string): Promise<void> {
    const db = await this.ensureReady();
    // @ai-start
    await this.serializeWrite(() =>
      db.runAsync(`UPDATE notes SET content = ?, updated_at = ? WHERE id = ?`, [
        content,
        Date.now(),
        noteId,
      ]),
    );
    // @ai-end
  }

  async getNoteById(noteId: string): Promise<VerseNote | null> {
    const db = await this.ensureReady();
    const row = (await db.getFirstAsync(`SELECT * FROM notes WHERE id = ?`, [
      noteId,
    ])) as NoteRow | null;
    return row ? mapNoteRow(row) : null;
  }

  async getNotesForVerse(verseKey: string): Promise<VerseNote[]> {
    const db = await this.ensureReady();
    const rows = (await db.getAllAsync(
      `SELECT * FROM notes WHERE verse_key = ? OR (',' || verse_keys || ',') LIKE ? ORDER BY created_at DESC`,
      [verseKey, `%,${verseKey},%`],
    )) as NoteRow[];
    return rows.map(mapNoteRow);
  }

  async deleteNoteById(noteId: string): Promise<void> {
    const db = await this.ensureReady();
    // @ai-start
    await this.serializeWrite(() =>
      db.runAsync(`DELETE FROM notes WHERE id = ?`, [noteId]),
    );
    // @ai-end
  }

  async getNotesCountForVerse(verseKey: string): Promise<number> {
    const db = await this.ensureReady();
    const row = (await db.getFirstAsync(
      `SELECT COUNT(*) as count FROM notes WHERE verse_key = ? OR (',' || verse_keys || ',') LIKE ?`,
      [verseKey, `%,${verseKey},%`],
    )) as {count: number} | null;
    return row?.count ?? 0;
  }

  async getAllNotes(): Promise<VerseNote[]> {
    const db = await this.ensureReady();
    const rows = (await db.getAllAsync(
      `SELECT * FROM notes ORDER BY updated_at DESC`,
    )) as NoteRow[];
    return rows.map(mapNoteRow);
  }

  async getNotesBySurah(surahNumber: number): Promise<VerseNote[]> {
    const db = await this.ensureReady();
    const rows = (await db.getAllAsync(
      `SELECT * FROM notes WHERE surah_number = ? ORDER BY ayah_number`,
      [surahNumber],
    )) as NoteRow[];
    return rows.map(mapNoteRow);
  }

  // Highlight operations
  async upsertHighlight(
    verseKey: string,
    surahNumber: number,
    ayahNumber: number,
    color: HighlightColor,
    rewayahId?: string,
  ): Promise<VerseHighlight> {
    const db = await this.ensureReady();

    const now = Date.now();
    const id = generateId();

    // @ai-start
    await this.serializeWrite(() =>
      db.runAsync(UPSERT_HIGHLIGHT_SQL, [
        id,
        verseKey,
        surahNumber,
        ayahNumber,
        color,
        now,
        rewayahId ?? null,
      ]),
    );
    // @ai-end

    return {
      id,
      verseKey,
      surahNumber,
      ayahNumber,
      color,
      createdAt: now,
      rewayahId: rewayahId as VerseHighlight['rewayahId'],
    };
  }

  async removeHighlight(verseKey: string): Promise<void> {
    const db = await this.ensureReady();
    // @ai-start
    await this.serializeWrite(() =>
      db.runAsync(`DELETE FROM highlights WHERE verse_key = ?`, [verseKey]),
    );
    // @ai-end
  }

  // @ai-start
  /**
   * Applies the bookmark and highlight writes of one change in ONE
   * transaction: every write, or, when any of them fails, none (the error is
   * thrown and the rows stay as they were). Deletes run first, then inserts
   * and upserts, written exactly as addBookmark / upsertHighlight write
   * them. Rows the change does not name are not touched. Like every write
   * here it runs after the writes issued before it and before those issued
   * while it is open (serializeWrite), so none of them joins its transaction.
   */
  async applyAnnotationChanges(changes: AnnotationRowChanges): Promise<void> {
    const db = await this.ensureReady();
    const apply = () =>
      db.withTransactionAsync(async () => {
        // created_at a new highlight row carries over, read before any write.
        const createdAt = new Map<string, number>();
        for (const {createdAtOf} of changes.upsertHighlights ?? []) {
          if (!createdAtOf || createdAt.has(createdAtOf)) continue;
          const row = await db.getFirstAsync<{created_at: number}>(
            `SELECT created_at FROM highlights WHERE verse_key = ?`,
            [createdAtOf],
          );
          if (row) createdAt.set(createdAtOf, row.created_at);
        }
        for (const verseKey of changes.removeBookmarks ?? []) {
          await db.runAsync(`DELETE FROM bookmarks WHERE verse_key = ?`, [
            verseKey,
          ]);
        }
        for (const verseKey of changes.removeHighlights ?? []) {
          await db.runAsync(`DELETE FROM highlights WHERE verse_key = ?`, [
            verseKey,
          ]);
        }
        for (const row of changes.addBookmarks ?? []) {
          await db.runAsync(INSERT_BOOKMARK_SQL, [
            generateId(),
            row.verseKey,
            row.surahNumber,
            row.ayahNumber,
            Date.now(),
            row.rewayahId,
          ]);
        }
        for (const row of changes.upsertHighlights ?? []) {
          const kept = row.createdAtOf
            ? createdAt.get(row.createdAtOf)
            : undefined;
          await db.runAsync(UPSERT_HIGHLIGHT_SQL, [
            generateId(),
            row.verseKey,
            row.surahNumber,
            row.ayahNumber,
            row.color,
            kept ?? Date.now(),
            row.rewayahId,
          ]);
        }
      });
    return this.serializeWrite(apply);
  }
  // @ai-end

  async getHighlightsBySurah(surahNumber: number): Promise<VerseHighlight[]> {
    const db = await this.ensureReady();
    const rows = (await db.getAllAsync(
      `SELECT * FROM highlights WHERE surah_number = ? ORDER BY ayah_number`,
      [surahNumber],
    )) as HighlightRow[];
    return rows.map(mapHighlightRow);
  }

  // Batch fetch for a surah
  async getAnnotationsForSurah(surahNumber: number): Promise<{
    bookmarks: VerseBookmark[];
    notes: VerseNote[];
    highlights: VerseHighlight[];
  }> {
    const [bookmarks, notes, highlights] = await Promise.all([
      this.getBookmarksBySurah(surahNumber),
      this.getNotesBySurah(surahNumber),
      this.getHighlightsBySurah(surahNumber),
    ]);
    return {bookmarks, notes, highlights};
  }

  async close(): Promise<void> {
    if (this.db) {
      await this.db.closeAsync();
      this.db = null;
    }
  }
}

export const verseAnnotationDatabaseService =
  new VerseAnnotationDatabaseService();
