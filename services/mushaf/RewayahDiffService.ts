import {digitalKhattDataService, type DKLine} from './DigitalKhattDataService';
import type {RewayahId} from '@/store/mushafSettingsStore';

export interface DiffRange {
  start: number;
  end: number;
}

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
  private rangeCache: Map<string, DiffRange[]> = new Map();
  private currentRewayah: RewayahId = 'hafs';

  get rewayah(): RewayahId {
    return this.currentRewayah;
  }

  get hasDiffs(): boolean {
    return this.diffByVerse.size > 0;
  }

  loadForRewayah(rewayah: RewayahId): void {
    this.currentRewayah = rewayah;
    this.diffByVerse.clear();
    this.rangeCache.clear();

    if (rewayah === 'hafs') return;

    const raw = loadDiffAsset(rewayah);
    if (!raw) return;

    for (const [verseKey, positions] of Object.entries(raw)) {
      this.diffByVerse.set(verseKey, new Set(positions));
    }
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

function loadDiffAsset(rewayah: RewayahId): Record<string, number[]> | null {
  if (rewayah === 'shouba') {
    return require('@/data/mushaf/digitalkhatt/shouba-diff.json') as Record<
      string,
      number[]
    >;
  }
  return null;
}

export const rewayahDiffService = new RewayahDiffService();
