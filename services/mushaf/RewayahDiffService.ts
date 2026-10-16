import {
  digitalKhattDataService,
  type DKWordInfo,
} from './DigitalKhattDataService';
import type {RewayahId} from '@/services/rewayah/RewayahIdentity';
import {REWAYAH_DIFF_BACKGROUND} from '@/constants/tajweedColors';
import {getLineWordSpans, layoutWords} from './lineWordSpans';

export interface PageDiffHighlight {
  start: number;
  end: number;
  color: string;
}

export interface DiffRange {
  start: number;
  end: number;
}

// Silah characters (ۥ small high waw, ۦ small high yeh) mark the Bazzi
// pronoun-lengthening feature. We color them AND the immediately-preceding
// damma (ُ) or kasra (ِ) which is the vowel the silah connects to. Only used
// to scan stored text for legacy diff files (no "__format" key).
const SILAH_CHARS = new Set(['\u06E5', '\u06E6']);
const PRECEDING_VOWELS = new Set(['\u064F', '\u0650']);

// Legacy files (no "__format"): rewayat whose stored text is scanned for silah
// marks. Format-2 files carry explicit 'silah' entries instead.
const LEGACY_SILAH_REWAYAT: ReadonlySet<RewayahId> = new Set<RewayahId>([
  'al-bazzi',
  'qunbul',
  'warsh',
  'qalun',
]);

/**
 * Every category a diff file may carry. Each maps to a distinct color (see
 * constants/tajweedColors.ts).
 *
 * Release 1 data (diff JSON format 2) carries only:
 *   - 'major'     whole word, close rewayat (Shu'bah / Al-Bazzi / Qunbul)
 *   - 'mukhtalif' whole word, far rewayat (Warsh / Qalun / Al-Duri / Al-Susi)
 *   - 'silah'     explicit char indices, only where the slot's silah differs
 *                 from Hafs
 * The letter-level categories (tashil / madd / ibdal / taghliz / minor) only
 * occur in legacy files; they are still painted when present.
 */
export const REWAYAH_DIFF_CATEGORIES = [
  'mukhtalif', // red; catch-all word variants
  'taghliz', // dark blue; Taghliz al-Lam
  'ibdal', // light blue; Warsh hamza → long vowel
  'tashil', // light blue; Hamza tashil / musahhala
  'madd', // green; Madd al-Badal / Madd al-Lin
  'minor', // teal (legacy two-tier: mood/trailing-vowel shifts)
  'major', // orange (legacy two-tier: background block for close rewayat)
  'silah', // purple; silah marks that differ from Hafs
] as const;

export type RewayahDiffCategory = (typeof REWAYAH_DIFF_CATEGORIES)[number];

// Foreground char-level categories, in low→high precedence order. Later
// entries override earlier ones when a char falls into multiple categories.
// Silah is applied after these by the rule-map builders as the most specific
// marker (it always wins). 'mukhtalif' and 'major' are whole-word variants
// that render as background tint (REWAYAH_DIFF_BACKGROUND), not chars, so
// they are not part of this list.
const FG_CATEGORIES: readonly RewayahDiffCategory[] = [
  'minor',
  'ibdal',
  'tashil',
  'madd',
  'taghliz',
];

/** Current diff file format; files without "__format" are legacy. */
export const REWAYAH_DIFF_FORMAT = 2;

type WordCharMap = Map<number, number[]>;
type VerseCharMap = Map<string, WordCharMap>;

/** A word slot placed in a joined string (line or verse text). */
interface PlacedWord {
  info: DKWordInfo;
  start: number;
  wordEnd: number;
}

/**
 * Provides rewayah-specific highlights for Mushaf rendering.
 *
 * Loads a diff JSON per non-Hafs rewayah listing, per Hafs verse key, which
 * word positions fall into each category. At render time the service maps a
 * line's (or verse's) words into char-index arrays per category using the
 * shared span model (lineWordSpans.ts), so offsets match the rendered text
 * exactly: blank slots take no room, a multi-token slot is one word, and a
 * whole-word tint never covers a trailing inline verse marker (' ۝N').
 *
 * Diff JSON shapes:
 *   - format 2 (Release 1): top-level object; "__format": 2 is metadata and
 *     every other key is a Hafs verse key -> {category: [[wordPos, [charIdx]]]}.
 *     charIdx are UTF-16 indices into the stored slot text; [] = whole word.
 *     Silah comes only from explicit 'silah' entries.
 *   - legacy (no "__format"): flat arrays (Shu'bah, whole-word 'major'),
 *     word-only lists ({major: number[], minor: number[]}) or char-level
 *     entries; silah is scanned from the stored text.
 */
