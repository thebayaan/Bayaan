// @ai-generated
/**
 * RewayahBasmalaService
 *
 * The basmala each rewayah writes at the head of a surah (contract C6,
 * `data/mushaf/digitalkhatt/<file id>-basmala.json`).
 *
 * The official KFGQPC JSON texts carry no surah-opening basmala (and, in the
 * Madani / Basri counts of Warsh, Qalun, al-Duri and al-Susi, no Fatiha
 * basmala either), so the data pipeline takes it from the signed KFGQPC
 * printed-mushaf Word file of each rewayah:
 *   - `official`: the basmala exactly as the Word file writes it at the head
 *     of most surahs (and of the Fatiha);
 *   - `dk`: the same text converted for the DigitalKhatt font by the render
 *     policy of scripts/rewayah/normalize.py (dk_tokens). This is what the
 *     app draws, like every other rewayah word;
 *   - `bySurah`: the surahs whose opening basmala the Word file writes
 *     differently, e.g. al-Susi 14 and 15 'بِّسۡمِ' (the ba of the basmala
 *     takes the last ba of the previous surah, idgham kabir), the shadda after
 *     94 and 96 (a final sakin ba), the Maghribi waqf sign after the basmala
 *     of 75, 83, 90 and 104 in Warsh / Qalun;
 *   - `source`: the Word file's name and SHA-256.
 *
 * Hafs keeps the DigitalKhatt basmala (BASMALLAH_TEXT) and needs no file.
 * Every surface that draws a surah-opening basmala for another rewayah (mushaf
 * basmallah lines, the player / reading list headers, share cards, previews)
 * takes it from here and never falls back to the Hafs text: a file that fails
 * validation is logged once and its rewayah draws no basmala ('').
 *
 * The files are static bundled data, so the parsed cache never needs
 * invalidating on a rewayah switch. Caches derived from the drawn text (page
 * layouts) key on getDataVersion() (contract C5): it changes exactly when the
 * text a rewayah draws changes.
 */

import type {RewayahId} from '@/services/rewayah/RewayahIdentity';

/**
 * The Hafs basmala as the DigitalKhatt Hafs mushaf draws it (also re-exported
 * by DigitalKhattDataService). The layout DB has no words for basmallah lines.
 */
export const BASMALLAH_TEXT = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ';

export type BasmalaFileId =
  | 'warsh'
  | 'qaloon'
  | 'bazzi'
  | 'qumbul'
  | 'doori'
  | 'soosi'
  | 'shouba';

/** App RewayahId -> `<file id>-basmala.json` (contract C6). */
export const BASMALA_FILE_IDS: Readonly<
  Partial<Record<RewayahId, BasmalaFileId>>
> = {
  warsh: 'warsh',
  qalun: 'qaloon',
  'al-bazzi': 'bazzi',
  qunbul: 'qumbul',
  'al-duri-abi-amr': 'doori',
  'al-susi': 'soosi',
  shubah: 'shouba',
};

export const BASMALA_FORMAT = 1;

/** One basmala spelling: verbatim official text and its DigitalKhatt form. */
export interface BasmalaSpelling {
  official: string;
  dk: string;
}

/** Raw JSON shape of a contract-C6 basmala file. */
export interface RewayahBasmalaJson extends BasmalaSpelling {
  __format: number;
  rewayah: string;
  bySurah?: Record<string, BasmalaSpelling>;
  source: {file: string; sha256: string};
}

export type BasmalaLoader = () => unknown;

// Static require map: Metro only bundles literal require paths. Wrapped in
// thunks so a file is parsed the first time its rewayah draws a basmala.
const DEFAULT_LOADERS: Readonly<Record<BasmalaFileId, BasmalaLoader>> = {
  warsh: () => require('@/data/mushaf/digitalkhatt/warsh-basmala.json'),
  qaloon: () => require('@/data/mushaf/digitalkhatt/qaloon-basmala.json'),
  bazzi: () => require('@/data/mushaf/digitalkhatt/bazzi-basmala.json'),
  qumbul: () => require('@/data/mushaf/digitalkhatt/qumbul-basmala.json'),
  doori: () => require('@/data/mushaf/digitalkhatt/doori-basmala.json'),
  soosi: () => require('@/data/mushaf/digitalkhatt/soosi-basmala.json'),
  shouba: () => require('@/data/mushaf/digitalkhatt/shouba-basmala.json'),
};

