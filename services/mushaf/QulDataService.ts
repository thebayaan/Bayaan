import * as SQLite from 'expo-sqlite';
import type {Theme, SimilarAyah, MutashabihatPhrase} from '@/types/qul';

class QulDataService {
  private themesDb: SQLite.SQLiteDatabase | null = null;
  private similarDb: SQLite.SQLiteDatabase | null = null;
  private mutashabihatDb: SQLite.SQLiteDatabase | null = null;
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
      await Promise.all([
        this.openThemesDb(),
        this.openSimilarDb(),
        this.openMutashabihatDb(),
      ]);
      this._initialized = true;
      console.log('[QulDataService] All 3 databases initialized');
    } catch (error) {
      console.error('[QulDataService] Initialization failed:', error);
      this._initializing = null;
      throw error;
    }
  }

  private async openThemesDb(): Promise<void> {
    const dbName = 'qul_themes.db';
    let db = await SQLite.openDatabaseAsync(dbName);
    const check = await db
      .getFirstAsync<{name: string}>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='themes';",
      )
      .catch(() => null);
    if (!check) {
      await db.closeAsync();
      await SQLite.deleteDatabaseAsync(dbName);
      await SQLite.importDatabaseFromAssetAsync(dbName, {
        assetId: require('../../assets/data/ayah-themes.db'),
      });
      db = await SQLite.openDatabaseAsync(dbName);
    }
    this.themesDb = db;
  }

  private async openSimilarDb(): Promise<void> {
    const dbName = 'qul_similar.db';
    let db = await SQLite.openDatabaseAsync(dbName);
    const check = await db
      .getFirstAsync<{name: string}>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='similar_ayahs';",
      )
      .catch(() => null);
    if (!check) {
      await db.closeAsync();
      await SQLite.deleteDatabaseAsync(dbName);
      await SQLite.importDatabaseFromAssetAsync(dbName, {
        assetId: require('../../assets/data/matching-ayah.db'),
      });
      db = await SQLite.openDatabaseAsync(dbName);
    }
    this.similarDb = db;
  }

  private async openMutashabihatDb(): Promise<void> {
    const dbName = 'qul_mutashabihat.db';
    let db = await SQLite.openDatabaseAsync(dbName);
    const check = await db
      .getFirstAsync<{name: string}>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='phrases';",
      )
      .catch(() => null);
    if (!check) {
      await db.closeAsync();
      await SQLite.deleteDatabaseAsync(dbName);
      await SQLite.importDatabaseFromAssetAsync(dbName, {
        assetId: require('../../assets/data/mutashabihat.db'),
      });
      db = await SQLite.openDatabaseAsync(dbName);
    }
    this.mutashabihatDb = db;
  }

  async getThemesForVerse(
    surahNumber: number,
    ayahNumber: number,
  ): Promise<Theme[]> {
    if (!this.themesDb) return [];
    const rows = await this.themesDb.getAllAsync<{
      theme: string;
      keywords: string;
      ayah_from: number;
      ayah_to: number;
      total_ayahs: number;
    }>(
      'SELECT theme, keywords, ayah_from, ayah_to, total_ayahs FROM themes WHERE surah_number = ? AND ? BETWEEN ayah_from AND ayah_to',
      [surahNumber, ayahNumber],
    );
    return rows.map(r => ({
      theme: r.theme,
      keywords: r.keywords,
      ayahFrom: r.ayah_from,
      ayahTo: r.ayah_to,
      totalAyahs: r.total_ayahs,
    }));
  }

  async getSimilarAyahs(
    verseKey: string,
    minScore = 0,
  ): Promise<SimilarAyah[]> {
    if (!this.similarDb) return [];
    const rows = await this.similarDb.getAllAsync<{
      matched_ayah_key: string;
      matched_words_count: number;
      coverage: number;
      score: number;
      match_words_range: string;
    }>(
      'SELECT matched_ayah_key, matched_words_count, coverage, score, match_words_range FROM similar_ayahs WHERE verse_key = ? AND score >= ? ORDER BY score DESC',
      [verseKey, minScore],
    );
    return rows.map(r => ({
      matchedVerseKey: r.matched_ayah_key,
      matchedWordsCount: r.matched_words_count,
      coverage: r.coverage,
      score: r.score,
      matchWordsRange: JSON.parse(r.match_words_range) as number[][],
    }));
  }

  async getMutashabihatForVerse(
    verseKey: string,
  ): Promise<MutashabihatPhrase[]> {
    if (!this.mutashabihatDb) return [];

    // Get phrase IDs for this verse
    const phraseLinks = await this.mutashabihatDb.getAllAsync<{
      phrase_id: number;
    }>('SELECT phrase_id FROM phrase_verses WHERE verse_key = ?', [verseKey]);

    if (phraseLinks.length === 0) return [];

    const results: MutashabihatPhrase[] = [];

    for (const link of phraseLinks) {
      const phrase = await this.mutashabihatDb.getFirstAsync<{
        id: number;
        source_verse: string;
        source_from: number;
        source_to: number;
        count: number;
      }>(
        'SELECT id, source_verse, source_from, source_to, count FROM phrases WHERE id = ?',
        [link.phrase_id],
      );
      if (!phrase) continue;

      const matches = await this.mutashabihatDb.getAllAsync<{
        verse_key: string;
        word_from: number;
        word_to: number;
      }>(
        'SELECT verse_key, word_from, word_to FROM phrase_matches WHERE phrase_id = ?',
        [phrase.id],
      );

      // Group matches by verse_key
      const byVerse = new Map<string, [number, number][]>();
      for (const m of matches) {
        const existing = byVerse.get(m.verse_key);
        if (existing) {
          existing.push([m.word_from, m.word_to]);
        } else {
          byVerse.set(m.verse_key, [[m.word_from, m.word_to]]);
        }
      }

      results.push({
        phraseId: phrase.id,
        sourceVerse: phrase.source_verse,
        sourceWordRange: [phrase.source_from, phrase.source_to],
        totalOccurrences: phrase.count,
        matches: Array.from(byVerse.entries()).map(([vk, ranges]) => ({
          verseKey: vk,
          wordRanges: ranges,
        })),
      });
    }

    return results;
  }

  async hasSimilarVerses(verseKey: string): Promise<boolean> {
    if (!this.similarDb) return false;
    const r = await this.similarDb.getFirstAsync<{c: number}>(
      'SELECT COUNT(*) as c FROM similar_ayahs WHERE verse_key = ?',
      [verseKey],
    );
    return (r?.c ?? 0) > 0;
  }

  async hasSharedPhrases(verseKey: string): Promise<boolean> {
    if (!this.mutashabihatDb) return false;
    const r = await this.mutashabihatDb.getFirstAsync<{c: number}>(
      'SELECT COUNT(*) as c FROM phrase_verses WHERE verse_key = ?',
      [verseKey],
    );
    return (r?.c ?? 0) > 0;
  }
}

export const qulDataService = new QulDataService();