class RewayahDiffService {
  // category -> verseKey -> (wordPosition -> char indices). [] = whole word.
  private byCategory: Map<string, VerseCharMap> = new Map();
  // "__format" of the loaded file; null for legacy files.
  private format: number | null = null;
  // per-line caches keyed by `${pageNumber}:${lineIndex}[:${category}]`.
  private rangeCache: Map<string, DiffRange[]> = new Map();
  private charCache: Map<string, number[]> = new Map();
  private silahCache: Map<string, number[]> = new Map();
  // Words-cache version the line caches were computed on (-1 = none).
  private lineCacheVersion = -1;
  private currentRewayah: RewayahId = 'hafs';

  get rewayah(): RewayahId {
    return this.currentRewayah;
  }

  /** "__format" of the loaded diff file, or null for a legacy file. */
  get diffFormat(): number | null {
    return this.format;
  }

  get hasSilahColoring(): boolean {
    if (this.format !== null) return this.hasCategory('silah');
    // Legacy files carry no silah entries; the marks are scanned from the
    // stored text for the silah-heavy rewayat.
    return LEGACY_SILAH_REWAYAT.has(this.currentRewayah);
  }

  hasCategory(category: RewayahDiffCategory): boolean {
    const map = this.byCategory.get(category);
    return map !== undefined && map.size > 0;
  }

  get hasAnyDiffs(): boolean {
    for (const m of this.byCategory.values()) {
      if (m.size > 0) return true;
    }
    return false;
  }

  /** Whether any whole-word-variant category ('major' for close rewayat,
   *  'mukhtalif' for far) has entries. Used by SkiaPage and
   *  ContinuousMushafView to decide if background highlights should be
   *  rendered at all. */
  get hasDiffs(): boolean {
    return this.hasCategory('major') || this.hasCategory('mukhtalif');
  }

  /** Whether any foreground (text color) highlight can fire: letter-level
   *  categories or silah. */
  get hasForegroundDiffs(): boolean {
    return (
      this.hasSilahColoring || FG_CATEGORIES.some(c => this.hasCategory(c))
    );
  }

  loadForRewayah(rewayah: RewayahId): void {
    this.currentRewayah = rewayah;
    this.byCategory.clear();
    this.format = null;
    this.clearLineCaches();

    if (rewayah === 'hafs') return;

    const raw = loadDiffAsset(rewayah);
    if (!raw) return;

    const formatValue = (raw as Record<string, unknown>).__format;
    this.format = typeof formatValue === 'number' ? formatValue : null;
    if (__DEV__ && this.format !== null && this.format > REWAYAH_DIFF_FORMAT) {
      console.warn(
        `[RewayahDiffService] ${rewayah}-diff.json has __format ${this.format}; this build reads format ${REWAYAH_DIFF_FORMAT}`,
      );
    }

    for (const [verseKey, value] of Object.entries(raw)) {
      // Metadata keys ("__format") are not verse keys.
      if (verseKey.startsWith('__')) continue;
      if (Array.isArray(value)) {
        // Legacy flat array (Shu'bah): whole-word 'major'.
        this.addPositions(
          'major',
          verseKey,
          value.map(w => [w, []]),
        );
        continue;
      }
      if (!value || typeof value !== 'object') continue;
      for (const [cat, entries] of Object.entries(value)) {
        if (!Array.isArray(entries) || entries.length === 0) continue;
        if (typeof entries[0] === 'number') {
          // Legacy word-only list: whole word.
          const words = entries as number[];
          this.addPositions(
            cat,
            verseKey,
            words.map(w => [w, []]),
          );
        } else {
          this.addPositions(cat, verseKey, entries as [number, number[]][]);
        }
      }
    }
  }

  private addPositions(
    category: string,
    verseKey: string,
    entries: [number, number[]][],
  ): void {
    let perVerse = this.byCategory.get(category);
    if (!perVerse) {
      perVerse = new Map();
      this.byCategory.set(category, perVerse);
    }
    let perWord = perVerse.get(verseKey);
    if (!perWord) {
      perWord = new Map();
      perVerse.set(verseKey, perWord);
    }
    for (const [wordPos, charIndices] of entries) {
      perWord.set(wordPos, Array.isArray(charIndices) ? charIndices : []);
    }
  }

  private clearLineCaches(): void {
    this.rangeCache.clear();
    this.charCache.clear();
    this.silahCache.clear();
    this.lineCacheVersion = -1;
  }

