import {digitalKhattDataService} from './DigitalKhattDataService';
import {alignWordTajweed, detectWordTafkhim} from './TajweedAlignmentService';
import type {IndexedTajweedData} from '@/utils/tajweedLoader';

/**
 * Maps tajweed rules to character indices within a DK-encoded verse string.
 *
 * For each verse, we:
 * 1. Get DK words via digitalKhattDataService.getVerseWords(verseKey)
 * 2. Match against indexed tajweed data by wordPositionInVerse
 * 3. Use TajweedAlignmentService to align QPC segments onto DK text
 * 4. Return Map<charIndex, ruleName>
 */
export function getVerseTajweedMap(
  verseKey: string,
  indexedTajweedData: IndexedTajweedData,
): Map<number, string> | null {
  const dkWords = digitalKhattDataService.getVerseWords(verseKey);
  if (dkWords.length === 0) return null;

  const tajweedWords = indexedTajweedData[verseKey];
  if (!tajweedWords) return null;

  const charToRule = new Map<number, string>();

  // Track character offset in the full verse string (words joined by spaces)
  let charOffset = 0;
  for (let i = 0; i < dkWords.length; i++) {
    const dkWord = dkWords[i];

    // Find matching tajweed word by position in verse
    const tajweedWord = tajweedWords.find(w => {
      const pos = parseInt(w.location.split(':')[2], 10);
      return pos === dkWord.wordPositionInVerse;
    });

    // Get per-character rules: aligned QPC rules + tafkhim detection
    const wordRules = tajweedWord
      ? alignWordTajweed(dkWord.text, tajweedWord.segments)
      : detectWordTafkhim(dkWord.text);

    if (wordRules) {
      for (const [dkCharIdx, rule] of wordRules) {
        charToRule.set(charOffset + dkCharIdx, rule);
      }
    }

    charOffset += dkWord.text.length;
    // Add 1 for the space between words (except after the last word)
    if (i < dkWords.length - 1) charOffset += 1;
  }

  return charToRule.size > 0 ? charToRule : null;
}
