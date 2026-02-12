import * as SQLite from 'expo-sqlite';

const TOTAL_PAGES = 604;

// Basmallah text is always the same 4 words — hardcoded to avoid DB lookup
// (layout DB has NULL word IDs for basmallah lines)
const BASMALLAH_TEXT = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ';

export interface DKLine {
  page_number: number;
  line_number: number;
  line_type: 'surah_name' | 'basmallah' | 'ayah';
  is_centered: 0 | 1;
  first_word_id: number;
  last_word_id: number;
  surah_number: number;
}

export interface DKWordInfo {
  text: string;
  verseKey: string; // "surah:ayah"
  wordPositionInVerse: number;
}

class DigitalKhattDataService {
  private wordsById: Map<number, string> = new Map();
  private wordInfoById: Map<number, DKWordInfo> = new Map();
  private verseWords: Map<string, DKWordInfo[]> = new Map();
  private pageLines: Map<number, DKLine[]> = new Map();
  private surahStartPages: Record<number, number> = {};
  private pageToSurah: Record<number, number> = {};
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
      await Promise.all([this.loadWords(), this.loadLayout()]);
      this._initialized = true;
    } catch (error) {
      console.error('[DigitalKhattDataService] Initialization failed:', error);
      this._initializing = null;
      throw error;
    }
  }

  private async loadWords(): Promise<void> {
    const dbName = 'dk_words.db';
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
        assetId: require('../../data/mushaf/digitalkhatt/digital-khatt-v2.db'),
      });
      db = await SQLite.openDatabaseAsync(dbName);
    }

    const rows = await db.getAllAsync<{
      id: number;
      text: string;
      location: string;
    }>('SELECT id, text, location FROM words;');
    for (const row of rows) {
      this.wordsById.set(row.id, row.text);
      // Parse location "surah:ayah:word" into verse mapping
      const parts = row.location.split(':');
      if (parts.length >= 3) {
        const verseKey = `${parts[0]}:${parts[1]}`;
        this.wordInfoById.set(row.id, {
          text: row.text,
          verseKey,
          wordPositionInVerse: parseInt(parts[2], 10),
        });
      }
    }
    // Build verse-indexed lookup: group wordInfoById entries by verseKey
    for (const wordInfo of this.wordInfoById.values()) {
      const existing = this.verseWords.get(wordInfo.verseKey);
      if (existing) {
        existing.push(wordInfo);
      } else {
        this.verseWords.set(wordInfo.verseKey, [wordInfo]);
      }
    }
    // Sort each verse's words by position
    for (const words of this.verseWords.values()) {
      words.sort((a, b) => a.wordPositionInVerse - b.wordPositionInVerse);
    }

    await db.closeAsync();
    console.log(
      `[DigitalKhattDataService] Loaded ${this.wordsById.size} words, ${this.verseWords.size} verses indexed`,
    );
  }

  private async loadLayout(): Promise<void> {
    const dbName = 'dk_layout.db';
    let db = await SQLite.openDatabaseAsync(dbName);

    const tableCheck = await db
      .getFirstAsync<{
        name: string;
      }>("SELECT name FROM sqlite_master WHERE type='table' AND name='pages';")
      .catch(() => null);

    if (!tableCheck) {
      await db.closeAsync();
      await SQLite.deleteDatabaseAsync(dbName);
      await SQLite.importDatabaseFromAssetAsync(dbName, {
        assetId: require('../../data/mushaf/digitalkhatt/digital-khatt-15-lines.db'),
      });
      db = await SQLite.openDatabaseAsync(dbName);
    }

    const rows = await db.getAllAsync<DKLine>(
      'SELECT * FROM pages ORDER BY page_number, line_number;',
    );

    for (const row of rows) {
      const existing = this.pageLines.get(row.page_number);
      if (existing) {
        existing.push(row);
      } else {
        this.pageLines.set(row.page_number, [row]);
      }
    }

    // Build surah mappings from surah_name lines
    const surahNameRows = rows.filter(r => r.line_type === 'surah_name');
    for (const row of surahNameRows) {
      if (row.surah_number && !this.surahStartPages[row.surah_number]) {
        this.surahStartPages[row.surah_number] = row.page_number;
      }
    }

    // Fill pageToSurah for all pages
    const surahIds = Object.keys(this.surahStartPages)
      .map(Number)
      .sort((a, b) => this.surahStartPages[a] - this.surahStartPages[b]);

    for (let i = 0; i < surahIds.length; i++) {
      const surahId = surahIds[i];
      const startPage = this.surahStartPages[surahId];
      const endPage =
        i < surahIds.length - 1
          ? this.surahStartPages[surahIds[i + 1]] - 1
          : TOTAL_PAGES;
      for (let page = startPage; page <= endPage; page++) {
        if (!this.pageToSurah[page]) {
          this.pageToSurah[page] = surahId;
        }
      }
    }

    await db.closeAsync();
    console.log(
      `[DigitalKhattDataService] Loaded layout for ${this.pageLines.size} pages`,
    );
  }

  getPageLines(pageNum: number): DKLine[] {
    return this.pageLines.get(pageNum) || [];
  }

  getWordText(wordId: number): string {
    return this.wordsById.get(wordId) || '';
  }

  getLineText(line: DKLine): string {
    if (line.line_type === 'surah_name') return '';
    if (line.line_type === 'basmallah') return BASMALLAH_TEXT;
    const words: string[] = [];
    for (let i = line.first_word_id; i <= line.last_word_id; i++) {
      const text = this.wordsById.get(i);
      if (text) words.push(text);
    }
    return words.join(' ');
  }

  getWordInfo(wordId: number): DKWordInfo | undefined {
    return this.wordInfoById.get(wordId);
  }

  getSurahStartPages(): Record<number, number> {
    return this.surahStartPages;
  }

  getPageToSurah(): Record<number, number> {
    return this.pageToSurah;
  }

  getVerseWords(verseKey: string): DKWordInfo[] {
    return this.verseWords.get(verseKey) || [];
  }

  getVerseText(verseKey: string): string {
    const words = this.verseWords.get(verseKey);
    if (!words) return '';
    return words.map(w => w.text).join(' ');
  }
}

export const digitalKhattDataService = new DigitalKhattDataService();
