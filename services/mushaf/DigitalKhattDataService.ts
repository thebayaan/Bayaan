import * as SQLite from 'expo-sqlite';
import * as FileSystem from 'expo-file-system/legacy';
import {
  useMushafSettingsStore,
  type RewayahId,
} from '@/store/mushafSettingsStore';
import {migratePersistedId} from '@/services/rewayah/RewayahIdentity';
import {REWAYAH_DATA_MANIFEST} from './rewayahDataManifest';
import {joinSlotTexts, layoutLineSlots, visibleWords} from './lineWordSpans';

const TOTAL_PAGES = 604;

// Every Digital Khatt SQLite asset the app bundles, keyed by file basename.
// Keep each key equal to its file name: it indexes the generated content
// manifest (rewayahDataManifest.ts) that names the on-device copies, and
// scripts/rewayah/gen-manifest.mjs builds that manifest from these require()
// calls. Run `node scripts/rewayah/gen-manifest.mjs` after changing any of
// these files; services/mushaf/__tests__/rewayahDataManifest.test.ts fails
// while the manifest is stale.
const DK_DB_ASSETS = {
  'digital-khatt-v2.db': require('../../data/mushaf/digitalkhatt/digital-khatt-v2.db'),
  'digital-khatt-15-lines.db': require('../../data/mushaf/digitalkhatt/digital-khatt-15-lines.db'),
  'dk_words_shouba.db': require('../../data/mushaf/digitalkhatt/dk_words_shouba.db'),
  'dk_words_bazzi.db': require('../../data/mushaf/digitalkhatt/dk_words_bazzi.db'),
  'dk_words_qumbul.db': require('../../data/mushaf/digitalkhatt/dk_words_qumbul.db'),
  'dk_words_warsh.db': require('../../data/mushaf/digitalkhatt/dk_words_warsh.db'),
  'dk_words_qaloon.db': require('../../data/mushaf/digitalkhatt/dk_words_qaloon.db'),
  'dk_words_doori.db': require('../../data/mushaf/digitalkhatt/dk_words_doori.db'),
  'dk_words_soosi.db': require('../../data/mushaf/digitalkhatt/dk_words_soosi.db'),
} as const;

type DkDbAssetFile = keyof typeof DK_DB_ASSETS;

// Each rewayah ships its own words DB. Rewayat within the same qari pair
// share a layout DB (same ayah boundaries → same line breaks); rewayat from
// different qaris have their own layout DB because verse numbering and line
// placement differ. `fontFamily` is the Skia typeface to render this rewayah's
// text with; KFGQPC-per-qiraat fonts carry the correct OpenType features
// for narration-specific marks (silah, imalah, etc.).
interface RewayahAssetConfig {
  // On-device DB names without the content hash. The copy actually opened is
  // `<base>.<sha8>.db` (see bundledDbSpec), so a changed asset is imported
  // under a new name instead of being shadowed by an older copy. These
  // unversioned spellings are the names releases before content addressing
  // used; the stale-copy sweep deletes them.
  wordsDbName: string;
  wordsAssetFile: DkDbAssetFile;
  layoutDbName: string;
  layoutAssetFile: DkDbAssetFile;
  fontFamily: string | null;
}

