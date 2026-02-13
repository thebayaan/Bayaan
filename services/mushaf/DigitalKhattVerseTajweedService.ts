import {
  digitalKhattDataService,
  BASMALLAH_TEXT,
} from './DigitalKhattDataService';
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

/**
 * Maps tajweed rules onto the 4-word BASMALLAH_TEXT string.
 *
 * The basmala IS verse 1:1, so we look up tajweed data for '1:1' and
 * align the first 4 words (positions 1-4) onto the hardcoded text,
 * skipping position 5 (the verse-end marker ١).
 */
export function getBasmalaTajweedMap(
  indexedTajweedData: IndexedTajweedData,
): Map<number, string> | null {
  const tajweedWords = indexedTajweedData['1:1'];
  if (!tajweedWords) return null;

  const basmalaWords = BASMALLAH_TEXT.split(' ');
  const charToRule = new Map<number, string>();

  let charOffset = 0;
  for (let i = 0; i < basmalaWords.length; i++) {
    const wordText = basmalaWords[i];
    const wordPosition = i + 1; // 1-based positions 1-4

    const tajweedWord = tajweedWords.find(w => {
      const pos = parseInt(w.location.split(':')[2], 10);
      return pos === wordPosition;
    });

    const wordRules = tajweedWord
      ? alignWordTajweed(wordText, tajweedWord.segments)
      : detectWordTafkhim(wordText);

    if (wordRules) {
      for (const [charIdx, rule] of wordRules) {
        charToRule.set(charOffset + charIdx, rule);
      }
    }

    charOffset += wordText.length;
    if (i < basmalaWords.length - 1) charOffset += 1;
  }

  return charToRule.size > 0 ? charToRule : null;
}