  /**
   * Line-level results describe the ACTIVE words cache. Returns false when it
   * holds another rewayah than the loaded diff data (never project one
   * rewayah's word positions onto another's text), and drops the line caches
   * whenever the words cache changed (digitalKhattDataService.getCacheVersion).
   */
  private syncLineCaches(): boolean {
    if (digitalKhattDataService.rewayah !== this.currentRewayah) return false;
    const version = digitalKhattDataService.getCacheVersion();
    if (version !== this.lineCacheVersion) {
      this.rangeCache.clear();
      this.charCache.clear();
      this.silahCache.clear();
      this.lineCacheVersion = version;
    }
    return true;
  }

  /** Verse-level callers pass the rewayah their word list belongs to. */
  private appliesTo(rewayah: RewayahId | undefined): boolean {
    return rewayah === undefined || rewayah === this.currentRewayah;
  }

  private getLineWords(pageNumber: number, lineIndex: number): PlacedWord[] {
    const line = digitalKhattDataService.getPageLines(pageNumber)[lineIndex];
    return getLineWordSpans(line, digitalKhattDataService);
  }

  /**
   * For a given category, returns char indices on the given line that belong
   * to words matching that category. Used by the page renderers to merge into
   * the char-rule map alongside tajweed rules. If a flagged word has specific
   * char indices stored, only those chars are colored; an empty char list
   * means the whole word (trailing inline verse marker excluded).
   */
  getCharsForCategory(
    category: RewayahDiffCategory,
    pageNumber: number,
    lineIndex: number,
  ): number[] {
    const byVerse = this.byCategory.get(category);
    if (!byVerse || byVerse.size === 0) return EMPTY_INDICES;
    if (!this.syncLineCaches()) return EMPTY_INDICES;
    const cacheKey = `${pageNumber}:${lineIndex}:${category}`;
    const cached = this.charCache.get(cacheKey);
    if (cached) return cached;

    const indices: number[] = [];
    for (const word of this.getLineWords(pageNumber, lineIndex)) {
      pushCategoryChars(byVerse, word, idx => indices.push(idx));
    }
    const result = indices.length > 0 ? indices : EMPTY_INDICES;
    this.charCache.set(cacheKey, result);
    return result;
  }

  private rangesForWords(words: readonly PlacedWord[]): DiffRange[] {
    const majorByVerse = this.byCategory.get('major');
    const mukhtalifByVerse = this.byCategory.get('mukhtalif');
    const ranges: DiffRange[] = [];
    for (const {info, start, wordEnd} of words) {
      if (wordEnd < start) continue; // slot is only a verse marker
      const inMajor =
        majorByVerse?.get(info.verseKey)?.has(info.wordPositionInVerse) ??
        false;
      const inMukhtalif =
        mukhtalifByVerse?.get(info.verseKey)?.has(info.wordPositionInVerse) ??
        false;
      if (inMajor || inMukhtalif) ranges.push({start, end: wordEnd});
    }
    return ranges.length > 0 ? ranges : EMPTY_RANGES;
  }

  /**
   * Background-highlight ranges over a verse-level word list joined by single
   * spaces (the text SkiaVerseText renders; blank slots skipped). Merges
   * 'major' (close rewayat: Shu'bah/Al-Bazzi/Qunbul) and 'mukhtalif' (far
   * rewayat: Warsh/Qalun/Al-Duri/Al-Susi); both mean "this word differs from
   * Hafs" and render as one background tint covering the whole word unit,
   * never its trailing inline verse marker.
   *
   * `rewayah` is the rewayah the words belong to; when it differs from the
   * loaded diff data, nothing is returned. Returns EMPTY_RANGES if neither
   * category has any entries.
   */
  getDiffRangesForWords(
    words: readonly DKWordInfo[],
    rewayah?: RewayahId,
  ): DiffRange[] {
    if (!this.hasDiffs || !this.appliesTo(rewayah)) return EMPTY_RANGES;
    const {spans} = layoutWords(words);
    return this.rangesForWords(
      spans.map(s => ({info: s.item, start: s.start, wordEnd: s.wordEnd})),
    );
  }

  /**
   * Per-line variant of getDiffRangesForWords over the line's rendered text.
   * Cached by page+line because both the word lookup and the subsequent
   * iteration are hot paths during mushaf page rendering.
   */
  getDiffRangesForLine(pageNumber: number, lineIndex: number): DiffRange[] {
    if (!this.hasDiffs) return EMPTY_RANGES;
    if (!this.syncLineCaches()) return EMPTY_RANGES;
    const cacheKey = `${pageNumber}:${lineIndex}`;
    const cached = this.rangeCache.get(cacheKey);
    if (cached) return cached;

    const ranges = this.rangesForWords(
      this.getLineWords(pageNumber, lineIndex),
    );
    this.rangeCache.set(cacheKey, ranges);
    return ranges;
  }

