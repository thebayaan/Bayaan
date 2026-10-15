import type {
  DKLine,
  DKWordInfo,
} from '@/services/mushaf/DigitalKhattDataService';
import {
  getLineWordSpans,
  type WordSlotSource,
} from '@/services/mushaf/lineWordSpans';
import type {LineHighlightMap} from './verseHighlightLayers';

const AYAH_MARKER = '۝';

function isAyahMarker(word: DKWordInfo): boolean {
  return word.text.trimStart().startsWith(AYAH_MARKER);
}

/**
 * The Digital Khatt word position Tilawa's word index points at. The two
 * segmentations agree on every ayah but 37:130, so a count mismatch falls
 * back to the proportional position.
 */
export function dkWordPosition(
  verseWords: readonly DKWordInfo[],
  wordIndex: number,
  totalWords: number,
): number | null {
  const positions = verseWords
    .filter(w => !isAyahMarker(w))
    .map(w => w.wordPositionInVerse);
  if (positions.length === 0 || totalWords <= 0) return null;
  const index =
    positions.length === totalWords
      ? wordIndex
      : Math.floor((wordIndex * positions.length) / totalWords);
  return positions[Math.min(Math.max(index, 0), positions.length - 1)];
}

/**
 * Adds a run for the recited word on top of the page's existing per-line
 * highlights. Returns `base` unchanged when the word is not on this page.
 */
export function withRecitedWordRun(
  base: LineHighlightMap,
  lines: readonly DKLine[],
  source: WordSlotSource,
  verseKey: string,
  position: number,
  color: string,
): LineHighlightMap {
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const span = getLineWordSpans(lines[lineIndex], source).find(
      s =>
        s.info.verseKey === verseKey && s.info.wordPositionInVerse === position,
    );
    if (!span) continue;
    const out: LineHighlightMap = new Map(base);
    out.set(lineIndex, [
      ...(base.get(lineIndex) ?? []),
      {start: span.start, end: span.wordEnd, color},
    ]);
    return out;
  }
  return base;
}
