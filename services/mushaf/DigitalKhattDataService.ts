import * as SQLite from 'expo-sqlite';
import {
  useMushafSettingsStore,
  type RewayahId,
} from '@/store/mushafSettingsStore';

const TOTAL_PAGES = 604;

// Each rewayah ships its own words DB. Rewayat within the same qari pair
// share a layout DB (same ayah boundaries → same line breaks); rewayat from
// different qaris have their own layout DB because verse numbering and line
// placement differ. `fontFamily` is the Skia typeface to render this rewayah's
// text with — KFGQPC-per-qiraat fonts carry the correct OpenType features
// for narration-specific marks (silah, imalah, etc.).
const DK_HAFS_LAYOUT_ASSET = require('../../data/mushaf/digitalkhatt/digital-khatt-15-lines.db');

interface RewayahAssetConfig {
  wordsDbName: string;
  wordsAsset: number;
  layoutDbName: string;
  layoutAsset: number;
  fontFamily: string | null;
}

// Partial by design: only the 8 canonical slugs with DK data bundled today
// have entries. The other 12 in RewayahId are taxonomy-only for now.
// Callers that need an entry must go through requireRewayahAssets() which
// throws a helpful error if data is absent; use RewayahIdentity.hasTextData
// to branch ahead of time.
//
// DB filenames on disk (dk_words_shouba.db etc.) keep the pre-canonical
// spellings to avoid renaming bundled assets in this PR — the RewayahId
// keys change, the asset paths don't.
const REWAYAH_DATA: Partial<Record<RewayahId, RewayahAssetConfig>> = {
  hafs: {
    wordsDbName: 'dk_words.db',
    wordsAsset: require('../../data/mushaf/digitalkhatt/digital-khatt-v2.db'),
    layoutDbName: 'dk_layout.db',
    layoutAsset: DK_HAFS_LAYOUT_ASSET,
    fontFamily: null, // defer to user's uthmaniFont/mushafRenderer choice
  },
  shubah: {
    wordsDbName: 'dk_words_shouba.db',
    wordsAsset: require('../../data/mushaf/digitalkhatt/dk_words_shouba.db'),
    layoutDbName: 'dk_layout.db',
    layoutAsset: DK_HAFS_LAYOUT_ASSET,
    fontFamily: null,
  },
  'al-bazzi': {
    wordsDbName: 'dk_words_bazzi.db',
    wordsAsset: require('../../data/mushaf/digitalkhatt/dk_words_bazzi.db'),
    layoutDbName: 'dk_layout.db',
    layoutAsset: DK_HAFS_LAYOUT_ASSET,
    fontFamily: null, // render with DK font — sibling of Hafs, shares layout
  },
  qunbul: {
    wordsDbName: 'dk_words_qumbul.db',
    wordsAsset: require('../../data/mushaf/digitalkhatt/dk_words_qumbul.db'),
    layoutDbName: 'dk_layout.db',
    layoutAsset: DK_HAFS_LAYOUT_ASSET,
    fontFamily: null,
  },
  warsh: {
    wordsDbName: 'dk_words_warsh.db',
    wordsAsset: require('../../data/mushaf/digitalkhatt/dk_words_warsh.db'),
    layoutDbName: 'dk_layout.db',
    layoutAsset: DK_HAFS_LAYOUT_ASSET,
    fontFamily: null,
  },
  qalun: {
    wordsDbName: 'dk_words_qaloon.db',
    wordsAsset: require('../../data/mushaf/digitalkhatt/dk_words_qaloon.db'),
    layoutDbName: 'dk_layout.db',
    layoutAsset: DK_HAFS_LAYOUT_ASSET,
    fontFamily: null,
  },
  'al-duri-abi-amr': {
    wordsDbName: 'dk_words_doori.db',
    wordsAsset: require('../../data/mushaf/digitalkhatt/dk_words_doori.db'),
    layoutDbName: 'dk_layout.db',
    layoutAsset: DK_HAFS_LAYOUT_ASSET,
    fontFamily: null,
  },
  'al-susi': {
    wordsDbName: 'dk_words_soosi.db',
    wordsAsset: require('../../data/mushaf/digitalkhatt/dk_words_soosi.db'),
    layoutDbName: 'dk_layout.db',
    layoutAsset: DK_HAFS_LAYOUT_ASSET,
    fontFamily: null,
  },
};

function requireRewayahAssets(rewayah: RewayahId): RewayahAssetConfig {
  const cfg = REWAYAH_DATA[rewayah];
  if (!cfg) {
    throw new Error(
      `[DigitalKhatt] No text data bundled for rewayah "${rewayah}". ` +
        `Check RewayahIdentity.hasTextData before calling.`,
    );
  }
  return cfg;
}