  /**
   * Foreground char→rule map for a page line, merging every letter-level
   * category plus silah onto the same char indices the line renderer uses.
   * Shared by SkiaPage and ContinuousMushafView so both page pipelines paint
   * identical foreground highlights. Callers gate it on the user's
   * 'Show differences' toggle and merge it over their (Hafs-only) tajweed map.
   *
   * Returns null when no rewayah foreground categories fire on this line.
   */
  getRewayahRuleMapForLine(
    pageNumber: number,
    lineIndex: number,
  ): Map<number, string> | null {
    if (!this.hasForegroundDiffs) return null;

    const merged = new Map<number, string>();
    for (const cat of FG_CATEGORIES) {
      if (!this.hasCategory(cat)) continue;
      const indexes = this.getCharsForCategory(cat, pageNumber, lineIndex);
      for (const idx of indexes) merged.set(idx, cat);
    }
    if (this.hasSilahColoring) {
      const silahIndexes = this.getSilahCharsForLine(pageNumber, lineIndex);
      for (const idx of silahIndexes) merged.set(idx, 'silah');
    }
    return merged.size > 0 ? merged : null;
  }

  /**
   * Verse-level equivalent of getRewayahRuleMapForLine over a word list joined
   * by single spaces (the text SkiaVerseText renders; blank slots skipped).
   *
   * Precedence matches getRewayahRuleMapForLine: minor → ibdal → tashil →
   * madd → taghliz → silah. `rewayah` is the rewayah the words belong to;
   * when it differs from the loaded diff data, null is returned.
   */
  getRewayahRuleMapForWords(
    words: readonly DKWordInfo[],
    rewayah?: RewayahId,
  ): Map<number, string> | null {
    if (!this.hasForegroundDiffs || !this.appliesTo(rewayah)) return null;

    const categoryMaps: Array<[RewayahDiffCategory, VerseCharMap]> = [];
    for (const cat of FG_CATEGORIES) {
      const byVerse = this.byCategory.get(cat);
      if (byVerse && byVerse.size > 0) categoryMaps.push([cat, byVerse]);
    }
    const explicitSilah =
      this.format !== null ? this.byCategory.get('silah') : undefined;
    const scanSilah = this.format === null && this.hasSilahColoring;

    const merged = new Map<number, string>();
    for (const span of layoutWords(words).spans) {
      const word: PlacedWord = {
        info: span.item,
        start: span.start,
        wordEnd: span.wordEnd,
      };
      // Letter-level categories (low→high precedence; later wins).
      for (const [cat, byVerse] of categoryMaps) {
        pushCategoryChars(byVerse, word, idx => merged.set(idx, cat));
      }
      // Silah always wins.
      if (explicitSilah) {
        pushCategoryChars(explicitSilah, word, idx => merged.set(idx, 'silah'));
      } else if (scanSilah) {
        pushScannedSilahChars(word, idx => merged.set(idx, 'silah'));
      }
    }
    return merged.size > 0 ? merged : null;
  }

  /**
   * Page-level rewayah-diff highlights grouped by line index, pre-stamped
   * with REWAYAH_DIFF_BACKGROUND. Single source of truth for the page-
   * renderer pipelines (SkiaPage, ContinuousMushafView).
   *
   * Returns EMPTY_HIGHLIGHTS_MAP when no diffs are loaded so callers can
   * reference-check the result to skip all downstream merging work. Does
   * NOT gate on the user's showRewayahDiffs toggle; callers apply that
   * gate themselves.
   */
  getPageDiffHighlightsByLine(
    pageNumber: number,
  ): ReadonlyMap<number, readonly Readonly<PageDiffHighlight>[]> {
    if (!this.hasDiffs) return EMPTY_HIGHLIGHTS_MAP;
    const lineCount = digitalKhattDataService.getPageLines(pageNumber).length;
    if (lineCount === 0) return EMPTY_HIGHLIGHTS_MAP;

    const map = new Map<number, Readonly<PageDiffHighlight>[]>();
    for (let lineIndex = 0; lineIndex < lineCount; lineIndex++) {
      const ranges = this.getDiffRangesForLine(pageNumber, lineIndex);
      if (ranges.length === 0) continue;
      const entries: Readonly<PageDiffHighlight>[] = ranges.map(r => ({
        start: r.start,
        end: r.end,
        color: REWAYAH_DIFF_BACKGROUND,
      }));
      map.set(lineIndex, entries);
    }
    return map.size > 0 ? map : EMPTY_HIGHLIGHTS_MAP;
  }

