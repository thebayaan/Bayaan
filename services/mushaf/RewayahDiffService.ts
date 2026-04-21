import {
  digitalKhattDataService,
  type DKLine,
  type DKWordInfo,
} from './DigitalKhattDataService';
import type {RewayahId} from '@/services/rewayah/RewayahIdentity';
import {REWAYAH_DIFF_BACKGROUND} from '@/constants/tajweedColors';

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
// damma (ُ) or kasra (ِ) which is the vowel the silah connects to.
const SILAH_CHARS = new Set(['\u06E5', '\u06E6']);
const PRECEDING_VOWELS = new Set(['\u064F', '\u0650']);

/**
 * Ordered list of category names the published Warsh/Qalun tajweed mushaf
 * uses. Each maps to a distinct color (see constants/tajweedColors.ts).
 * Order matches priority for char-rule merging: later entries win on
 * overlap, so the most specific category should come LAST.
 */
export const REWAYAH_DIFF_CATEGORIES = [
  'mukhtalif', // red — catch-all word variants
  'taghliz', // dark blue — Taghliz al-Lam
  'ibdal', // light blue — Warsh hamza → long vowel
  'tashil', // light blue — Hamza tashil / musahhala
  'madd', // green — Madd al-Badal / Madd al-Lin
  'minor', // teal (legacy two-tier: mood/trailing-vowel shifts)
  'major', // orange (legacy two-tier: background block for close rewayat)
] as const;

export type RewayahDiffCategory = (typeof REWAYAH_DIFF_CATEGORIES)[number];

/**
 * Provides rewayah-specific character-level highlights for Mushaf rendering.
 *
 * Loads a diff JSON per non-Hafs rewayah listing which word positions fall
 * into each tajweed category. At render time the service maps a line's
 * words into char-index arrays per category, and SkiaPage wires them into
 * the existing per-char color pipeline alongside tajweed rules and silah.
 */
class RewayahDiffService {
  // category -> verseKey -> (wordPosition -> post-strip char indices).
  // Empty array = whole-word highlight (legacy major/minor; mukhtalif).
  private byCategory: Map<string, Map<string, Map<number, number[]>>> =
    new Map();
  // per-line caches keyed by `${pageNumber}:${lineIndex}:${category}` etc.
  private rangeCache: Map<string, DiffRange[]> = new Map();
  private charCache: Map<string, number[]> = new Map();
  private silahCache: Map<string, number[]> = new Map();
  private currentRewayah: RewayahId = 'hafs';

  get rewayah(): RewayahId {
    return this.currentRewayah;
  }

