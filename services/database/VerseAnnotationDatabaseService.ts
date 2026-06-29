import * as SQLite from 'expo-sqlite';
import type {
  VerseBookmark,
  VerseNote,
  VerseHighlight,
  HighlightColor,
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

    // Migration: drop UNIQUE constraint if it exists from older schema
    // SQLite doesn't support ALTER TABLE DROP CONSTRAINT, so we check and recreate
    try {
      const tableInfo = (await this.db.getAllAsync(
        `PRAGMA index_list(notes)`,
      )) as Array<{name: string; unique: number}>;
      const hasUniqueIndex = tableInfo.some(
        idx =>
          idx.unique === 1 &&
          idx.name !== 'sqlite_autoindex_notes_1' &&
          idx.name.includes('verse_key'),
      );
      // If there's a sqlite autoindex from UNIQUE constraint, recreate table
      const hasAutoIndex = tableInfo.some(
        idx => idx.name === 'sqlite_autoindex_notes_1',
      );
      if (hasAutoIndex || hasUniqueIndex) {
        await this.db.execAsync(`
          CREATE TABLE IF NOT EXISTS notes_new (
            id TEXT PRIMARY KEY,
            verse_key TEXT NOT NULL,
            surah_number INTEGER NOT NULL,
            ayah_number INTEGER NOT NULL,
            content TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
          );
        `);
        await this.db.execAsync(`
          INSERT OR IGNORE INTO notes_new SELECT * FROM notes;
        `);
        await this.db.execAsync(`DROP TABLE notes;`);
        await this.db.execAsync(`ALTER TABLE notes_new RENAME TO notes;`);
      }
    } catch {
      // Migration already done or not needed
    }

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

    await db.runAsync(
      `INSERT INTO bookmarks (id, verse_key, surah_number, ayah_number, created_at, rewayah_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        bookmark.id,
        bookmark.verseKey,
        bookmark.surahNumber,
        bookmark.ayahNumber,
        bookmark.createdAt,
        bookmark.rewayahId ?? null,
      ],
    );

    return bookmark;
  }

  async removeBookmark(verseKey: string): Promise<void> {
    const db = await this.ensureReady();
    await db.runAsync(`DELETE FROM bookmarks WHERE verse_key = ?`, [verseKey]);
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

    await db.runAsync(
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
    );

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
    await db.runAsync(
      `UPDATE notes SET content = ?, updated_at = ? WHERE id = ?`,
      [content, Date.now(), noteId],
    );
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
    await db.runAsync(`DELETE FROM notes WHERE id = ?`, [noteId]);
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

    await db.runAsync(
      `INSERT INTO highlights (id, verse_key, surah_number, ayah_number, color, created_at, rewayah_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(verse_key) DO UPDATE SET color = excluded.color, rewayah_id = excluded.rewayah_id`,
      [id, verseKey, surahNumber, ayahNumber, color, now, rewayahId ?? null],
    );

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
    await db.runAsync(`DELETE FROM highlights WHERE verse_key = ?`, [verseKey]);
  }

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
