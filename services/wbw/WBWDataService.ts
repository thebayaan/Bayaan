import * as SQLite from 'expo-sqlite';

export interface WBWWord {
  position: number;
  textUthmani: string;
  translation: string;
  transliteration: string;
  audioUrl: string;
}

/**
 * Transliterations that wbw-en.db holds damaged, by 's:a:w': a letter of
 * each became U+FFFD when the file was fetched. Each takes the spelling the
 * file gives every other copy of the same Arabic word (2:172:6, 2:198:6 and
 * 2:158:24 among them). The installed copy of the database is never
 * replaced, so the fix lives here rather than in the file.
 */
export const WBW_TRANSLITERATION_FIXES: Readonly<Record<string, string>> = {
  '2:57:10': 'ṭayyibāti',
  '5:2:20': 'faḍlan',
  '24:18:6': 'ʿalīmun',
};

/**
 * A word-by-word text as the app shows it: one holding U+FFFD (a lost
 * letter) is missing, '', which hides its line in the grid and in Word
 * Study, like a word with no data.
 */
function readable(text: string | null): string {
  return text && !text.includes('\uFFFD') ? text : '';
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
        }>(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='words';",
        )
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
      translation: readable(row.translation),
      transliteration:
        readable(row.transliteration) ||
        (WBW_TRANSLITERATION_FIXES[`${verseKey}:${row.position}`] ?? ''),
      audioUrl: row.audio_url,
    }));

    this.cache.set(verseKey, words);
    return words;
  }
}

export const wbwDataService = new WBWDataService();