// Partial by design: only the 8 canonical slugs with DK data bundled today
// have entries. The other 12 in RewayahId are taxonomy-only for now.
// Callers that need an entry must go through requireRewayahAssets() which
// throws a helpful error if data is absent; use RewayahIdentity.hasTextData
// to branch ahead of time.
//
// DB filenames on disk (dk_words_shouba.db etc.) keep the pre-canonical
// spellings to avoid renaming bundled assets; the RewayahId keys change, the
// asset paths don't.
const REWAYAH_DATA: Partial<Record<RewayahId, RewayahAssetConfig>> = {
  hafs: {
    wordsDbName: 'dk_words.db',
    wordsAssetFile: 'digital-khatt-v2.db',
    layoutDbName: 'dk_layout.db',
    layoutAssetFile: 'digital-khatt-15-lines.db',
    fontFamily: null, // defer to user's uthmaniFont/mushafRenderer choice
  },
  shubah: {
    wordsDbName: 'dk_words_shouba.db',
    wordsAssetFile: 'dk_words_shouba.db',
    layoutDbName: 'dk_layout.db',
    layoutAssetFile: 'digital-khatt-15-lines.db',
    fontFamily: null,
  },
  'al-bazzi': {
    wordsDbName: 'dk_words_bazzi.db',
    wordsAssetFile: 'dk_words_bazzi.db',
    layoutDbName: 'dk_layout.db',
    layoutAssetFile: 'digital-khatt-15-lines.db',
    fontFamily: null, // render with DK font; sibling of Hafs, shares layout
  },
  qunbul: {
    wordsDbName: 'dk_words_qumbul.db',
    wordsAssetFile: 'dk_words_qumbul.db',
    layoutDbName: 'dk_layout.db',
    layoutAssetFile: 'digital-khatt-15-lines.db',
    fontFamily: null,
  },
  warsh: {
    wordsDbName: 'dk_words_warsh.db',
    wordsAssetFile: 'dk_words_warsh.db',
    layoutDbName: 'dk_layout.db',
    layoutAssetFile: 'digital-khatt-15-lines.db',
    fontFamily: null,
  },
  qalun: {
    wordsDbName: 'dk_words_qaloon.db',
    wordsAssetFile: 'dk_words_qaloon.db',
    layoutDbName: 'dk_layout.db',
    layoutAssetFile: 'digital-khatt-15-lines.db',
    fontFamily: null,
  },
  'al-duri-abi-amr': {
    wordsDbName: 'dk_words_doori.db',
    wordsAssetFile: 'dk_words_doori.db',
    layoutDbName: 'dk_layout.db',
    layoutAssetFile: 'digital-khatt-15-lines.db',
    fontFamily: null,
  },
  'al-susi': {
    wordsDbName: 'dk_words_soosi.db',
    wordsAssetFile: 'dk_words_soosi.db',
    layoutDbName: 'dk_layout.db',
    layoutAssetFile: 'digital-khatt-15-lines.db',
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

// Basmallah text is always the same 4 words; hardcoded to avoid DB lookup
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

// ── Content-addressed on-device copies ──────────────────────────────────────
//
// expo-sqlite's importDatabaseFromAssetAsync is a no-op when the target file
// already exists, and the files live in <Documents|filesDir>/SQLite, which
// survives app updates. Copying every bundled DB to `<base>.<sha8>.db`
// (sha8 = first 8 hex chars of the asset's sha256, from the generated
// manifest) makes a corrected asset land under a new name, so it is imported
// instead of being shadowed by the copy an older release left behind. Old
// copies (unversioned names and other hashes) are deleted after a successful
// open; a DB that is open or being imported is never deleted.

const DB_EXTENSION = '.db';
const SHA8_LENGTH = 8;
const SQLITE_SIDECAR_SUFFIXES = ['-journal', '-wal', '-shm'] as const;

/** `dk_words_warsh.db` → `dk_words_warsh` */
export function dbBaseName(dbName: string): string {
  return dbName.endsWith(DB_EXTENSION)
    ? dbName.slice(0, -DB_EXTENSION.length)
    : dbName;
}

/** `dk_words_warsh.db` + sha256 → `dk_words_warsh.1a2b3c4d.db` */
export function contentAddressedDbName(dbName: string, sha256: string): string {
  const sha8 = sha256.slice(0, SHA8_LENGTH).toLowerCase();
  if (!/^[0-9a-f]{8}$/.test(sha8)) {
    throw new Error(`[DigitalKhatt] Invalid sha256 for ${dbName}: "${sha256}"`);
  }
  return `${dbBaseName(dbName)}.${sha8}${DB_EXTENSION}`;
}

/**
 * Picks the on-device files to delete from a directory listing: for every
 * base in `currentNameByBase`, its unversioned legacy copy (`<base>.db`), any
 * other content-addressed copy (`<base>.<8 hex>.db`) and the SQLite sidecar
 * files (-journal, -wal, -shm) of those copies. Never selects the current
 * copy of a base, anything whose DB name is in `keep` (open or busy), or files
 * of other bases: base `dk_words` does not match `dk_words_warsh.<hash>.db`.
 */
export function selectStaleDbFiles(
  fileNames: readonly string[],
  currentNameByBase: ReadonlyMap<string, string>,
  keep: ReadonlySet<string> = new Set(),
): string[] {
  const stale: string[] = [];
  for (const fileName of fileNames) {
    const sidecar = SQLITE_SIDECAR_SUFFIXES.find(suffix =>
      fileName.endsWith(suffix),
    );
    const dbFile = sidecar ? fileName.slice(0, -sidecar.length) : fileName;
    if (!dbFile.endsWith(DB_EXTENSION)) continue;
    const stem = dbFile.slice(0, -DB_EXTENSION.length);
    const match = /^(.+?)(?:\.[0-9a-f]{8})?$/.exec(stem);
    if (!match) continue;
    const current = currentNameByBase.get(match[1]);
    if (current === undefined) continue;
    if (dbFile === current || keep.has(dbFile)) continue;
    stale.push(fileName);
  }
  return stale;
}

/** The asset hashes a main cache was built from. */
export interface DKDataIdentity {
  rewayah: RewayahId;
  wordsSha8: string;
  layoutSha8: string;
}

/** Cache-key form of a data identity: `<rewayah>@<wordsSha8>.<layoutSha8>`. */
export function dataIdentityKey(identity: DKDataIdentity): string {
  return `${identity.rewayah}@${identity.wordsSha8}.${identity.layoutSha8}`;
}

function assetSha256(file: DkDbAssetFile): string {
  const sha256 = REWAYAH_DATA_MANIFEST[file];
  if (!sha256) {
    throw new Error(
      `[DigitalKhatt] ${file} has no entry in rewayahDataManifest.ts. ` +
        `Run: node scripts/rewayah/gen-manifest.mjs`,
    );
  }
  return sha256;
}

/**
 * Identity of the data a rewayah loads in this build (from the bundled
 * manifest), whether or not it is loaded. Null for rewayat without DK data.
 */
export function getRewayahDataIdentity(
  rewayah: RewayahId,
): DKDataIdentity | null {
  const cfg = REWAYAH_DATA[rewayah];
  if (!cfg) return null;
  return {
    rewayah,
    wordsSha8: assetSha256(cfg.wordsAssetFile).slice(0, SHA8_LENGTH),
    layoutSha8: assetSha256(cfg.layoutAssetFile).slice(0, SHA8_LENGTH),
  };
}

/** dataIdentityKey(getRewayahDataIdentity(rewayah)), or null. */
export function getRewayahDataIdentityKey(rewayah: RewayahId): string | null {
  const identity = getRewayahDataIdentity(rewayah);
  return identity ? dataIdentityKey(identity) : null;
}

/** Asset basenames of every bundled DK DB (the manifest's key set). */
export function getBundledDkDbAssetFiles(): string[] {
  return Object.keys(DK_DB_ASSETS);
}

/**
 * Current content-addressed on-device name for every DB base the app uses
 * (`dk_words_warsh` → `dk_words_warsh.<sha8>.db`, `dk_layout` → ...). Throws if
 * a base would map to two different assets.
 */
export function getCurrentDbNamesByBase(): Map<string, string> {
  const byBase = new Map<string, string>();
  for (const cfg of Object.values(REWAYAH_DATA)) {
    if (!cfg) continue;
    const pairs: [string, DkDbAssetFile][] = [
      [cfg.wordsDbName, cfg.wordsAssetFile],
      [cfg.layoutDbName, cfg.layoutAssetFile],
    ];
    for (const [dbName, assetFile] of pairs) {
      const base = dbBaseName(dbName);
      const name = contentAddressedDbName(dbName, assetSha256(assetFile));
      const existing = byBase.get(base);
      if (existing !== undefined && existing !== name) {
        throw new Error(
          `[DigitalKhatt] On-device DB base "${base}" maps to two assets`,
        );
      }
      byBase.set(base, name);
    }
  }
  return byBase;
}

interface BundledDbSpec {
  name: string; // content-addressed on-device file name
  base: string; // e.g. dk_words_warsh
  assetId: number;
  assetFile: DkDbAssetFile;
  sha8: string;
  table: 'words' | 'pages';
}

function bundledDbSpec(
  dbName: string,
  assetFile: DkDbAssetFile,
  table: BundledDbSpec['table'],
): BundledDbSpec {
  const sha256 = assetSha256(assetFile);
  return {
    name: contentAddressedDbName(dbName, sha256),
    base: dbBaseName(dbName),
    assetId: DK_DB_ASSETS[assetFile],
    assetFile,
    sha8: sha256.slice(0, SHA8_LENGTH),
    table,
  };
}

// File URI of expo-sqlite's default database directory (expo-file-system
// wants a file:// URI; expo-sqlite reports a plain path). Both point at
// <Documents>/SQLite on iOS and <filesDir>/SQLite on Android.
function sqliteDirectoryUri(): string | null {
  const dir: unknown = SQLite.defaultDatabaseDirectory;
  if (typeof dir === 'string' && dir.length > 0) {
    const uri = dir.startsWith('file://')
      ? dir
      : `file://${dir.split('/').map(encodeURIComponent).join('/')}`;
    return uri.endsWith('/') ? uri : `${uri}/`;
  }
  const documents = FileSystem.documentDirectory;
  return documents ? `${documents}SQLite/` : null;
}

async function deleteDatabaseQuietly(name: string): Promise<void> {
  try {
    await SQLite.deleteDatabaseAsync(name);
  } catch {
    // Missing (nothing to delete) or still open (SQLite refuses; leave it).
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// ── Errors and load states ──────────────────────────────────────────────────

/**
 * switchRewayah(rewayah) was overtaken by a newer request for a different
 * rewayah before it committed. Nothing failed; the newer request decides the
 * active rewayah. Callers should ignore it (see isRewayahSwitchSuperseded).
 */
export class RewayahSwitchSupersededError extends Error {
  readonly requested: RewayahId;
  readonly supersededBy: RewayahId;

  constructor(requested: RewayahId, supersededBy: RewayahId) {
    super(
      `[DigitalKhatt] Switch to "${requested}" superseded by "${supersededBy}"`,
    );
    this.name = 'RewayahSwitchSupersededError';
    this.requested = requested;
    this.supersededBy = supersededBy;
    Object.setPrototypeOf(this, RewayahSwitchSupersededError.prototype);
  }
}

export function isRewayahSwitchSuperseded(
  error: unknown,
): error is RewayahSwitchSupersededError {
  return (
    error instanceof RewayahSwitchSupersededError ||
    (error instanceof Error && error.name === 'RewayahSwitchSupersededError')
  );
}

/** A rewayah's DB could not be read, even after deleting and re-importing it. */
export class RewayahLoadError extends Error {
  readonly rewayah: RewayahId;
  readonly reason: unknown;

  constructor(rewayah: RewayahId, reason: unknown) {
    const detail = errorMessage(reason);
    super(`[DigitalKhatt] Could not load rewayah "${rewayah}": ${detail}`);
    this.name = 'RewayahLoadError';
    this.rewayah = rewayah;
    this.reason = reason;
    Object.setPrototypeOf(this, RewayahLoadError.prototype);
  }
}

/**
 * Whether a rewayah's words can be read right now:
 * - 'ready': in memory (active main cache or a side cache);
 * - 'loading': a load that will provide it is in flight (or, before the first
 *   commit, initialization will decide whether it becomes the active one);
 * - 'error': the last load failed (sticky until a new explicit request);
 * - 'idle': not loaded and not loading; call ensureRewayahLoaded();
 * - 'unavailable': no DK text data is bundled for this rewayah.
 */
export type RewayahLoadState =
  | 'ready'
  | 'loading'
  | 'error'
  | 'idle'
  | 'unavailable';

// ── Row → cache builders ────────────────────────────────────────────────────

interface WordRow {
  id: number;
  text: string;
  location: string;
}

interface WordsData {
  wordsById: Map<number, string>;
  wordInfoById: Map<number, DKWordInfo>;
  verseWords: Map<string, DKWordInfo[]>;
}

interface LayoutData {
  pageLines: Map<number, DKLine[]>;
  surahStartPages: Record<number, number>;
  pageToSurah: Record<number, number>;
}

interface MainSnapshot {
  rewayah: RewayahId;
  words: WordsData;
  // null: the active layout is reused (same layout DB copy).
  layout: LayoutData | null;
  layoutDbName: string;
  identity: DKDataIdentity;
}

interface MainWaiter {
  // null: settle on the next commit of whatever rewayah wins (initialize).
  target: RewayahId | null;
  resolve: () => void;
  reject: (error: unknown) => void;
}

function parseWordInfo(row: WordRow): DKWordInfo | null {
  // location is "surah:ayah:word"
  const parts = row.location.split(':');
  if (parts.length < 3) return null;
  return {
    text: row.text,
    verseKey: `${parts[0]}:${parts[1]}`,
    wordPositionInVerse: parseInt(parts[2], 10),
  };
}

function groupByVerse(infos: Iterable<DKWordInfo>): Map<string, DKWordInfo[]> {
  const byVerse = new Map<string, DKWordInfo[]>();
  for (const info of infos) {
    const existing = byVerse.get(info.verseKey);
    if (existing) existing.push(info);
    else byVerse.set(info.verseKey, [info]);
  }
  for (const words of byVerse.values()) {
    words.sort((a, b) => a.wordPositionInVerse - b.wordPositionInVerse);
  }
  return byVerse;
}

function buildWordsData(rows: readonly WordRow[]): WordsData {
  const wordsById = new Map<number, string>();
  const wordInfoById = new Map<number, DKWordInfo>();
  for (const row of rows) {
    wordsById.set(row.id, row.text);
    const info = parseWordInfo(row);
    if (info) wordInfoById.set(row.id, info);
  }
  return {
    wordsById,
    wordInfoById,
    verseWords: groupByVerse(wordInfoById.values()),
  };
}

function buildVerseWords(rows: readonly WordRow[]): Map<string, DKWordInfo[]> {
  const infos: DKWordInfo[] = [];
  for (const row of rows) {
    const info = parseWordInfo(row);
    if (info) infos.push(info);
  }
  return groupByVerse(infos);
}

function buildLayoutData(
  rows: readonly DKLine[],
  wordInfoById: ReadonlyMap<number, DKWordInfo>,
): LayoutData {
  const pageLines = new Map<number, DKLine[]>();
  const surahStartPages: Record<number, number> = {};
  const pageToSurah: Record<number, number> = {};

  for (const row of rows) {
    const existing = pageLines.get(row.page_number);
    if (existing) existing.push(row);
    else pageLines.set(row.page_number, [row]);
  }

  // Build surah mappings by identifying the first Ayah of each surah.
  // This solves the "header at bottom of previous page" issue by anchoring the
  // surah to the page where its actual verse content begins.
  for (const row of rows) {
    if (row.line_type !== 'ayah') continue;
    const info = wordInfoById.get(row.first_word_id);
    if (!info) continue;
    const surahId = parseInt(info.verseKey.split(':')[0], 10);
    if (surahId && !surahStartPages[surahId]) {
      surahStartPages[surahId] = row.page_number;
    }
  }

  // Fallback: If any surahs are missing ayahs in the DB (unlikely),
  // use the surah_name lines as a secondary source.
  for (const row of rows) {
    if (row.line_type !== 'surah_name') continue;
    if (row.surah_number && !surahStartPages[row.surah_number]) {
      surahStartPages[row.surah_number] = row.page_number;
    }
  }

  // Fill pageToSurah for all pages
  const surahIds = Object.keys(surahStartPages)
    .map(Number)
    .sort((a, b) => surahStartPages[a] - surahStartPages[b]);
  for (let i = 0; i < surahIds.length; i++) {
    const surahId = surahIds[i];
    const startPage = surahStartPages[surahId];
    const endPage =
      i < surahIds.length - 1
        ? surahStartPages[surahIds[i + 1]] - 1
        : TOTAL_PAGES;
    for (let page = startPage; page <= endPage; page++) {
      if (!pageToSurah[page]) pageToSurah[page] = surahId;
    }
  }

  return {pageLines, surahStartPages, pageToSurah};
}

async function hasTable(
  db: SQLite.SQLiteDatabase,
  table: BundledDbSpec['table'],
): Promise<boolean> {
  // A damaged file throws here; treat that like a missing table so the asset
  // is re-imported.
  const row = await db
    .getFirstAsync<{
      name: string;
    }>(`SELECT name FROM sqlite_master WHERE type='table' AND name='${table}';`)
    .catch(() => null);
  return row != null;
}

async function readWordRows(db: SQLite.SQLiteDatabase): Promise<WordRow[]> {
  const rows = await db.getAllAsync<WordRow>(
    'SELECT id, text, location FROM words;',
  );
  if (rows.length === 0) throw new Error('words table is empty');
  return rows;
}

async function readLayoutRows(db: SQLite.SQLiteDatabase): Promise<DKLine[]> {
  const rows = await db.getAllAsync<DKLine>(
    'SELECT * FROM pages ORDER BY page_number, line_number;',
  );
  if (rows.length === 0) throw new Error('pages table is empty');
  return rows;
}

// Background work (worker loop, stale-copy sweeps) handles its own errors;
// this only keeps an unexpected bug from becoming an unhandled rejection.
function runInBackground(label: string, task: Promise<unknown>): void {
  task.catch(error => {
    console.error(`[DigitalKhattDataService] ${label} failed:`, error);
  });
}

type RewayahChangeListener = (rewayah: RewayahId) => void;
type CacheChangeListener = () => void;

export class DigitalKhattDataService {
  // Main cache: the active rewayah (what the mushaf renders). Replaced as a
  // whole by swapMain(); never cleared or partially filled in place.
  private wordsById: Map<number, string> = new Map();
  private wordInfoById: Map<number, DKWordInfo> = new Map();
  private verseWords: Map<string, DKWordInfo[]> = new Map();
  private pageLines: Map<number, DKLine[]> = new Map();
  private surahStartPages: Record<number, number> = {};
  private pageToSurah: Record<number, number> = {};
  private verseToPage: Map<string, number> | null = null;
  private currentRewayah: RewayahId = 'hafs';
  private rewayahListeners: Set<RewayahChangeListener> = new Set();
  // Monotonic version for reactive consumers (useRewayahWords via
  // useSyncExternalStore) and for derived caches keyed by it. Bumped on every
  // cache-content change: each main-cache commit (initial load and every
  // switch), each side-cache load or failed load, and resetDatabases.
  private cacheVersion = 0;
  private cacheListeners: Set<CacheChangeListener> = new Set();
  // Side cache for rewayat OTHER than the currently-active mushaf rewayah.
  // Lets the player render text from a reciter's rewayah without mutating
  // currentRewayah (which the mushaf page follows). Populated lazily via
  // ensureRewayahLoaded(), plus the previously active rewayah after a switch.
  // Each inner map mirrors `verseWords`.
  private sideVerseWords: Map<RewayahId, Map<string, DKWordInfo[]>> = new Map();
  private sideLoading: Map<RewayahId, Promise<void>> = new Map();
  private _initialized = false;
  private _initializing: Promise<void> | null = null;

  // Identity (asset hashes) of the main cache, and the layout copy it uses.
  private activeIdentity: DKDataIdentity | null = null;
  private activeLayoutDbName: string | null = null;
  // Main-cache load queue. `desiredRewayah` is the latest requested rewayah
  // (null when nothing is pending); one worker loads it, and commits only if
  // it is still the latest request when the load finishes.
  private desiredRewayah: RewayahId | null = null;
  private mainWaiters: MainWaiter[] = [];
  private mainWorkerRunning = false;
  private mainOutcomeListeners: (() => void)[] = [];
  private loadErrors: Map<RewayahId, unknown> = new Map();
  // Side entry kept from the previously active rewayah (at most one; replaced
  // on the next switch unless a consumer asked for it explicitly).
  private retainedSideRewayah: RewayahId | null = null;
  // Per-DB-name operation chain: imports, opens and deletes of one file never
  // overlap, so concurrent loaders cannot collide.
  private dbLocks: Map<string, Promise<void>> = new Map();
  private openDbCounts: Map<string, number> = new Map();
  private sweptBases: Set<string> = new Set();
  // Bumped by resetDatabases so in-flight loads drop their results.
  private epoch = 0;

  get initialized(): boolean {
    return this._initialized;
  }

  /**
   * The rewayah whose text the main cache serves. Changes only when a load
   * commits; while a switch is loading it still names the previous rewayah.
   */
  get rewayah(): RewayahId {
    return this.currentRewayah;
  }

  /**
   * The rewayah a main-cache load is fetching right now, or null when the
   * active rewayah is final.
   */
  get pendingRewayah(): RewayahId | null {
    if (!this.mainWorkerRunning || this.desiredRewayah === null) return null;
    if (this._initialized && this.desiredRewayah === this.currentRewayah) {
      return null;
    }
    return this.desiredRewayah;
  }

  get isSwitching(): boolean {
    return this.pendingRewayah !== null;
  }

  /**
   * Fires synchronously inside each commit that changes the active rewayah
   * (including the first commit when it is not Hafs), after the maps are
   * swapped and before cache subscribers are notified.
   */
  onRewayahChange(listener: RewayahChangeListener): () => void {
    this.rewayahListeners.add(listener);
    return () => this.rewayahListeners.delete(listener);
  }

  // Bound to the instance so useSyncExternalStore receives a stable reference.
  subscribeCacheChanges = (listener: CacheChangeListener): (() => void) => {
    this.cacheListeners.add(listener);
    return () => {
      this.cacheListeners.delete(listener);
    };
  };

  // Referentially stable snapshot getter; returns a number, so
  // useSyncExternalStore's default shallow compare is correct.
  getCacheVersion = (): number => this.cacheVersion;

  /** Asset identity of the text the main cache serves; null before init. */
  getDataIdentity(): DKDataIdentity | null {
    return this.activeIdentity;
  }

  /**
   * Key for caches derived from the main cache's text (page layouts):
   * `<rewayah>@<wordsSha8>.<layoutSha8>`, or null before the first load.
   * Changes exactly when the served text changes.
   */
  getLayoutIdentityKey(): string | null {
    return this.activeIdentity ? dataIdentityKey(this.activeIdentity) : null;
  }

  private notifyCacheChange(): void {
    this.cacheVersion += 1;
    this.notifyCacheListeners();
  }

  private notifyCacheListeners(): void {
    for (const listener of [...this.cacheListeners]) {
      try {
        listener();
      } catch (error) {
        console.error('[DigitalKhattDataService] Cache listener threw:', error);
      }
    }
  }

  async initialize(): Promise<void> {
    if (this._initialized) return;
    if (this._initializing) return this._initializing;

    // Defensive normalization: the store's persisted value may still be a
    // pre-canonical slug (e.g. "qaloon") if the user is on a build whose
    // persist version was bumped without running migratePersistedId, or
    // whose AsyncStorage retained a broken intermediate write. Run the
    // migrator here so the service never trusts an invalid slug, and
    // write the corrected value back to the store so every other reader
    // picks up the fix.
    const rawRewayah = useMushafSettingsStore.getState().rewayah;
    const normalized = migratePersistedId(rawRewayah as unknown as string);
    if (normalized !== rawRewayah) {
      useMushafSettingsStore.getState().setRewayah(normalized);
    }
    const init = this.runInitialLoad(normalized);
    this._initializing = init;
    init.catch(error => {
      console.error('[DigitalKhattDataService] Initialization failed:', error);
      if (this._initializing === init) this._initializing = null;
    });
    return init;
  }

  private async runInitialLoad(persisted: RewayahId): Promise<void> {
    const epoch = this.epoch;
    let target = persisted;
    if (!REWAYAH_DATA[target]) {
      console.warn(
        `[DigitalKhattDataService] No text data bundled for "${target}"; starting with Hafs`,
      );
      target = 'hafs';
    }
    try {
      // Settles on the first commit, whichever rewayah wins: a switch
      // requested meanwhile (e.g. opening a bookmark) takes precedence.
      await this.requestMain(target, true);
    } catch (error) {
      if (this._initialized || epoch !== this.epoch) throw error;
      const failed = error instanceof RewayahLoadError ? error.rewayah : target;
      if (failed === 'hafs') throw error;
      // A blank mushaf on every launch is worse than reading Hafs: fall back
      // and keep the failure visible through getRewayahLoadState /
      // getRewayahLoadError.
      console.warn(
        `[DigitalKhattDataService] Could not load "${failed}" at startup; falling back to Hafs`,
        error,
      );
      // @ai-start
      // The reader's saved rewayah is kept. Recording the fallback before the
      // Hafs commit relabels the store makes the store persist the saved
      // rewayah instead of Hafs (so the next launch tries it again) while
      // `rewayah`, which every label reads, names the Hafs on screen. The UI
      // tells the reader and offers a retry.
      const saved = useMushafSettingsStore.getState().rewayah;
      if (REWAYAH_DATA[saved]) {
        useMushafSettingsStore.getState().startRewayahFallback(saved);
      }
      try {
        await this.requestMain('hafs', true);
      } catch (hafsError) {
        // Nothing can be shown; the saved rewayah was never overwritten, and
        // no notice may claim that Hafs is on screen.
        useMushafSettingsStore.getState().clearRewayahFallback();
        throw hafsError;
      }
      // @ai-end
    }
  }

  /**
   * Dev-only: delete every runtime SQLite copy this service manages (current
   * and stale content-addressed names, per-rewayah words DBs and the shared
   * layout DB) and drop all caches. On next launch the assets are re-imported
   * from source. Pair with `mushafLayoutCacheService.clearAll()` in dev
   * tooling.
   */
  async resetDatabases(): Promise<void> {
    this.epoch += 1;
    const resetError = new Error('[DigitalKhattDataService] Databases reset');
    const waiters = this.mainWaiters;
    this.mainWaiters = [];
    for (const waiter of waiters) waiter.reject(resetError);
    this.desiredRewayah = null;
    this._initialized = false;
    this._initializing = null;
    this.wordsById = new Map();
    this.wordInfoById = new Map();
    this.verseWords = new Map();
    this.pageLines = new Map();
    this.surahStartPages = {};
    this.pageToSurah = {};
    this.verseToPage = null;
    this.activeIdentity = null;
    this.activeLayoutDbName = null;
    this.sideVerseWords.clear();
    this.sideLoading.clear();
    this.loadErrors.clear();
    this.retainedSideRewayah = null;
    this.sweptBases.clear();

    const currentByBase = getCurrentDbNamesByBase();
    const names = new Set<string>();
    for (const [base, current] of currentByBase) {
      names.add(current);
      names.add(`${base}${DB_EXTENSION}`);
    }
    try {
      const dir = sqliteDirectoryUri();
      const listing = dir ? await FileSystem.readDirectoryAsync(dir) : [];
      // An empty "current" name makes every copy of each base eligible.
      const everything = new Map([...currentByBase.keys()].map(b => [b, '']));
      for (const file of selectStaleDbFiles(listing ?? [], everything)) {
        names.add(file);
      }
    } catch {
      // Listing failed; the explicit names above still get deleted.
    }
    for (const name of names) await deleteDatabaseQuietly(name);
    // Caches wiped; surface that to consumers so they don't hold onto stale
    // word arrays.
    this.notifyCacheChange();
  }

  /**
   * Make `rewayah` the active (main-cache) rewayah.
   *
   * - Serialized, latest request wins: a request overtaken by a request for a
   *   different rewayah rejects with RewayahSwitchSupersededError (callers
   *   should ignore it: isRewayahSwitchSuperseded). Repeated requests for the
   *   pending rewayah share its outcome.
   * - Atomic: the words (and the layout, if it differs) are read into fresh
   *   maps; `rewayah`, every map and the data identity flip together in one
   *   synchronous commit, which then syncs the settings store, runs
   *   onRewayahChange listeners and notifies cache subscribers. Readers never
   *   see a half-cleared cache and `rewayah` never names unloaded text.
   * - On failure (after one delete + re-import of the on-device copy) the
   *   previous rewayah stays active and intact, getRewayahLoadState(rewayah)
   *   becomes 'error', and the promise rejects with RewayahLoadError.
   */
  async switchRewayah(rewayah: RewayahId): Promise<void> {
    requireRewayahAssets(rewayah);
    return this.requestMain(rewayah, false);
  }

  private requestMain(target: RewayahId, anyOutcome: boolean): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (anyOutcome) {
        // initialize(): a switch already requested keeps precedence.
        if (this.desiredRewayah === null) this.desiredRewayah = target;
        this.mainWaiters.push({target: null, resolve, reject});
        runInBackground('Main-cache worker', this.runMainWorker());
        return;
      }
      if (this.desiredRewayah !== target) this.supersedeMainWaiters(target);
      if (this._initialized && target === this.currentRewayah) {
        // Already active: nothing to load or wait for. A load still running
        // for another rewayah is now superseded and discarded when it ends.
        this.desiredRewayah = this.mainWorkerRunning ? target : null;
        resolve();
        return;
      }
      this.desiredRewayah = target;
      this.mainWaiters.push({target, resolve, reject});
      runInBackground('Main-cache worker', this.runMainWorker());
    });
  }

  private supersedeMainWaiters(target: RewayahId): void {
    const kept: MainWaiter[] = [];
    for (const waiter of this.mainWaiters) {
      if (waiter.target !== null && waiter.target !== target) {
        waiter.reject(new RewayahSwitchSupersededError(waiter.target, target));
      } else {
        kept.push(waiter);
      }
    }
    this.mainWaiters = kept;
  }

  private settleMainWaiters(target: RewayahId, error: unknown | null): void {
    const kept: MainWaiter[] = [];
    for (const waiter of this.mainWaiters) {
      if (waiter.target !== null && waiter.target !== target) {
        kept.push(waiter);
      } else if (error === null) {
        waiter.resolve();
      } else {
        waiter.reject(error);
      }
    }
    this.mainWaiters = kept;
  }

  private flushMainOutcomeListeners(): void {
    const listeners = this.mainOutcomeListeners;
    this.mainOutcomeListeners = [];
    for (const listener of listeners) listener();
  }

  // Resolves after the next main-cache load attempt finishes (committed,
  // failed or superseded). Never rejects.
  private waitForMainOutcome(): Promise<void> {
    return new Promise<void>(resolve => {
      this.mainOutcomeListeners.push(resolve);
    });
  }

  private async runMainWorker(): Promise<void> {
    if (this.mainWorkerRunning) return;
    this.mainWorkerRunning = true;
    try {
      while (this.mainWaiters.length > 0) {
        const target = this.desiredRewayah ?? this.currentRewayah;
        if (this._initialized && target === this.currentRewayah) {
          this.desiredRewayah = null;
          this.settleMainWaiters(target, null);
          if (this.mainWaiters.length > 0) {
            // Only waiters for another rewayah remain (queued from inside a
            // listener); serve the newest of them.
            this.desiredRewayah =
              this.mainWaiters[this.mainWaiters.length - 1].target;
          }
          continue;
        }

        const epoch = this.epoch;
        let snapshot: MainSnapshot | null = null;
        let failure: unknown = null;
        try {
          snapshot = await this.loadMainSnapshot(target);
        } catch (error) {
          failure = error;
        }

        try {
          // resetDatabases ran meanwhile and already rejected the waiters.
          if (epoch !== this.epoch) continue;
          // Superseded: the newer request's waiter is queued; loop to it.
          if ((this.desiredRewayah ?? this.currentRewayah) !== target) continue;
          if (!snapshot) {
            this.desiredRewayah = null;
            this.loadErrors.set(target, failure);
            console.error(
              `[DigitalKhattDataService] Loading "${target}" failed; keeping "${this.currentRewayah}"`,
              failure,
            );
            this.settleMainWaiters(
              target,
              new RewayahLoadError(target, failure),
            );
            // The error state is observable (getRewayahLoadState).
            this.notifyCacheChange();
            continue;
          }
          const firstCommit = !this._initialized;
          const prevRewayah = this.currentRewayah;
          this.swapMain(snapshot);
          this.desiredRewayah = null;
          // Settle before announcing, so a switch requested from inside a
          // listener cannot reject this (already committed) request as
          // superseded.
          this.settleMainWaiters(target, null);
          this.announceMainCommit(prevRewayah);
          if (firstCommit) {
            // Reclaim space from copies of every base, including rewayat this
            // session may never open (older releases' unversioned files).
            runInBackground('Stale-copy sweep', this.sweepStaleCopies('all'));
          }
        } finally {
          this.flushMainOutcomeListeners();
        }
      }
    } finally {
      this.mainWorkerRunning = false;
      if (this._initialized && this.desiredRewayah === this.currentRewayah) {
        this.desiredRewayah = null;
      }
    }
  }

  private async loadMainSnapshot(target: RewayahId): Promise<MainSnapshot> {
    const cfg = requireRewayahAssets(target);
    const wordsSpec = bundledDbSpec(
      cfg.wordsDbName,
      cfg.wordsAssetFile,
      'words',
    );
    const layoutSpec = bundledDbSpec(
      cfg.layoutDbName,
      cfg.layoutAssetFile,
      'pages',
    );
    // Layout only reloads if the target uses a different layout DB copy (all
    // 8 bundled rewayat share the Hafs layout today) or none is loaded yet.
    const reuseLayout =
      this._initialized &&
      this.activeLayoutDbName === layoutSpec.name &&
      this.pageLines.size > 0;
    const [rows, layoutRows] = await Promise.all([
      this.readBundledDb(wordsSpec, readWordRows),
      reuseLayout ? null : this.readBundledDb(layoutSpec, readLayoutRows),
    ]);
    const words = buildWordsData(rows);
    // Surah start pages come from the words' verse keys, so build the layout
    // after the words.
    const layout = layoutRows
      ? buildLayoutData(layoutRows, words.wordInfoById)
      : null;
    console.log(
      `[DigitalKhattDataService] Loaded ${target}: ${words.wordsById.size} words, ${words.verseWords.size} verses` +
        (layout ? `, layout for ${layout.pageLines.size} pages` : ''),
    );
    return {
      rewayah: target,
      words,
      layout,
      layoutDbName: layoutSpec.name,
      identity: {
        rewayah: target,
        wordsSha8: wordsSpec.sha8,
        layoutSha8: layoutSpec.sha8,
      },
    };
  }

  // The only place the main cache changes after a load. Synchronous, so no
  // reader can observe a mix of old and new maps. announceMainCommit() must
  // follow in the same synchronous block.
  private swapMain(next: MainSnapshot): void {
    const prevRewayah = this.currentRewayah;
    const prevVerseWords = this.verseWords;
    const wasInitialized = this._initialized;

    this.wordsById = next.words.wordsById;
    this.wordInfoById = next.words.wordInfoById;
    this.verseWords = next.words.verseWords;
    if (next.layout) {
      this.pageLines = next.layout.pageLines;
      this.surahStartPages = next.layout.surahStartPages;
      this.pageToSurah = next.layout.pageToSurah;
    }
    this.activeLayoutDbName = next.layoutDbName;
    this.verseToPage = null;
    this.currentRewayah = next.rewayah;
    this.activeIdentity = next.identity;
    this._initialized = true;
    this.loadErrors.delete(next.rewayah);

    // The new active rewayah reads from the main cache now.
    this.sideVerseWords.delete(next.rewayah);
    if (this.retainedSideRewayah === next.rewayah) {
      this.retainedSideRewayah = null;
    }
    // Keep the outgoing rewayah readable (e.g. the player still showing a
    // track in it) instead of dropping it; bounded to one retained entry.
    if (wasInitialized && prevRewayah !== next.rewayah) {
      if (this.retainedSideRewayah !== null) {
        this.sideVerseWords.delete(this.retainedSideRewayah);
        this.retainedSideRewayah = null;
      }
      if (prevVerseWords.size > 0 && !this.sideVerseWords.has(prevRewayah)) {
        this.sideVerseWords.set(prevRewayah, prevVerseWords);
        this.retainedSideRewayah = prevRewayah;
      }
    }

    // Keep the settings store in step with the text actually served (a no-op
    // when the caller already set it, or under qcf_v2 where the store pins
    // Hafs).
    const store = useMushafSettingsStore.getState();
    if (store.rewayah !== next.rewayah) store.setRewayah(next.rewayah);
  }

  // Bumps the cache version (so derived caches keyed by it are stale before
  // anyone runs), then runs onRewayahChange listeners (they clear line-text
  // and layout caches and reload diff ranges), then wakes cache subscribers.
  private announceMainCommit(prevRewayah: RewayahId): void {
    this.cacheVersion += 1;
    const rewayah = this.currentRewayah;
    if (prevRewayah !== rewayah) {
      for (const listener of [...this.rewayahListeners]) {
        try {
          listener(rewayah);
        } catch (error) {
          console.error(
            '[DigitalKhattDataService] Rewayah listener threw:',
            error,
          );
        }
      }
    }
    this.notifyCacheListeners();
  }

  // ── Bundled DB access ─────────────────────────────────────────────────────

  private withDbLock<T>(name: string, task: () => Promise<T>): Promise<T> {
    const previous = this.dbLocks.get(name) ?? Promise.resolve();
    const run = previous.then(task);
    const tail = run.then(
      () => undefined,
      () => undefined,
    );
    this.dbLocks.set(name, tail);
    tail.then(() => {
      if (this.dbLocks.get(name) === tail) this.dbLocks.delete(name);
    });
    return run;
  }

  private isDbBusy(name: string): boolean {
    return this.dbLocks.has(name) || (this.openDbCounts.get(name) ?? 0) > 0;
  }

  private async openDb(name: string): Promise<SQLite.SQLiteDatabase> {
    const db = await SQLite.openDatabaseAsync(name);
    this.openDbCounts.set(name, (this.openDbCounts.get(name) ?? 0) + 1);
    return db;
  }

  private async closeDb(
    name: string,
    db: SQLite.SQLiteDatabase,
  ): Promise<void> {
    try {
      await db.closeAsync();
    } catch (error) {
      console.warn(`[DigitalKhattDataService] Closing ${name} failed:`, error);
    } finally {
      const count = (this.openDbCounts.get(name) ?? 1) - 1;
      if (count > 0) this.openDbCounts.set(name, count);
      else this.openDbCounts.delete(name);
    }
  }

  // Reads a bundled DB through its content-addressed on-device copy, under
  // the per-name lock. If the copy is missing it is imported; if reading fails
  // the copy is deleted, re-imported and read once more before giving up.
  private readBundledDb<T>(
    spec: BundledDbSpec,
    read: (db: SQLite.SQLiteDatabase) => Promise<T>,
  ): Promise<T> {
    return this.withDbLock(spec.name, () =>
      this.readBundledDbLocked(spec, read),
    ).then(result => {
      runInBackground('Stale-copy sweep', this.sweepStaleCopies([spec.base]));
      return result;
    });
  }

  private async readBundledDbLocked<T>(
    spec: BundledDbSpec,
    read: (db: SQLite.SQLiteDatabase) => Promise<T>,
  ): Promise<T> {
    let lastError: unknown = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      if (attempt > 1) {
        const detail = errorMessage(lastError);
        console.warn(
          `[DigitalKhattDataService] ${spec.name} unreadable (${detail}); deleting and re-importing it`,
        );
        await deleteDatabaseQuietly(spec.name);
      }
      try {
        return await this.openAndRead(spec, read);
      } catch (error) {
        lastError = error;
      }
    }
    const detail = errorMessage(lastError);
    throw new Error(
      `${spec.name} (${spec.assetFile}) unreadable after re-import: ${detail}`,
    );
  }

  private async openAndRead<T>(
    spec: BundledDbSpec,
    read: (db: SQLite.SQLiteDatabase) => Promise<T>,
  ): Promise<T> {
    let db: SQLite.SQLiteDatabase | null = await this.openDb(spec.name);
    try {
      if (!(await hasTable(db, spec.table))) {
        // First use of this data version (or a damaged copy): import the
        // bundled asset under its content-addressed name. Opening a missing
        // file created an empty one, which must go first: the import skips
        // existing files.
        await this.closeDb(spec.name, db);
        db = null;
        await deleteDatabaseQuietly(spec.name);
        await SQLite.importDatabaseFromAssetAsync(spec.name, {
          assetId: spec.assetId,
        });
        db = await this.openDb(spec.name);
        if (!(await hasTable(db, spec.table))) {
          throw new Error(`table "${spec.table}" missing after import`);
        }
      }
      return await read(db);
    } finally {
      if (db) await this.closeDb(spec.name, db);
    }
  }

  // Deletes on-device copies of `bases` (or of every base) other than their
  // current content-addressed name: unversioned files from older releases and
  // copies of other data versions. Skips anything open or being imported.
  // Runs once per base per session; failures are retried on the next
  // successful open.
  private async sweepStaleCopies(
    bases: readonly string[] | 'all',
  ): Promise<void> {
    let currentByBase: Map<string, string>;
    try {
      currentByBase = getCurrentDbNamesByBase();
    } catch (error) {
      console.warn(
        '[DigitalKhattDataService] Stale-copy sweep skipped:',
        error,
      );
      return;
    }
    const requested = bases === 'all' ? [...currentByBase.keys()] : bases;
    const todo = requested.filter(base => !this.sweptBases.has(base));
    if (todo.length === 0) return;
    for (const base of todo) this.sweptBases.add(base);
    const epoch = this.epoch;
    try {
      const dir = sqliteDirectoryUri();
      if (!dir) return;
      const listing = await FileSystem.readDirectoryAsync(dir);
      if (epoch !== this.epoch) return;
      const current = new Map<string, string>();
      for (const base of todo) {
        const name = currentByBase.get(base);
        if (name !== undefined) current.set(base, name);
      }
      const busy = new Set<string>([
        ...this.dbLocks.keys(),
        ...this.openDbCounts.keys(),
      ]);
      for (const file of selectStaleDbFiles(listing ?? [], current, busy)) {
        if (this.isDbBusy(file)) continue;
        try {
          await SQLite.deleteDatabaseAsync(file);
          console.log(`[DigitalKhattDataService] Removed stale copy ${file}`);
        } catch (error) {
          console.warn(
            `[DigitalKhattDataService] Could not remove ${file}:`,
            error,
          );
        }
      }
    } catch (error) {
      for (const base of todo) this.sweptBases.delete(base);
      console.warn('[DigitalKhattDataService] Stale-copy sweep failed:', error);
    }
  }

  getPageLines(pageNum: number): DKLine[] {
    return this.pageLines.get(pageNum) || [];
  }

  getWordText(wordId: number): string {
    return this.wordsById.get(wordId) || '';
  }

  /**
   * Rendered text of a page line. Ayah lines follow the Release 1 slot model
   * (services/mushaf/lineWordSpans.ts): blank slots render nothing and add no
   * separator, a slot containing spaces stays one unit. Every per-line overlay
   * computes its char offsets with getLineWordSpans over the same join.
   */
  getLineText(line: DKLine): string {
    if (line.line_type === 'surah_name') return '';
    if (line.line_type === 'basmallah') return BASMALLAH_TEXT;
    return layoutLineSlots(line.first_word_id, line.last_word_id, wordId =>
      this.getWordText(wordId),
    ).text;
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

  /**
   * The verse's rendered words in order: blank slots ('' text) are omitted, so
   * joining `text` with single spaces gives exactly getVerseText(). Each entry
   * keeps its Hafs wordPositionInVerse. A slot may hold several space-separated
   * tokens and may end with an inline verse marker (' ۝N'); it is still one
   * word unit (see lineWordSpans.ts).
   */
  getVerseWords(verseKey: string, rewayah?: RewayahId): DKWordInfo[] {
    const slots =
      !rewayah || rewayah === this.currentRewayah
        ? this.verseWords.get(verseKey)
        : this.sideVerseWords.get(rewayah)?.get(verseKey);
    return slots ? visibleWords(slots) : [];
  }

  getVerseText(verseKey: string, rewayah?: RewayahId): string {
    return joinSlotTexts(this.getVerseWords(verseKey, rewayah));
  }

  /**
   * Lazy-load the words DB for a rewayah other than the current one into a
   * side cache so it can be read synchronously by getVerseText/getVerseWords
   * with the `rewayah` param. No-op if rewayah is the current one or already
   * cached. Used by the player to render text for a reciter whose rewayah
   * differs from the mushaf's active rewayah without mutating global state.
   */
  async ensureRewayahLoaded(rewayah: RewayahId): Promise<void> {
    // Resolves once the rewayah's words are readable (isRewayahReady), and
    // rejects if loading fails; either way cache subscribers are notified.
    // Before the first commit the placeholder `rewayah` (Hafs) waits for
    // initialization instead of loading a duplicate copy, and a rewayah the
    // main cache is already loading waits for that load. Never substitutes
    // another rewayah's text.
    if (this.isRewayahReady(rewayah)) {
      // An explicit request pins the retained copy of the previous rewayah.
      if (this.retainedSideRewayah === rewayah) this.retainedSideRewayah = null;
      return;
    }
    requireRewayahAssets(rewayah);

    while (rewayah === this.currentRewayah && !this._initialized) {
      if (!this.mainWorkerRunning && this.loadErrors.has(rewayah)) {
        throw this.loadErrors.get(rewayah);
      }
      await this.waitForMainOutcome();
    }
    let waitedForMain = false;
    while (this.pendingRewayah === rewayah) {
      waitedForMain = true;
      await this.waitForMainOutcome();
    }
    if (this.isRewayahReady(rewayah)) return;
    if (waitedForMain && this.loadErrors.has(rewayah)) {
      throw this.loadErrors.get(rewayah);
    }

    const existing = this.sideLoading.get(rewayah);
    if (existing) return existing;
    let spec: BundledDbSpec;
    try {
      const cfg = requireRewayahAssets(rewayah);
      spec = bundledDbSpec(cfg.wordsDbName, cfg.wordsAssetFile, 'words');
    } catch (error) {
      this.loadErrors.set(rewayah, error);
      this.notifyCacheChange();
      throw error;
    }
    const load = this.loadSideRewayah(rewayah, spec, this.epoch);
    this.sideLoading.set(rewayah, load);
    return load;
  }

  private async loadSideRewayah(
    rewayah: RewayahId,
    spec: BundledDbSpec,
    epoch: number,
  ): Promise<void> {
    let verseWords: Map<string, DKWordInfo[]>;
    try {
      verseWords = await this.readBundledDb(spec, async db =>
        buildVerseWords(await readWordRows(db)),
      );
    } catch (error) {
      if (epoch === this.epoch) {
        this.sideLoading.delete(rewayah);
        this.loadErrors.set(rewayah, error);
        console.warn(
          `[DigitalKhattDataService] Side load of "${rewayah}" failed:`,
          error,
        );
        this.notifyCacheChange();
      }
      throw error;
    }
    if (epoch !== this.epoch) return;
    this.sideLoading.delete(rewayah);
    this.loadErrors.delete(rewayah);
    // If it became the active rewayah meanwhile, the main cache has it.
    if (!(rewayah === this.currentRewayah && this._initialized)) {
      this.sideVerseWords.set(rewayah, verseWords);
    }
    // Side cache for this rewayah is now ready; wake any consumer reading
    // it (e.g. SkiaVerseText on the player screen rendering a non-mushaf
    // rewayah).
    this.notifyCacheChange();
  }

  /** True when `rewayah`'s words are in memory (main or side cache). */
  isRewayahReady(rewayah: RewayahId): boolean {
    if (rewayah === this.currentRewayah) return this._initialized;
    return this.sideVerseWords.has(rewayah);
  }

  getRewayahLoadState(rewayah: RewayahId): RewayahLoadState {
    if (!REWAYAH_DATA[rewayah]) return 'unavailable';
    if (this.isRewayahReady(rewayah)) return 'ready';
    if (this.sideLoading.has(rewayah) || this.pendingRewayah === rewayah) {
      return 'loading';
    }
    if (this.loadErrors.has(rewayah)) return 'error';
    // Before the first commit `rewayah` is a placeholder that getVerseWords
    // routes to the (still empty) main cache; initialization decides.
    if (rewayah === this.currentRewayah) return 'loading';
    return 'idle';
  }

  /** The error of the last failed load of `rewayah`, or null. */
  getRewayahLoadError(rewayah: RewayahId): unknown {
    return this.loadErrors.get(rewayah) ?? null;
  }

  /**
   * getVerseWords with an explicit signal: null while `rewayah`'s words are
   * not in memory (loading, failed or never requested), so callers can wait
   * (ensureRewayahLoaded) or label honestly instead of showing empty or
   * another rewayah's text. [] means loaded but no words for the verse.
   */
  tryGetVerseWords(verseKey: string, rewayah: RewayahId): DKWordInfo[] | null {
    return this.isRewayahReady(rewayah)
      ? this.getVerseWords(verseKey, rewayah)
      : null;
  }

  /** getVerseText with the same null-while-not-loaded signal. */
  tryGetVerseText(verseKey: string, rewayah: RewayahId): string | null {
    return this.isRewayahReady(rewayah)
      ? this.getVerseText(verseKey, rewayah)
      : null;
  }

  getPageForVerse(verseKey: string): number | undefined {
    if (!this.verseToPage) {
      // Never cache a map built from an empty cache (before the first load);
      // commits replace the maps atomically, so a built map is never partial.
      if (
        !this._initialized ||
        this.wordInfoById.size === 0 ||
        this.pageLines.size === 0
      ) {
        return undefined;
      }
      const verseToPage = new Map<string, number>();
      for (const [pageNum, lines] of this.pageLines) {
        for (const line of lines) {
          if (line.line_type !== 'ayah') continue;
          for (let wid = line.first_word_id; wid <= line.last_word_id; wid++) {
            const info = this.wordInfoById.get(wid);
            if (info && !verseToPage.has(info.verseKey)) {
              verseToPage.set(info.verseKey, pageNum);
            }
          }
        }
      }
      this.verseToPage = verseToPage;
    }
    return this.verseToPage.get(verseKey);
  }
}

export const digitalKhattDataService = new DigitalKhattDataService();
