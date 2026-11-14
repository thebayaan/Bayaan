import * as SQLite from 'expo-sqlite';
import {
  decodeEntries,
  decodeMorph,
  type IrabBookPassages,
  type WordIrab,
} from './irabFormat';

/**
 * The bundled i'rab database. The file name carries its version: a new build
 * of the data ships as a new file, so installed apps never keep a stale
 * import (bundled databases are imported once).
 */
const DB_NAME = 'irab-v1.db';
const OLD_DB_NAMES: readonly string[] = [];

class IrabDataService {
  private db: SQLite.SQLiteDatabase | null = null;
  private texts: string[] = [];
  private verseCache = new Map<string, WordIrab[]>();
  private initializing: Promise<void> | null = null;

  /** Opens the database on first use (not at app start). */
  initialize(): Promise<void> {
    if (this.db) return Promise.resolve();
    if (!this.initializing) {
      this.initializing = this.open().catch(error => {
        this.initializing = null;
        throw error;
      });
    }
    return this.initializing;
  }

  private async open(): Promise<void> {
    let db = await SQLite.openDatabaseAsync(DB_NAME);
    // Imported and complete (the morph column is part of this build).
    const ready = await db
      .getFirstAsync<{
        name: string;
      }>("SELECT name FROM pragma_table_info('word_irab') WHERE name='morph'")
      .catch(() => null);
    if (!ready) {
      await db.closeAsync();
      await SQLite.deleteDatabaseAsync(DB_NAME);
      await SQLite.importDatabaseFromAssetAsync(DB_NAME, {
        assetId: require('../../assets/data/irab-v1.db'),
      });
      db = await SQLite.openDatabaseAsync(DB_NAME);
      for (const old of OLD_DB_NAMES) {
        await SQLite.deleteDatabaseAsync(old).catch(() => undefined);
      }
    }
    const rows = await db.getAllAsync<{id: number; text: string}>(
      'SELECT id, text FROM texts ORDER BY id',
    );
    const texts: string[] = [];
    for (const row of rows) texts[row.id] = row.text;
    this.texts = texts;
    this.db = db;
  }

  /** Every word of a (Hafs) verse with its i'rab, in word order. */
  async getVerse(verseKey: string): Promise<WordIrab[]> {
    const cached = this.verseCache.get(verseKey);
    if (cached) return cached;
    await this.initialize();
    const rows = await this.db!.getAllAsync<{
      position: number;
      entries: string;
      agreed: number;
      morph: string;
    }>(
      'SELECT position, entries, agreed, morph FROM word_irab WHERE verse_key = ? ORDER BY position',
      [verseKey],
    );
    const words = rows.map(row => ({
      position: row.position,
      entries: decodeEntries(row.entries, this.texts),
      agreed: row.agreed === 1,
      morph: decodeMorph(row.morph, this.texts),
    }));
    this.verseCache.set(verseKey, words);
    return words;
  }

  /** The classical i'rab books' passages that discuss a (Hafs) verse. */
  async getBooks(verseKey: string): Promise<IrabBookPassages[]> {
    await this.initialize();
    const rows = await this.db!.getAllAsync<{
      book_id: number;
      name_ar: string;
      author_ar: string;
      text: string;
      part: string;
      page: string;
    }>(
      `SELECT b.id AS book_id, b.name_ar, b.author_ar, p.text, p.part, p.page
         FROM verse_passages v
         JOIN books b ON b.id = v.book_id
         JOIN passages p ON p.id = v.passage_id
        WHERE v.verse_key = ?
        ORDER BY b.id, v.ord`,
      [verseKey],
    );
    const books = new Map<number, IrabBookPassages>();
    for (const row of rows) {
      let book = books.get(row.book_id);
      if (!book) {
        book = {
          bookId: row.book_id,
          nameAr: row.name_ar,
          authorAr: row.author_ar,
          passages: [],
        };
        books.set(row.book_id, book);
      }
      book.passages.push({text: row.text, part: row.part, page: row.page});
    }
    return [...books.values()];
  }
}

export const irabDataService = new IrabDataService();
