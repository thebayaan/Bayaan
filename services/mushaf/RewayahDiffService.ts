import {digitalKhattDataService, type DKLine} from './DigitalKhattDataService';
import type {RewayahId} from '@/store/mushafSettingsStore';

export interface DiffRange {
  start: number;
  end: number;
}

// Silah characters (ۥ small high waw, ۦ small high yeh) mark the Bazzi
// pronoun-lengthening feature. We color them AND the immediately-preceding
// damma (ُ) or kasra (ِ) which is the vowel the silah connects to. This
// surfaces where Bazzi's signature silah reading happens without flooding
// the page with background highlights.
const SILAH_CHARS = new Set(['\u06E5', '\u06E6']);
const PRECEDING_VOWELS = new Set(['\u064F', '\u0650']);

/**
 * Provides rewayah-diff highlight ranges for Mushaf rendering.
 *
 * The offline build step emits one diff JSON per non-Hafs rewayah listing
 * which words (by surah/ayah/position) differ from Hafs. At render time,
 * this service translates those positions into character ranges inside the
 * joined line text that SkiaLine renders. Consumers merge the ranges into
 * the paragraph's `backgroundHighlights` to visually mark the words that
 * are unique to the current rewayah.
 *
 * Results are cached per `(pageNumber, lineIndex)` and cleared on rewayah
 * switch. Hafs mode produces empty ranges for all lines (no diffs).
 */
class RewayahDiffService {
  private diffByVerse: Map<string, Set<number>> = new Map();
  private minorByVerse: Map<string, Set<number>> = new Map();
  private rangeCache: Map<string, DiffRange[]> = new Map();
  private minorCharCache: Map<string, number[]> = new Map();
  private silahCache: Map<string, number[]> = new Map();
  private currentRewayah: RewayahId = 'hafs';

  get rewayah(): RewayahId {
    return this.currentRewayah;
  }

  get hasDiffs(): boolean {
    return this.diffByVerse.size > 0;
  }

  get hasSilahColoring(): boolean {
    // Only Bazzi/Qumbul (Ibn Kathir) emit silah on nearly every pronoun.
    // Other rewayat use silah sparingly or not at all, so we only enable
    // the inline coloring where it's genuinely a distinguishing feature.
    return (
      this.currentRewayah === 'bazzi' || this.currentRewayah === 'qumbul'
    );
  }

  get hasMinorDiffs(): boolean {
    return this.minorByVerse.size > 0;
  }

  loadForRewayah(rewayah: RewayahId): void {
    this.currentRewayah = rewayah;
    this.diffByVerse.clear();
    this.minorByVerse.clear();
    this.rangeCache.clear();
    this.minorCharCache.clear();
    this.silahCache.clear();

    if (rewayah === 'hafs') return;

    const raw = loadDiffAsset(rewayah);
    if (!raw) return;

    // Supports two formats:
    //   Legacy (flat): {verseKey: number[]} — all treated as major.
    //   Tiered: {verseKey: {major?: number[], minor?: number[]}}.
    for (const [verseKey, value] of Object.entries(raw)) {
      if (Array.isArray(value)) {
        this.diffByVerse.set(verseKey, new Set(value));
        continue;
      }
      if (value.major && value.major.length > 0) {
        this.diffByVerse.set(verseKey, new Set(value.major));
      }
      if (value.minor && value.minor.length > 0) {
        this.minorByVerse.set(verseKey, new Set(value.minor));
      }
    }
  }

  /**
   * Character indices in the rendered line text for minor-tier diff words
   * — trailing-vowel or mood-shift variants that deserve inline foreground
   * color rather than a background block. Returns every char index that
   * belongs to a minor-diff word on this line.
   */
  getMinorCharsForLine(pageNumber: number, lineIndex: number): number[] {
    if (this.minorByVerse.size === 0) return EMPTY_INDICES;
    const cacheKey = `${pageNumber}:${lineIndex}`;
    const cached = this.minorCharCache.get(cacheKey);
    if (cached) return cached;

    const lines = digitalKhattDataService.getPageLines(pageNumber);
    const line: DKLine | undefined = lines[lineIndex];
    if (!line || line.line_type !== 'ayah') {
      this.minorCharCache.set(cacheKey, EMPTY_INDICES);
      return EMPTY_INDICES;
    }

    const indices: number[] = [];
    let offset = 0;
    for (let wid = line.first_word_id; wid <= line.last_word_id; wid++) {
      const info = digitalKhattDataService.getWordInfo(wid);
      if (info) {
        const positions = this.minorByVerse.get(info.verseKey);
        if (positions && positions.has(info.wordPositionInVerse)) {
          for (let i = 0; i < info.text.length; i++) {
            indices.push(offset + i);
          }
        }
        offset += info.text.length;
      }
      if (wid < line.last_word_id) offset += 1;
    }
    this.minorCharCache.set(cacheKey, indices);
    return indices;
  }

  /**
   * Character indices in the rendered line text that should be foreground-
   * colored to indicate a Bazzi silah mark + its preceding vowel. Cached
   * per line and cleared on rewayah switch.
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
            // Also color the preceding vowel (damma or kasra) if present
            if (i > 0 && PRECEDING_VOWELS.has(text[i - 1])) {
              indices.push(offset + i - 1);
            }
          }
        }
        offset += text.length;
      }
      if (wid < line.last_word_id) offset += 1; // space separator
    }
    this.silahCache.set(cacheKey, indices);
    return indices;
  }

  getDiffRangesForLine(pageNumber: number, lineIndex: number): DiffRange[] {
    const cacheKey = `${pageNumber}:${lineIndex}`;
    const cached = this.rangeCache.get(cacheKey);
    if (cached) return cached;

    const ranges = this.computeLineRanges(pageNumber, lineIndex);
    this.rangeCache.set(cacheKey, ranges);
    return ranges;
  }

  private computeLineRanges(
    pageNumber: number,
    lineIndex: number,
  ): DiffRange[] {
    if (this.diffByVerse.size === 0) return EMPTY_RANGES;

    const lines = digitalKhattDataService.getPageLines(pageNumber);
    const line: DKLine | undefined = lines[lineIndex];
    if (!line || line.line_type !== 'ayah') return EMPTY_RANGES;

    const ranges: DiffRange[] = [];
    let offset = 0;

    for (let wid = line.first_word_id; wid <= line.last_word_id; wid++) {
      const info = digitalKhattDataService.getWordInfo(wid);
      if (!info) continue;
      const wordLen = info.text.length;
      const versePositions = this.diffByVerse.get(info.verseKey);
      if (versePositions && versePositions.has(info.wordPositionInVerse)) {
        ranges.push({start: offset, end: offset + wordLen - 1});
      }
      offset += wordLen;
      if (wid < line.last_word_id) offset += 1; // space separator
    }

    return ranges;
  }
}

const EMPTY_RANGES: DiffRange[] = [];
const EMPTY_INDICES: number[] = [];

type DiffTier = {major?: number[]; minor?: number[]};
type DiffAsset = Record<string, number[] | DiffTier>;

function loadDiffAsset(rewayah: RewayahId): DiffAsset | null {
  if (rewayah === 'shouba') {
    return require('@/data/mushaf/digitalkhatt/shouba-diff.json') as DiffAsset;
  }
  if (rewayah === 'bazzi') {
    return require('@/data/mushaf/digitalkhatt/bazzi-diff.json') as DiffAsset;
  }
  if (rewayah === 'qumbul') {
    return require('@/data/mushaf/digitalkhatt/qumbul-diff.json') as DiffAsset;
  }
  return null;
}

export const rewayahDiffService = new RewayahDiffService();
