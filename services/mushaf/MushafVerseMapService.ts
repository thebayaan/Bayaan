import {digitalKhattDataService} from './DigitalKhattDataService';
import {getLineWordSpans} from './lineWordSpans';
import type {RewayahId} from '@/services/rewayah/RewayahIdentity';

export interface VerseSegment {
  verseKey: string; // "2:255"
  surahNumber: number;
  ayahNumber: number;
  startCharIndex: number; // in line text
  endCharIndex: number; // in line text
  firstWordId: number;
  lastWordId: number;
}

/**
 * Verse segments per mushaf line (verse highlights, playback/selection tints
 * and long-press hit-testing). Char ranges index into the exact string
 * DigitalKhattDataService.getLineText() renders; they come from the shared
 * span model (lineWordSpans.ts), so blank slots and multi-token slots never
 * shift a verse boundary.
 *
 * Caches are tied to the words they were computed from: they are dropped
 * automatically whenever the active rewayah or
 * digitalKhattDataService.getCacheVersion() changes, so no char range from a
 * previous rewayah (or a previous copy of the data) survives a switch.
 */
class MushafVerseMapService {
  // Cache: key = "pageNumber:lineIndex"
  private cache: Map<string, VerseSegment[]> = new Map();
  // Cache: key = pageNumber
  private orderedVerseKeysCache: Map<number, string[]> = new Map();
  // Words cache (rewayah + cache version) the caches above were computed on.
  private dataRewayah: RewayahId | null = null;
  private dataVersion = -1;

  /** Drops every cached segment. Also happens automatically on data change. */
  clear(): void {
    this.cache.clear();
    this.orderedVerseKeysCache.clear();
    this.dataRewayah = null;
    this.dataVersion = -1;
  }

  private ensureFresh(): void {
    const rewayah = digitalKhattDataService.rewayah;
    const version = digitalKhattDataService.getCacheVersion();
    if (rewayah !== this.dataRewayah || version !== this.dataVersion) {
      this.cache.clear();
      this.orderedVerseKeysCache.clear();
      this.dataRewayah = rewayah;
      this.dataVersion = version;
    }
  }

  getVerseSegments(pageNumber: number, lineIndex: number): VerseSegment[] {
    this.ensureFresh();
    const key = `${pageNumber}:${lineIndex}`;
    const cached = this.cache.get(key);
    if (cached) return cached;

    const segments = this.computeVerseSegments(pageNumber, lineIndex);
    this.cache.set(key, segments);
    return segments;
  }

  private computeVerseSegments(
    pageNumber: number,
    lineIndex: number,
  ): VerseSegment[] {
    const lines = digitalKhattDataService.getPageLines(pageNumber);
    if (lineIndex >= lines.length) return [];

    // Surah-name and basmallah lines have no word slots, hence no segments.
    const spans = getLineWordSpans(lines[lineIndex], digitalKhattDataService);
    if (spans.length === 0) return [];

    const segments: VerseSegment[] = [];
    let currentSegment: VerseSegment | null = null;

    for (const span of spans) {
      const verseKey = span.info.verseKey;

      if (currentSegment && currentSegment.verseKey === verseKey) {
        // Extend current segment (covers the space before this slot too)
        currentSegment.endCharIndex = span.end;
        currentSegment.lastWordId = span.wordId;
      } else {
        // Start new segment
        const parts: string[] = verseKey.split(':');
        currentSegment = {
          verseKey,
          surahNumber: parseInt(parts[0], 10),
          ayahNumber: parseInt(parts[1], 10),
          startCharIndex: span.start,
          endCharIndex: span.end,
          firstWordId: span.wordId,
          lastWordId: span.wordId,
        };
        segments.push(currentSegment);
      }
    }

    return segments;
  }

  getOrderedVerseKeysForPage(pageNumber: number): string[] {
    this.ensureFresh();
    const cached = this.orderedVerseKeysCache.get(pageNumber);
    if (cached) return cached;

    const lines = digitalKhattDataService.getPageLines(pageNumber);
    const seen = new Set<string>();
    const ordered: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const segments = this.getVerseSegments(pageNumber, i);
      for (const segment of segments) {
        if (!seen.has(segment.verseKey)) {
          seen.add(segment.verseKey);
          ordered.push(segment.verseKey);
        }
      }
    }

    this.orderedVerseKeysCache.set(pageNumber, ordered);
    return ordered;
  }

  findVerseAtCharIndex(
    pageNumber: number,
    lineIndex: number,
    charIndex: number,
  ): VerseSegment | null {
    const segments = this.getVerseSegments(pageNumber, lineIndex);
    for (const segment of segments) {
      if (
        charIndex >= segment.startCharIndex &&
        charIndex <= segment.endCharIndex
      ) {
        return segment;
      }
    }
    return null;
  }

  getVerseSegmentsForPage(
    pageNumber: number,
    verseKey: string,
  ): {lineIndex: number; segment: VerseSegment}[] {
    const lines = digitalKhattDataService.getPageLines(pageNumber);
    const results: {lineIndex: number; segment: VerseSegment}[] = [];

    for (let i = 0; i < lines.length; i++) {
      const segments = this.getVerseSegments(pageNumber, i);
      for (const segment of segments) {
        if (segment.verseKey === verseKey) {
          results.push({lineIndex: i, segment});
        }
      }
    }

    return results;
  }
}

export const mushafVerseMapService = new MushafVerseMapService();