export function getRewayahFontFamily(rewayah: RewayahId): string | null {
  return REWAYAH_DATA[rewayah]?.fontFamily ?? null;
}

// Basmallah text is always the same 4 words — hardcoded to avoid DB lookup
// (layout DB has NULL word IDs for basmallah lines)
export const BASMALLAH_TEXT = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ';

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

type RewayahChangeListener = (rewayah: RewayahId) => void;

class DigitalKhattDataService {
  private wordsById: Map<number, string> = new Map();
  private wordInfoById: Map<number, DKWordInfo> = new Map();
  private verseWords: Map<string, DKWordInfo[]> = new Map();
  private pageLines: Map<number, DKLine[]> = new Map();
  private surahStartPages: Record<number, number> = {};
  private pageToSurah: Record<number, number> = {};
  private verseToPage: Map<string, number> | null = null;
  private currentRewayah: RewayahId = 'hafs';
  private rewayahListeners: Set<RewayahChangeListener> = new Set();
  // Side cache for rewayat OTHER than the currently-active mushaf rewayah.
  // Lets the player render text from a reciter's rewayah without mutating
  // currentRewayah (which the mushaf page follows). Populated lazily via
  // ensureRewayahLoaded(). Each inner map mirrors `verseWords`.
  private sideVerseWords: Map<RewayahId, Map<string, DKWordInfo[]>> = new Map();
  private sideLoading: Map<RewayahId, Promise<void>> = new Map();
  private _initialized = false;
  private _initializing: Promise<void> | null = null;

  get initialized(): boolean {
    return this._initialized;
  }

  get rewayah(): RewayahId {
    return this.currentRewayah;
  }

  onRewayahChange(listener: RewayahChangeListener): () => void {
    this.rewayahListeners.add(listener);
    return () => this.rewayahListeners.delete(listener);
  }

  async initialize(): Promise<void> {
    if (this._initialized) return;
    if (this._initializing) return this._initializing;

    this.currentRewayah = useMushafSettingsStore.getState().rewayah;
    this._initializing = this._doInit();
    return this._initializing;
  }

  private async _doInit(): Promise<void> {
    try {
      // We must load words first because loadLayout now uses wordInfo mappings
      // to accurately determine surah start pages based on verse content.
      await this.loadWords();
      await this.loadLayout();
      this._initialized = true;
    } catch (error) {
      console.error('[DigitalKhattDataService] Initialization failed:', error);
      this._initializing = null;
      throw error;
    }
  }

  /**
   * Dev-only: delete every runtime SQLite database this service imports
   * (per-rewayah words DBs + the shared layout DB). On next launch the
   * assets are re-imported from source, picking up any content changes.
   * Pair with `mushafLayoutCacheService.clearAll()` in dev tooling so the
   * MMKV layout cache isn't left referencing the wiped word IDs.
   */
  async resetDatabases(): Promise<void> {
    this._initialized = false;
    this._initializing = null;
    this.wordsById.clear();
    this.wordInfoById.clear();
    this.verseWords.clear();
    this.pageLines.clear();
    this.surahStartPages = {};
    this.pageToSurah = {};
    this.verseToPage = null;
    this.sideVerseWords.clear();
    this.sideLoading.clear();

    const dbNames = new Set<string>();
    for (const cfg of Object.values(REWAYAH_DATA)) {
      if (!cfg) continue;
      dbNames.add(cfg.wordsDbName);
      dbNames.add(cfg.layoutDbName);
    }
    for (const dbName of dbNames) {
      try {
        await SQLite.deleteDatabaseAsync(dbName);
      } catch {
        // DB may not exist yet — ignore
      }
    }
  }

  async switchRewayah(rewayah: RewayahId): Promise<void> {
    if (rewayah === this.currentRewayah) return;
    const prevCfg = requireRewayahAssets(this.currentRewayah);
    const nextCfg = requireRewayahAssets(rewayah);
    this.currentRewayah = rewayah;
    this.wordsById.clear();
    this.wordInfoById.clear();
    this.verseWords.clear();
    this.verseToPage = null;
    // The new active rewayah doesn't need its side-cache entry anymore
    // (it's about to be the main cache). Drop it to reclaim memory.
    this.sideVerseWords.delete(rewayah);
    await this.loadWords();
    // Layout only reloads if the new rewayah uses a different layout DB
    // (all 8 currently bundled rewayat share the Hafs layout DB; kept the
    // check because rewayat added in the future may bring their own layout).
    if (prevCfg.layoutDbName !== nextCfg.layoutDbName) {
      this.pageLines.clear();
      this.surahStartPages = {};
      this.pageToSurah = {};
      await this.loadLayout();
    }
    for (const listener of this.rewayahListeners) listener(rewayah);
  }

