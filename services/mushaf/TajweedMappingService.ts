import {digitalKhattDataService} from './DigitalKhattDataService';
import {getLineWordSpans} from './lineWordSpans';
import {alignWordTajweed, detectWordTafkhim} from './TajweedAlignmentService';
import type {IndexedTajweedData} from '@/utils/tajweedLoader';

/**
 * Maps tajweed rules to character indices within a mushaf line.
 *
 * The tajweed data is the Hafs QPC set (keyed by Hafs verse/word position), so
 * it is only ever painted on Hafs text: for any other rewayah in the active
 * DK words cache this returns null.
 *
 * For each line, we:
 * 1. Lay out the line's word slots with the shared span model (blank slots
 *    skipped, multi-token slots kept whole), so offsets match getLineText()
 * 2. Match each slot against indexed tajweed data by Hafs word position
 * 3. Use TajweedAlignmentService to align QPC segments onto DK text
 * 4. Build a Map<charIndex, ruleName> for the line's text
 */
export function getLineTajweedMap(
  pageNumber: number,
  lineIndex: number,
  indexedTajweedData: IndexedTajweedData,
): Map<number, string> | null {
  if (digitalKhattDataService.rewayah !== 'hafs') return null;

  const line = digitalKhattDataService.getPageLines(pageNumber)[lineIndex];
  const spans = getLineWordSpans(line, digitalKhattDataService);
  if (spans.length === 0) return null;

  const charToRule = new Map<number, string>();

  for (const span of spans) {
    const verseWords = indexedTajweedData[span.info.verseKey];
    if (!verseWords) continue;

    // Find the matching tajweed word by position in verse
    const tajweedWord = verseWords.find(w => {
      const pos = parseInt(w.location.split(':')[2], 10);
      return pos === span.info.wordPositionInVerse;
    });

    // Get per-character rules: aligned QPC rules + tafkhim detection
    const wordRules = tajweedWord
      ? alignWordTajweed(span.text, tajweedWord.segments)
      : detectWordTafkhim(span.text);

    if (wordRules) {
      for (const [dkCharIdx, rule] of wordRules) {
        if (dkCharIdx < span.text.length) {
          charToRule.set(span.start + dkCharIdx, rule);
        }
      }
    }
  }

  return charToRule.size > 0 ? charToRule : null;
}