  get hasSilahColoring(): boolean {
    // Silah-heavy rewayat: Ibn Kathir pair always; Warsh/Qalun use silah
    // less pervasively but still benefit from the mark-level coloring.
    return (
      this.currentRewayah === 'al-bazzi' ||
      this.currentRewayah === 'qunbul' ||
      this.currentRewayah === 'warsh' ||
      this.currentRewayah === 'qalun'
    );
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

  loadForRewayah(rewayah: RewayahId): void {
    this.currentRewayah = rewayah;
    this.byCategory.clear();
    this.rangeCache.clear();
    this.charCache.clear();
    this.silahCache.clear();

    if (rewayah === 'hafs') return;

    const raw = loadDiffAsset(rewayah);
    if (!raw) return;

    // Diff JSON format supports three shapes:
    //   Flat array (legacy Shu'bah): {verseKey: number[]} → whole-word major
    //   Word-only list (legacy two-tier Bazzi/Qumbul):
    //       {verseKey: {major: number[], minor: number[]}} → whole-word
    //   Char-level (new): {verseKey: {cat: [[wordPos, [charIdx, ...]]]}}
    //       Empty charIdx list = whole word.
    for (const [verseKey, value] of Object.entries(raw)) {
      if (Array.isArray(value)) {
        this.addPositions(
          'major',
          verseKey,
          value.map(w => [w, []]),
        );
        continue;
      }
      for (const [cat, entries] of Object.entries(value)) {
        if (!entries || entries.length === 0) continue;
        if (typeof entries[0] === 'number') {
          const words = entries as unknown as number[];
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
      perWord.set(wordPos, charIndices);
    }
  }

  /**
   * For a given category, returns char indices on the given line that belong
   * to words matching that category. Used by SkiaPage to merge into the
   * char-rule map alongside tajweed rules. If a flagged word has specific
   * char indices stored, only those chars are colored (letter-level
   * highlighting for madd/tashil/ibdal/taghliz). Empty char list means
   * whole-word (legacy major/minor and mukhtalif fallback).
   */
  getCharsForCategory(
    category: RewayahDiffCategory,
    pageNumber: number,
    lineIndex: number,
  ): number[] {
    const byVerse = this.byCategory.get(category);
    if (!byVerse || byVerse.size === 0) return EMPTY_INDICES;
    const cacheKey = `${pageNumber}:${lineIndex}:${category}`;
    const cached = this.charCache.get(cacheKey);
    if (cached) return cached;

    const lines = digitalKhattDataService.getPageLines(pageNumber);
    const line: DKLine | undefined = lines[lineIndex];
    if (!line || line.line_type !== 'ayah') {
      this.charCache.set(cacheKey, EMPTY_INDICES);
      return EMPTY_INDICES;
    }

    const indices: number[] = [];
    let offset = 0;
    for (let wid = line.first_word_id; wid <= line.last_word_id; wid++) {
      const info = digitalKhattDataService.getWordInfo(wid);
      if (info) {
        const perWord = byVerse.get(info.verseKey);
        const charList = perWord?.get(info.wordPositionInVerse);
        if (charList !== undefined) {
          if (charList.length === 0) {
            for (let i = 0; i < info.text.length; i++) {
              indices.push(offset + i);
            }
          } else {
            for (const c of charList) {
              if (c >= 0 && c < info.text.length) {
                indices.push(offset + c);
              }
            }
          }
        }
        offset += info.text.length;
      }
      if (wid < line.last_word_id) offset += 1;
    }
    this.charCache.set(cacheKey, indices);
    return indices;
  }

  /**
   * Background-highlight ranges over a flat word-sequence joined by single
   * spaces (the shape both SkiaPage lines and SkiaVerseText verse-text
   * produce). Merges 'major' (close rewayat: Shu'bah/Al-Bazzi/Qunbul) and
   * 'mukhtalif' (far rewayat: Warsh/Qalun/Al-Duri/Al-Susi) — both
   * semantically mean "this word differs from Hafs" and render as a
   * unified background tint.
   *
   * Pure function of the passed word list; returns EMPTY_RANGES if neither
   * category has any entries. Used directly by the verse-level renderer
   * (SkiaVerseText) and indirectly by getDiffRangesForLine for per-line
   * rendering.
   */
  getDiffRangesForWords(words: readonly DKWordInfo[]): DiffRange[] {
    const majorByVerse = this.byCategory.get('major');
    const mukhtalifByVerse = this.byCategory.get('mukhtalif');
    const hasMajor = majorByVerse && majorByVerse.size > 0;
    const hasMukhtalif = mukhtalifByVerse && mukhtalifByVerse.size > 0;
    if (!hasMajor && !hasMukhtalif) return EMPTY_RANGES;

    const ranges: DiffRange[] = [];
    let offset = 0;
    for (let i = 0; i < words.length; i++) {
      const info = words[i];
      const wordLen = info.text.length;
      const inMajor =
        majorByVerse?.get(info.verseKey)?.has(info.wordPositionInVerse) ??
        false;
      const inMukhtalif =
        mukhtalifByVerse?.get(info.verseKey)?.has(info.wordPositionInVerse) ??
        false;
      if (inMajor || inMukhtalif) {
        ranges.push({start: offset, end: offset + wordLen - 1});
      }
      offset += wordLen;
      if (i < words.length - 1) offset += 1;
    }
    return ranges;
  }

  /**
   * Per-line variant — resolves the DK words for the given page line, then
   * delegates to getDiffRangesForWords. Cached by page+line because both
   * the word lookup and the subsequent iteration are hot paths during
   * mushaf page rendering.
   */
  getDiffRangesForLine(pageNumber: number, lineIndex: number): DiffRange[] {
    if (!this.hasDiffs) return EMPTY_RANGES;
    const cacheKey = `${pageNumber}:${lineIndex}`;
    const cached = this.rangeCache.get(cacheKey);
    if (cached) return cached;

    const lines = digitalKhattDataService.getPageLines(pageNumber);
    const line: DKLine | undefined = lines[lineIndex];
    if (!line || line.line_type !== 'ayah') {
      this.rangeCache.set(cacheKey, EMPTY_RANGES);
      return EMPTY_RANGES;
    }

    const words: DKWordInfo[] = [];
    for (let wid = line.first_word_id; wid <= line.last_word_id; wid++) {
      const info = digitalKhattDataService.getWordInfo(wid);
      if (info) words.push(info);
    }
    const ranges = this.getDiffRangesForWords(words);
    this.rangeCache.set(cacheKey, ranges);
    return ranges;
  }

  /**
   * Page-level rewayah-diff highlights grouped by line index, pre-stamped
   * with REWAYAH_DIFF_BACKGROUND. Single source of truth for the page-
   * renderer pipelines (SkiaPage, ContinuousMushafView) — each used to
   * inline the same per-line loop plus its own local copy of the tint
   * color constant.
   *
   * Returns EMPTY_HIGHLIGHTS_MAP when no diffs are loaded so callers can
   * reference-check the result to skip all downstream merging work. Does
   * NOT gate on the user's showRewayahDiffs toggle — callers apply that
   * gate themselves (they already combine it with annotations/playback/
   * theme gates, so pushing one more boolean into this service wouldn't
   * buy anything).
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
   * Silah char indices (U+06E5/U+06E6 + preceding damma/kasra), scanned
   * from stored text at render time rather than from the diff JSON since
   * silah marks are already in the words DB.
   */
  getSilahCharsForLine(pageNumber: number, lineIndex: number): number[] {
    if (!this.hasSilahColoring) return EMPTY_INDICES;
    const cacheKey = `${pageNumber}:${lineIndex}`;
    const cached = this.silahCache.get(cacheKey);
    if (cached) return cached;

    const lines = digitalKhattDataService.getPageLines(pageNumber);
    const line: DKLine | undefined = lines[lineIndex];
    if (!line || line.line_type !== 'ayah') {
      this.silahCache.set(cacheKey, EMPTY_INDICES);
      return EMPTY_INDICES;
    }

    const indices: number[] = [];
    let offset = 0;
    for (let wid = line.first_word_id; wid <= line.last_word_id; wid++) {
      const info = digitalKhattDataService.getWordInfo(wid);
      if (info) {
        const text = info.text;
        for (let i = 0; i < text.length; i++) {
          if (SILAH_CHARS.has(text[i])) {
            indices.push(offset + i);
            if (i > 0 && PRECEDING_VOWELS.has(text[i - 1])) {
              indices.push(offset + i - 1);
            }
          }
        }
        offset += text.length;
      }
      if (wid < line.last_word_id) offset += 1;
    }
    this.silahCache.set(cacheKey, indices);
    return indices;
  }
}

const EMPTY_RANGES: DiffRange[] = [];
const EMPTY_INDICES: number[] = [];
const EMPTY_HIGHLIGHTS_MAP: ReadonlyMap<
  number,
  readonly Readonly<PageDiffHighlight>[]
> = new Map();

// Diff JSON supports legacy (number[]) and new ([wordPos, charIdx[]][]) entries.
// Legacy flat arrays at the verse level are treated as whole-word 'major'.
type CategoryEntries = number[] | [number, number[]][];
type DiffAsset = Record<string, number[] | Record<string, CategoryEntries>>;

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
