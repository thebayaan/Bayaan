import * as SQLite from 'expo-sqlite';
import type {DownloadedTranslationMeta} from '@/types/translation';

interface TranslationRow {
  verse_key: string;
  text: string;
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

class TranslationDbService {
  private db: SQLite.SQLiteDatabase | null = null;
  private initPromise: Promise<void> | null = null;
  private ready = false;

  async initialize(): Promise<void> {
    if (this.ready) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        this.db = await SQLite.openDatabaseAsync('translations.db');
        await this.createTables();
        this.ready = true;
        console.log('[TranslationDbService] Initialized');
      } catch (error) {
        console.error('[TranslationDbService] Init failed:', error);
        this.initPromise = null;
        throw error;
      }
    })();

    return this.initPromise;
  }

  private async createTables() {
    if (!this.db) return;
    await this.db.execAsync('PRAGMA journal_mode = WAL;');
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS translation_metadata (
        identifier TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        english_name TEXT NOT NULL,
        language TEXT NOT NULL,
        direction TEXT NOT NULL DEFAULT 'ltr',
        downloaded_at INTEGER NOT NULL,
        verse_count INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS translations (
        identifier TEXT NOT NULL,
        verse_key TEXT NOT NULL,
        surah_number INTEGER NOT NULL,
        ayah_number INTEGER NOT NULL,
        text TEXT NOT NULL,
        PRIMARY KEY (identifier, verse_key)
      );

      CREATE INDEX IF NOT EXISTS idx_translations_surah
        ON translations (identifier, surah_number);
    `);
  }

  private async ensureReady(): Promise<SQLite.SQLiteDatabase> {
    if (!this.ready && this.initPromise) await this.initPromise;
    if (!this.db || !this.ready) {
      throw new Error('TranslationDbService not initialized');
    }
    return this.db;
  }

  async saveTranslation(
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
    }>,
  ): Promise<void> {
    const db = await this.ensureReady();

    await db.withTransactionAsync(async () => {
      // Clear existing data for this identifier (re-download case)
      await db.runAsync('DELETE FROM translations WHERE identifier = ?', [
        identifier,
      ]);
      await db.runAsync(
        'DELETE FROM translation_metadata WHERE identifier = ?',
        [identifier],
      );

      // Insert verses in batches of 500
      const BATCH_SIZE = 500;
      for (let i = 0; i < verses.length; i += BATCH_SIZE) {
        const batch = verses.slice(i, i + BATCH_SIZE);
        const placeholders = batch.map(() => '(?, ?, ?, ?, ?)').join(', ');
        const values: (string | number)[] = [];
        for (const v of batch) {
          values.push(
            identifier,
            v.verseKey,
            v.surahNumber,
            v.ayahNumber,
            v.text,
          );
        }
        await db.runAsync(
          `INSERT INTO translations (identifier, verse_key, surah_number, ayah_number, text) VALUES ${placeholders}`,
          values,
        );
      }

      // Save metadata
      await db.runAsync(
        `INSERT INTO translation_metadata (identifier, name, english_name, language, direction, downloaded_at, verse_count)
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
      `[TranslationDbService] Saved ${verses.length} verses for ${identifier}`,
    );
  }

  async getAllVerses(identifier: string): Promise<Record<string, string>> {
    const db = await this.ensureReady();
    const rows = (await db.getAllAsync(
      'SELECT verse_key, text FROM translations WHERE identifier = ?',
      [identifier],
    )) as TranslationRow[];

    const result: Record<string, string> = {};
    for (const row of rows) {
      result[row.verse_key] = row.text;
    }
    return result;
  }

  async getTranslation(
    verseKey: string,
    identifier: string,
  ): Promise<string | null> {
    const db = await this.ensureReady();
    const row = (await db.getFirstAsync(
      'SELECT text FROM translations WHERE identifier = ? AND verse_key = ?',
      [identifier, verseKey],
    )) as {text: string} | null;
    return row?.text ?? null;
  }

  async deleteTranslation(identifier: string): Promise<void> {
    const db = await this.ensureReady();
    await db.withTransactionAsync(async () => {
      await db.runAsync('DELETE FROM translations WHERE identifier = ?', [
        identifier,
      ]);
      await db.runAsync(
        'DELETE FROM translation_metadata WHERE identifier = ?',
        [identifier],
      );
    });
    console.log(`[TranslationDbService] Deleted ${identifier}`);
  }

  async getDownloadedTranslations(): Promise<DownloadedTranslationMeta[]> {
    const db = await this.ensureReady();
    const rows = (await db.getAllAsync(
      'SELECT * FROM translation_metadata ORDER BY downloaded_at DESC',
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
      'SELECT 1 FROM translation_metadata WHERE identifier = ?',
      [identifier],
    );
    return row != null;
  }
}

export const translationDbService = new TranslationDbService();
