import * as SQLite from 'expo-sqlite';
import type {
  VerseBookmark,
  VerseNote,
  VerseHighlight,
  HighlightColor,
} from '@/types/verse-annotations';

// Database row types (snake_case)
interface BookmarkRow {
  id: string;
  verse_key: string;
  surah_number: number;
  ayah_number: number;
  created_at: number;
}

interface NoteRow {
  id: string;
  verse_key: string;
  surah_number: number;
  ayah_number: number;
  content: string;
  created_at: number;
  updated_at: number;
}

interface HighlightRow {
  id: string;
  verse_key: string;
  surah_number: number;
  ayah_number: number;
  color: string;
  created_at: number;
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function mapBookmarkRow(row: BookmarkRow): VerseBookmark {
  return {
    id: row.id,
    verseKey: row.verse_key,
    surahNumber: row.surah_number,
    ayahNumber: row.ayah_number,
    createdAt: row.created_at,
  };
}

function mapNoteRow(row: NoteRow): VerseNote {
  return {
    id: row.id,
    verseKey: row.verse_key,
    surahNumber: row.surah_number,
    ayahNumber: row.ayah_number,
    content: row.content,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
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
  };
}

class VerseAnnotationDatabaseService {
  private db: SQLite.SQLiteDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  async initialize(): Promise<void> {
    if (this.db) return;

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      try {
        this.db = await SQLite.openDatabaseAsync('verse-annotations.db');
        await this.createTables();
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
        verse_key TEXT NOT NULL UNIQUE,
        surah_number INTEGER NOT NULL,
        ayah_number INTEGER NOT NULL,
        content TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);

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
  }

  // Bookmark operations
  async addBookmark(
    verseKey: string,
    surahNumber: number,
    ayahNumber: number,
  ): Promise<VerseBookmark> {
    if (!this.db) throw new Error('Database not initialized');

    const bookmark: VerseBookmark = {
      id: generateId(),
      verseKey,
      surahNumber,
      ayahNumber,
      createdAt: Date.now(),
    };

    await this.db.runAsync(
      `INSERT INTO bookmarks (id, verse_key, surah_number, ayah_number, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [
        bookmark.id,
        bookmark.verseKey,
        bookmark.surahNumber,
        bookmark.ayahNumber,
        bookmark.createdAt,
      ],
    );

    return bookmark;
  }

  async removeBookmark(verseKey: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    await this.db.runAsync(`DELETE FROM bookmarks WHERE verse_key = ?`, [
      verseKey,
    ]);
  }

  async getBookmarksBySurah(surahNumber: number): Promise<VerseBookmark[]> {
    if (!this.db) throw new Error('Database not initialized');
    const rows = (await this.db.getAllAsync(
      `SELECT * FROM bookmarks WHERE surah_number = ? ORDER BY ayah_number`,
      [surahNumber],
    )) as BookmarkRow[];
    return rows.map(mapBookmarkRow);
  }

  async getAllBookmarks(): Promise<VerseBookmark[]> {
    if (!this.db) throw new Error('Database not initialized');
    const rows = (await this.db.getAllAsync(
      `SELECT * FROM bookmarks ORDER BY created_at DESC`,
    )) as BookmarkRow[];
    return rows.map(mapBookmarkRow);
  }

  async isBookmarked(verseKey: string): Promise<boolean> {
    if (!this.db) throw new Error('Database not initialized');
    const row = await this.db.getFirstAsync(
      `SELECT id FROM bookmarks WHERE verse_key = ?`,
      [verseKey],
    );
    return row !== null;
  }

  // Note operations
  async upsertNote(
    verseKey: string,
    surahNumber: number,
    ayahNumber: number,
    content: string,
  ): Promise<VerseNote> {
    if (!this.db) throw new Error('Database not initialized');

    const now = Date.now();
    const id = generateId();

    await this.db.runAsync(
      `INSERT INTO notes (id, verse_key, surah_number, ayah_number, content, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(verse_key) DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at`,
      [id, verseKey, surahNumber, ayahNumber, content, now, now],
    );

    return {
      id,
      verseKey,
      surahNumber,
      ayahNumber,
      content,
      createdAt: now,
      updatedAt: now,
    };
  }

  async getNote(verseKey: string): Promise<VerseNote | null> {
    if (!this.db) throw new Error('Database not initialized');
    const row = (await this.db.getFirstAsync(
      `SELECT * FROM notes WHERE verse_key = ?`,
      [verseKey],
    )) as NoteRow | null;
    return row ? mapNoteRow(row) : null;
  }

  async deleteNote(verseKey: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    await this.db.runAsync(`DELETE FROM notes WHERE verse_key = ?`, [verseKey]);
  }

  async getNotesBySurah(surahNumber: number): Promise<VerseNote[]> {
    if (!this.db) throw new Error('Database not initialized');
    const rows = (await this.db.getAllAsync(
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
  ): Promise<VerseHighlight> {
    if (!this.db) throw new Error('Database not initialized');

    const now = Date.now();
    const id = generateId();

    await this.db.runAsync(
      `INSERT INTO highlights (id, verse_key, surah_number, ayah_number, color, created_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(verse_key) DO UPDATE SET color = excluded.color`,
      [id, verseKey, surahNumber, ayahNumber, color, now],
    );

    return {
      id,
      verseKey,
      surahNumber,
      ayahNumber,
      color,
      createdAt: now,
    };
  }

  async removeHighlight(verseKey: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    await this.db.runAsync(`DELETE FROM highlights WHERE verse_key = ?`, [
      verseKey,
    ]);
  }

  async getHighlightsBySurah(surahNumber: number): Promise<VerseHighlight[]> {
    if (!this.db) throw new Error('Database not initialized');
    const rows = (await this.db.getAllAsync(
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