  private async loadWords(): Promise<void> {
    const cfg = requireRewayahAssets(this.currentRewayah);
    const dbName = cfg.wordsDbName;
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
        assetId: cfg.wordsAsset,
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
    const cfg = requireRewayahAssets(this.currentRewayah);
    const dbName = cfg.layoutDbName;
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
        assetId: cfg.layoutAsset,
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

    // Build surah mappings by identifying the first Ayah of each surah.
    // This solves the "header at bottom of previous page" issue by anchoring the
    // surah to the page where its actual verse content begins.
    for (const row of rows) {
      if (row.line_type === 'ayah') {
        const info = this.wordInfoById.get(row.first_word_id);
        if (info) {
          const surahId = parseInt(info.verseKey.split(':')[0], 10);
          if (surahId && !this.surahStartPages[surahId]) {
            this.surahStartPages[surahId] = row.page_number;
          }
        }
      }
    }

    // Fallback: If any surahs are missing ayahs in the DB (unlikely),
    // use the surah_name lines as a secondary source.
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

  getVerseWords(verseKey: string, rewayah?: RewayahId): DKWordInfo[] {
    if (!rewayah || rewayah === this.currentRewayah) {
      return this.verseWords.get(verseKey) || [];
    }
    return this.sideVerseWords.get(rewayah)?.get(verseKey) || [];
  }

  getVerseText(verseKey: string, rewayah?: RewayahId): string {
    const words = this.getVerseWords(verseKey, rewayah);
    if (words.length === 0) return '';
    return words.map(w => w.text).join(' ');
  }

  /**
   * Lazy-load the words DB for a rewayah other than the current one into a
   * side cache so it can be read synchronously by getVerseText/getVerseWords
   * with the `rewayah` param. No-op if rewayah is the current one or already
   * cached. Used by the player to render text for a reciter whose rewayah
   * differs from the mushaf's active rewayah without mutating global state.
   */
  async ensureRewayahLoaded(rewayah: RewayahId): Promise<void> {
    if (rewayah === this.currentRewayah) return;
    if (this.sideVerseWords.has(rewayah)) return;
    const existing = this.sideLoading.get(rewayah);
    if (existing) return existing;
    const loadPromise = this._loadSideRewayah(rewayah);
    this.sideLoading.set(rewayah, loadPromise);
    try {
      await loadPromise;
    } finally {
      this.sideLoading.delete(rewayah);
    }
  }

  private async _loadSideRewayah(rewayah: RewayahId): Promise<void> {
    const cfg = requireRewayahAssets(rewayah);
    const dbName = cfg.wordsDbName;
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
        assetId: cfg.wordsAsset,
      });
      db = await SQLite.openDatabaseAsync(dbName);
    }
    const rows = await db.getAllAsync<{
      id: number;
      text: string;
      location: string;
    }>('SELECT id, text, location FROM words;');
    await db.closeAsync();

    const byVerse = new Map<string, DKWordInfo[]>();
    for (const row of rows) {
      const parts = row.location.split(':');
      if (parts.length < 3) continue;
      const verseKey = `${parts[0]}:${parts[1]}`;
      const info: DKWordInfo = {
        text: row.text,
        verseKey,
        wordPositionInVerse: parseInt(parts[2], 10),
      };
      const arr = byVerse.get(verseKey);
      if (arr) arr.push(info);
      else byVerse.set(verseKey, [info]);
    }
    for (const words of byVerse.values()) {
      words.sort((a, b) => a.wordPositionInVerse - b.wordPositionInVerse);
    }
    this.sideVerseWords.set(rewayah, byVerse);
  }

  getPageForVerse(verseKey: string): number | undefined {
    if (!this.verseToPage) {
      this.verseToPage = new Map();
      for (const [pageNum, lines] of this.pageLines) {
        for (const line of lines) {
          if (line.line_type !== 'ayah') continue;
          for (let wid = line.first_word_id; wid <= line.last_word_id; wid++) {
            const info = this.wordInfoById.get(wid);
            if (info && !this.verseToPage.has(info.verseKey)) {
              this.verseToPage.set(info.verseKey, pageNum);
            }
          }
        }
      }
    }
    return this.verseToPage.get(verseKey);
  }
}

export const digitalKhattDataService = new DigitalKhattDataService();
