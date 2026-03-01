import * as SQLite from 'expo-sqlite';
import type {DownloadedTafseerMeta} from '@/types/tafseer';

export interface TafseerResult {
  text: string;
  fromAyah: number;
  toAyah: number;
  surahNumber: number;
}

interface TafseerRow {
  verse_key: string;
  text: string;
  group_verse_key: string | null;
  from_ayah: number | null;
  to_ayah: number | null;
}

interface MetadataRow {
  identifier: string;
  name: string;
  english_name: string;
  language: string;
  direction: string;
  downloaded_at: number;
  verse_count: number;
}

class TafseerDbService {
  private db: SQLite.SQLiteDatabase | null = null;
  private initPromise: Promise<void> | null = null;
  private ready = false;

  async initialize(): Promise<void> {
    if (this.ready) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        this.db = await SQLite.openDatabaseAsync('tafaseer.db');
        await this.createTables();
        this.ready = true;
        console.log('[TafseerDbService] Initialized');
      } catch (error) {
        console.error('[TafseerDbService] Init failed:', error);
        this.initPromise = null;
        throw error;
      }
    })();

    return this.initPromise;
  }

  private static readonly CURRENT_SCHEMA_VERSION = 1;

  private async createTables() {
    if (!this.db) return;
    await this.db.execAsync('PRAGMA journal_mode = WAL;');
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS tafseer_metadata (
        identifier TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        english_name TEXT NOT NULL,
        language TEXT NOT NULL,
        direction TEXT NOT NULL DEFAULT 'rtl',
        downloaded_at INTEGER NOT NULL,
        verse_count INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS tafaseer (
        identifier TEXT NOT NULL,
        verse_key TEXT NOT NULL,
        surah_number INTEGER NOT NULL,
        ayah_number INTEGER NOT NULL,
        text TEXT NOT NULL,
        group_verse_key TEXT,
        from_ayah INTEGER,
        to_ayah INTEGER,
        PRIMARY KEY (identifier, verse_key)
      );

      CREATE INDEX IF NOT EXISTS idx_tafaseer_surah
        ON tafaseer (identifier, surah_number);

      CREATE TABLE IF NOT EXISTS schema_version (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        version INTEGER NOT NULL DEFAULT 0
      );
    `);

    // Insert default version if table is empty
    await this.db.runAsync(
      'INSERT OR IGNORE INTO schema_version (id, version) VALUES (1, 0)',
    );

    await this.runMigrations();
  }

  private async runMigrations() {
    if (!this.db) return;
    const row = (await this.db.getFirstAsync(
      'SELECT version FROM schema_version WHERE id = 1',
    )) as {version: number} | null;
    const currentVersion = row?.version ?? 0;

    if (currentVersion < 1) {
      // Add grouping columns (no-op on fresh installs where CREATE TABLE already includes them)
      const columns = [
        'group_verse_key TEXT',
        'from_ayah INTEGER',
        'to_ayah INTEGER',
      ];
      for (const col of columns) {
        try {
          await this.db.execAsync(`ALTER TABLE tafaseer ADD COLUMN ${col}`);
        } catch {
          // Column already exists (fresh install) — safe to ignore
        }
      }
      await this.db.runAsync(
        'UPDATE schema_version SET version = 1 WHERE id = 1',
      );
      console.log('[TafseerDbService] Migrated to schema version 1');
    }
  }

  private async ensureReady(): Promise<SQLite.SQLiteDatabase> {
    if (!this.ready && this.initPromise) await this.initPromise;
    if (!this.db || !this.ready) {
      throw new Error('TafseerDbService not initialized');
    }
    return this.db;
  }

  async saveTafseer(
    identifier: string,
    name: string,
    englishName: string,
    language: string,
    direction: string,
    verses: Array<{
      verseKey: string;
      surahNumber: number;
      ayahNumber: number;
      text: string;
      groupVerseKey?: string;
      fromAyah?: number;
      toAyah?: number;
    }>,
  ): Promise<void> {
    const db = await this.ensureReady();

    await db.withTransactionAsync(async () => {
      // Clear existing data for this identifier (re-download case)
      await db.runAsync('DELETE FROM tafaseer WHERE identifier = ?', [
        identifier,
      ]);
      await db.runAsync('DELETE FROM tafseer_metadata WHERE identifier = ?', [
        identifier,
      ]);

      // Insert verses in batches of 500
      const BATCH_SIZE = 500;
      for (let i = 0; i < verses.length; i += BATCH_SIZE) {
        const batch = verses.slice(i, i + BATCH_SIZE);
        const placeholders = batch
          .map(() => '(?, ?, ?, ?, ?, ?, ?, ?)')
          .join(', ');
        const values: (string | number | null)[] = [];
        for (const v of batch) {
          values.push(
            identifier,
            v.verseKey,
            v.surahNumber,
            v.ayahNumber,
            v.text,
            v.groupVerseKey ?? v.verseKey,
            v.fromAyah ?? v.ayahNumber,
            v.toAyah ?? v.ayahNumber,
          );
        }
        await db.runAsync(
          `INSERT INTO tafaseer (identifier, verse_key, surah_number, ayah_number, text, group_verse_key, from_ayah, to_ayah) VALUES ${placeholders}`,
          values,
        );
      }

      // Save metadata
      await db.runAsync(
        `INSERT INTO tafseer_metadata (identifier, name, english_name, language, direction, downloaded_at, verse_count)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          identifier,
          name,
          englishName,
          language,
          direction,
          Date.now(),
          verses.length,
        ],
      );
    });

    console.log(
      `[TafseerDbService] Saved ${verses.length} verses for ${identifier}`,
    );
  }

  async getTafseerForVerse(
    verseKey: string,
    identifier: string,
  ): Promise<TafseerResult | null> {
    const db = await this.ensureReady();

    const parts = verseKey.split(':');
    const surahNumber = parseInt(parts[0], 10);

    // Try exact match first, then fall back to nearest previous verse in same
    // surah (handles grouped tafaseer where only the group's first verse is stored)
    const row = (await db.getFirstAsync(
      'SELECT text, surah_number, from_ayah, to_ayah FROM tafaseer WHERE identifier = ? AND verse_key = ?',
      [identifier, verseKey],
    )) as {
      text: string;
      surah_number: number;
      from_ayah: number | null;
      to_ayah: number | null;
    } | null;

    if (row) {
      return {
        text: row.text,
        fromAyah: row.from_ayah ?? parseInt(parts[1], 10),
        toAyah: row.to_ayah ?? parseInt(parts[1], 10),
        surahNumber: row.surah_number,
      };
    }

    // Fallback: nearest previous entry in same surah
    const fallback = (await db.getFirstAsync(
      `SELECT text, surah_number, from_ayah, to_ayah FROM tafaseer
       WHERE identifier = ? AND surah_number = ? AND ayah_number < ?
       ORDER BY ayah_number DESC
       LIMIT 1`,
      [identifier, surahNumber, parseInt(parts[1], 10)],
    )) as {
      text: string;
      surah_number: number;
      from_ayah: number | null;
      to_ayah: number | null;
    } | null;

    if (!fallback) return null;

    return {
      text: fallback.text,
      fromAyah: fallback.from_ayah ?? parseInt(parts[1], 10),
      toAyah: fallback.to_ayah ?? parseInt(parts[1], 10),
      surahNumber: fallback.surah_number,
    };
  }

  async getAllVerses(identifier: string): Promise<Record<string, string>> {
    const db = await this.ensureReady();
    const rows = (await db.getAllAsync(
      'SELECT verse_key, text FROM tafaseer WHERE identifier = ?',
      [identifier],
    )) as TafseerRow[];

    const result: Record<string, string> = {};
    for (const row of rows) {
      result[row.verse_key] = row.text;
    }
    return result;
  }

  async deleteTafseer(identifier: string): Promise<void> {
    const db = await this.ensureReady();
    await db.withTransactionAsync(async () => {
      await db.runAsync('DELETE FROM tafaseer WHERE identifier = ?', [
        identifier,
      ]);
      await db.runAsync('DELETE FROM tafseer_metadata WHERE identifier = ?', [
        identifier,
      ]);
    });
    console.log(`[TafseerDbService] Deleted ${identifier}`);
  }

  async getDownloadedTafaseer(): Promise<DownloadedTafseerMeta[]> {
    const db = await this.ensureReady();
    const rows = (await db.getAllAsync(
      'SELECT * FROM tafseer_metadata ORDER BY downloaded_at DESC',
    )) as MetadataRow[];

    return rows.map(row => ({
      identifier: row.identifier,
      name: row.name,
      englishName: row.english_name,
      language: row.language,
      direction: row.direction as 'ltr' | 'rtl',
      downloadedAt: row.downloaded_at,
      verseCount: row.verse_count,
    }));
  }

  async isDownloaded(identifier: string): Promise<boolean> {
    const db = await this.ensureReady();
    const row = await db.getFirstAsync(
      'SELECT 1 FROM tafseer_metadata WHERE identifier = ?',
      [identifier],
    );
    return row != null;
  }
}

export const tafseerDbService = new TafseerDbService();