  /**
   * Silah char indices on a line: the explicit 'silah' entries of a format-2
   * file, or (legacy files only) U+06E5/U+06E6 plus the preceding
   * damma/kasra scanned from the stored text.
   */
  getSilahCharsForLine(pageNumber: number, lineIndex: number): number[] {
    if (!this.hasSilahColoring) return EMPTY_INDICES;
    if (this.format !== null) {
      return this.getCharsForCategory('silah', pageNumber, lineIndex);
    }
    if (!this.syncLineCaches()) return EMPTY_INDICES;
    const cacheKey = `${pageNumber}:${lineIndex}`;
    const cached = this.silahCache.get(cacheKey);
    if (cached) return cached;

    const indices: number[] = [];
    for (const word of this.getLineWords(pageNumber, lineIndex)) {
      pushScannedSilahChars(word, idx => indices.push(idx));
    }
    const result = indices.length > 0 ? indices : EMPTY_INDICES;
    this.silahCache.set(cacheKey, result);
    return result;
  }
}

/**
 * Emits the line/verse indices a category entry colors on one placed word:
 * the whole-word part for an empty char list, else the listed indices that
 * fall inside the whole-word part (never on a trailing inline verse marker).
 */
function pushCategoryChars(
  byVerse: VerseCharMap,
  word: PlacedWord,
  emit: (index: number) => void,
): void {
  const charList = byVerse
    .get(word.info.verseKey)
    ?.get(word.info.wordPositionInVerse);
  if (charList === undefined) return;
  const wholeLength = word.wordEnd - word.start + 1;
  if (charList.length === 0) {
    for (let c = 0; c < wholeLength; c++) emit(word.start + c);
    return;
  }
  for (const c of charList) {
    if (Number.isInteger(c) && c >= 0 && c < wholeLength) emit(word.start + c);
  }
}

/** Legacy silah scan of a word's whole-word part. */
function pushScannedSilahChars(
  word: PlacedWord,
  emit: (index: number) => void,
): void {
  const text = word.info.text;
  const wholeLength = word.wordEnd - word.start + 1;
  for (let c = 0; c < wholeLength; c++) {
    if (SILAH_CHARS.has(text[c])) {
      emit(word.start + c);
      if (c > 0 && PRECEDING_VOWELS.has(text[c - 1])) {
        emit(word.start + c - 1);
      }
    }
  }
}

const EMPTY_RANGES: DiffRange[] = [];
const EMPTY_INDICES: number[] = [];
const EMPTY_HIGHLIGHTS_MAP: ReadonlyMap<
  number,
  readonly Readonly<PageDiffHighlight>[]
> = new Map();

// Diff JSON supports legacy (number[]) and char-level ([wordPos, charIdx[]][])
// entries; legacy flat arrays at the verse level are whole-word 'major'.
// Format-2 files add the "__format" metadata key.
type CategoryEntries = number[] | [number, number[]][];
type DiffAsset = Record<
  string,
  number | number[] | Record<string, CategoryEntries>
>;

// Diff JSON files on disk keep the pre-canonical filenames to avoid asset
// churn; only the RewayahId key we switch on is canonical.
function loadDiffAsset(rewayah: RewayahId): DiffAsset | null {
  switch (rewayah) {
    case 'shubah':
      return require('@/data/mushaf/digitalkhatt/shouba-diff.json') as DiffAsset;
    case 'al-bazzi':
      return require('@/data/mushaf/digitalkhatt/bazzi-diff.json') as DiffAsset;
    case 'qunbul':
      return require('@/data/mushaf/digitalkhatt/qumbul-diff.json') as DiffAsset;
    case 'warsh':
      return require('@/data/mushaf/digitalkhatt/warsh-diff.json') as DiffAsset;
    case 'qalun':
      return require('@/data/mushaf/digitalkhatt/qaloon-diff.json') as DiffAsset;
    case 'al-duri-abi-amr':
      return require('@/data/mushaf/digitalkhatt/doori-diff.json') as DiffAsset;
    case 'al-susi':
      return require('@/data/mushaf/digitalkhatt/soosi-diff.json') as DiffAsset;
    default:
      return null;
  }
}

export const rewayahDiffService = new RewayahDiffService();