const TOTAL_SURAHS = 114;
const BASMALA_SKELETON = 'بسم الله الرحمن الرحيم';
const ARABIC_MARKS = /\p{M}/gu;
const TATWEEL = /\u0640/g;
const SHA256_RE = /^[0-9a-f]{64}$/;

/** Letters only: marks and tatweel removed, wasla alef read as alef. */
function letterSkeleton(text: string): string {
  return text
    .replace(ARABIC_MARKS, '')
    .replace(TATWEEL, '')
    .replace(/\u0671/g, '\u0627');
}

/**
 * True when `text` is a basmala: four words separated by single spaces whose
 * letters are exactly those of 'بسم الله الرحمن الرحيم'. Marks may differ (that
 * is what distinguishes the rewayat), letters may not.
 */
export function isBasmalaText(text: unknown): text is string {
  if (typeof text !== 'string') return false;
  const words = text.split(' ');
  if (words.length !== 4 || words.some(w => w === '' || /\s/.test(w))) {
    return false;
  }
  return letterSkeleton(text) === BASMALA_SKELETON;
}

function isSpelling(value: unknown): value is BasmalaSpelling {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Partial<BasmalaSpelling>;
  return isBasmalaText(v.official) && isBasmalaText(v.dk);
}

interface ParsedBasmala {
  dk: string;
  // surah -> dk, only where it differs from `dk` (what is drawn differently;
  // e.g. the Warsh waqf sign after 75 is dropped by the render policy).
  bySurah: ReadonlyMap<number, string>;
}

/**
 * Validate a contract-C6 basmala file. Throws with a precise message on any
 * structural problem: a malformed file must never put other text where the
 * basmala is drawn.
 */
export function parseBasmala(
  raw: unknown,
  rewayah: RewayahId,
  fileId: BasmalaFileId,
): ParsedBasmala {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error(`${fileId}: basmala file is not an object`);
  }
  const doc = raw as Partial<RewayahBasmalaJson>;
  if (doc.__format !== BASMALA_FORMAT) {
    throw new Error(
      `${fileId}: unsupported basmala format ${String(doc.__format)}`,
    );
  }
  if (doc.rewayah !== rewayah) {
    throw new Error(
      `${fileId}: basmala file declares rewayah "${String(doc.rewayah)}"`,
    );
  }
  const dk = doc.dk;
  if (!isBasmalaText(doc.official) || !isBasmalaText(dk)) {
    throw new Error(`${fileId}: official / dk is not a basmala`);
  }
  const source = doc.source;
  if (
    typeof source !== 'object' ||
    source === null ||
    typeof source.file !== 'string' ||
    source.file === '' ||
    typeof source.sha256 !== 'string' ||
    !SHA256_RE.test(source.sha256)
  ) {
    throw new Error(`${fileId}: source file / sha256 missing`);
  }
  const bySurah = new Map<number, string>();
  if (doc.bySurah !== undefined) {
    const table = doc.bySurah as unknown;
    if (typeof table !== 'object' || table === null || Array.isArray(table)) {
      throw new Error(`${fileId}: bySurah is not an object`);
    }
    for (const [key, value] of Object.entries(table)) {
      const surah = Number(key);
      if (
        !Number.isInteger(surah) ||
        surah < 1 ||
        surah > TOTAL_SURAHS ||
        String(surah) !== key
      ) {
        throw new Error(`${fileId}: bySurah has an invalid surah "${key}"`);
      }
      if (!isSpelling(value)) {
        throw new Error(`${fileId}: bySurah["${key}"] is not a basmala`);
      }
      if (value.dk !== dk) bySurah.set(surah, value.dk);
    }
  }
  return {dk, bySurah};
}

