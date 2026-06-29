import * as SQLite from 'expo-sqlite';

export interface WBWWord {
  position: number;
  textUthmani: string;
  translation: string;
  transliteration: string;
  audioUrl: string;
}

class WBWDataService {
  private db: SQLite.SQLiteDatabase | null = null;
  private cache: Map<string, WBWWord[]> = new Map();
  private _initialized = false;
  private _initializing: Promise<void> | null = null;

  get initialized(): boolean {
    return this._initialized;
  }

  async initialize(): Promise<void> {
    if (this._initialized) return;
    if (this._initializing) return this._initializing;
    this._initializing = this._doInit();
    return this._initializing;
  }

  private async _doInit(): Promise<void> {
    try {
      const dbName = 'wbw-en.db';
      let db = await SQLite.openDatabaseAsync(dbName);

      const tableCheck = await db
        .getFirstAsync<{
          name: string;
        }>("SELECT name FROM sqlite_master WHERE type='table' AND name='words';")
        .catch(() => null);

      if (!tableCheck) {
        await db.closeAsync();
        await SQLite.deleteDatabaseAsync(dbName);
        await SQLite.importDatabaseFromAssetAsync(dbName, {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          assetId: require('../../data/wbw/wbw-en.db'),
        });
        db = await SQLite.openDatabaseAsync(dbName);
      }

      this.db = db;
      this._initialized = true;
      console.log('[WBWDataService] Initialized');
    } catch (error) {
      console.error('[WBWDataService] Initialization failed:', error);
      this._initializing = null;
      throw error;
    }
  }

  /** Synchronous cache-only lookup — returns null on cache miss */
  getVerseWordsCached(verseKey: string): WBWWord[] | null {
    return this.cache.get(verseKey) ?? null;
  }

  async getVerseWords(verseKey: string): Promise<WBWWord[]> {
    const cached = this.cache.get(verseKey);
    if (cached) return cached;

    if (!this.db) return [];

    const rows = await this.db.getAllAsync<{
      position: number;
      text_uthmani: string;
      translation: string;
      transliteration: string;
      audio_url: string;
    }>(
      'SELECT position, text_uthmani, translation, transliteration, audio_url FROM words WHERE verse_key = ? ORDER BY position',
      [verseKey],
    );

    const words: WBWWord[] = rows.map(row => ({
      position: row.position,
      textUthmani: row.text_uthmani || '',
      translation: row.translation,
      transliteration: row.transliteration,
      audioUrl: row.audio_url,
    }));

    this.cache.set(verseKey, words);
    return words;
  }
}

export const wbwDataService = new WBWDataService();
