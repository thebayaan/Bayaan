import {digitalKhattDataService} from './DigitalKhattDataService';
import {quranTextService} from './QuranTextService';

export interface VerseSegment {
  verseKey: string; // "2:255"
  surahNumber: number;
  ayahNumber: number;
  startCharIndex: number; // in line text
  endCharIndex: number; // in line text
  firstWordId: number;
  lastWordId: number;
}

class MushafVerseMapService {
  // Cache: key = "pageNumber:lineIndex"
  private cache: Map<string, VerseSegment[]> = new Map();
  // Cache: key = pageNumber
  private orderedVerseKeysCache: Map<number, string[]> = new Map();

  getVerseSegments(pageNumber: number, lineIndex: number): VerseSegment[] {
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

    const line = lines[lineIndex];
    if (line.line_type !== 'ayah' && line.line_type !== 'basmallah') return [];

    const lineTextInfo = quranTextService.analyzeText(pageNumber, lineIndex);
    if (!lineTextInfo.wordInfos.length) return [];

    const segments: VerseSegment[] = [];
    let currentSegment: VerseSegment | null = null;
    let wordOffset = 0;

    for (
      let wordId = line.first_word_id;
      wordId <= line.last_word_id;
      wordId++
    ) {
      const dkWordInfo = digitalKhattDataService.getWordInfo(wordId);
      if (!dkWordInfo || wordOffset >= lineTextInfo.wordInfos.length) {
        wordOffset++;
        continue;
      }

      const textWordInfo = lineTextInfo.wordInfos[wordOffset];
      const verseKey = dkWordInfo.verseKey;

      if (currentSegment && currentSegment.verseKey === verseKey) {
        // Extend current segment
        currentSegment.endCharIndex = textWordInfo.endIndex;
        currentSegment.lastWordId = wordId;
      } else {
        // Start new segment
        const parts: string[] = verseKey.split(':');
        currentSegment = {
          verseKey,
          surahNumber: parseInt(parts[0], 10),
          ayahNumber: parseInt(parts[1], 10),
          startCharIndex: textWordInfo.startIndex,
          endCharIndex: textWordInfo.endIndex,
          firstWordId: wordId,
          lastWordId: wordId,
        };
        segments.push(currentSegment);
      }

      wordOffset++;
    }

    return segments;
  }

  getOrderedVerseKeysForPage(pageNumber: number): string[] {
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