/** FNV-1a (32-bit) of the UTF-16 code units, as 8 hex digits. */
function fingerprint(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/** What a basmallah layout row needs (DKLine is structurally compatible). */
export interface BasmalaLayoutRow {
  page_number: number;
  line_number: number;
  line_type: string;
  surah_number: number | null;
}

/** Key of a layout line in basmalaLineSurahs: `<page>:<line_number>`. */
export function layoutLineKey(pageNumber: number, lineNumber: number): string {
  return `${pageNumber}:${lineNumber}`;
}

/**
 * The surah each basmallah line opens, keyed by layoutLineKey. The layout DB
 * leaves surah_number empty on basmallah lines; the surah is that of the
 * surah_name line directly before it in reading order (rows sorted by page,
 * then line), which may close the previous page. A basmallah line without
 * a surah_name line right before it gets no entry.
 */
export function basmalaLineSurahs(
  rows: readonly BasmalaLayoutRow[],
): Map<string, number> {
  const out = new Map<string, number>();
  let headerSurah: number | null = null;
  for (const row of rows) {
    if (row.line_type === 'surah_name') {
      const surah = Number(row.surah_number);
      headerSurah =
        Number.isInteger(surah) && surah >= 1 && surah <= TOTAL_SURAHS
          ? surah
          : null;
      continue;
    }
    if (row.line_type === 'basmallah' && headerSurah !== null) {
      out.set(layoutLineKey(row.page_number, row.line_number), headerSurah);
    }
    headerSurah = null;
  }
  return out;
}

export class RewayahBasmalaService {
  private readonly loaders: Readonly<Record<BasmalaFileId, BasmalaLoader>>;
  // null = the file failed to load / validate (logged once, then draws '').
  private readonly cache = new Map<BasmalaFileId, ParsedBasmala | null>();
  private readonly versions = new Map<BasmalaFileId, string>();

  constructor(
    loaders: Readonly<Record<BasmalaFileId, BasmalaLoader>> = DEFAULT_LOADERS,
  ) {
    this.loaders = loaders;
  }

  /**
   * The surah-opening basmala `rewayah` draws in the DigitalKhatt font: Hafs
   * BASMALLAH_TEXT; another rewayah its file's `dk`, or the surah's own
   * spelling when the file lists one. '' when the rewayah has no basmala data
   * (taxonomy-only rewayat, or a file that failed validation): never another
   * rewayah's text. `surah` omitted or unknown gives the rewayah's usual
   * spelling. Whether a surah has a basmala at all (not at-Tawbah; the
   * Fatiha's is verse text in the words DB) is the caller's business.
   */
  getText(rewayah: RewayahId, surah?: number | null): string {
    if (rewayah === 'hafs') return BASMALLAH_TEXT;
    const parsed = this.load(rewayah);
    if (!parsed) return '';
    return (surah != null && parsed.bySurah.get(surah)) || parsed.dk;
  }

  /**
   * Version of the basmala text `rewayah` draws (8 hex digits), for caches
   * derived from it; null for Hafs (built-in text) and rewayat without a
   * basmala file. A file that failed validation has a version of its own
   * (it draws '').
   */
  getDataVersion(rewayah: RewayahId): string | null {
    const fileId = BASMALA_FILE_IDS[rewayah];
    if (!fileId || rewayah === 'hafs') return null;
    const cached = this.versions.get(fileId);
    if (cached !== undefined) return cached;
    const parsed = this.load(rewayah);
    const drawn = parsed
      ? [
          parsed.dk,
          ...[...parsed.bySurah]
            .sort(([a], [b]) => a - b)
            .map(([surah, dk]) => `${surah}=${dk}`),
        ].join('\n')
      : '';
    const version = fingerprint(drawn);
    this.versions.set(fileId, version);
    return version;
  }

  /** Drop parsed files (tests). */
  clearCache(): void {
    this.cache.clear();
    this.versions.clear();
  }

  private load(rewayah: RewayahId): ParsedBasmala | null {
    const fileId = BASMALA_FILE_IDS[rewayah];
    if (!fileId) return null;
    if (this.cache.has(fileId)) return this.cache.get(fileId) ?? null;
    let parsed: ParsedBasmala | null = null;
    try {
      parsed = parseBasmala(this.loaders[fileId](), rewayah, fileId);
    } catch (error) {
      console.error(
        `[RewayahBasmala] ${fileId}-basmala.json rejected; no basmala is drawn for this rewayah:`,
        error,
      );
    }
    this.cache.set(fileId, parsed);
    return parsed;
  }
}

export const rewayahBasmalaService = new RewayahBasmalaService();
