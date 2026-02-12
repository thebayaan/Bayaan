import {digitalKhattDataService, type DKLine} from './DigitalKhattDataService';
import {quranTextService} from './QuranTextService';
import {alignWordTajweed, detectWordTafkhim} from './TajweedAlignmentService';
import type {IndexedTajweedData} from '@/utils/tajweedLoader';

/**
 * Maps tajweed rules to character indices within a mushaf line.
 *
 * For each line, we:
 * 1. Get word IDs from DKLine (first_word_id..last_word_id)
 * 2. Look up each word's verse key and position via DigitalKhattDataService
 * 3. Match against indexed tajweed data (from tajweedStore)
 * 4. Use TajweedAlignmentService to align QPC segments onto DK text
 * 5. Build a Map<charIndex, ruleName> for the line's text
 */
export function getLineTajweedMap(
  pageNumber: number,
  lineIndex: number,
  indexedTajweedData: IndexedTajweedData,
): Map<number, string> | null {
  const lines = digitalKhattDataService.getPageLines(pageNumber);
  if (lineIndex >= lines.length) return null;

  const line = lines[lineIndex];
  if (line.line_type !== 'ayah') return null;

  const lineText = quranTextService.getLineText(pageNumber, lineIndex);
  if (!lineText) return null;

  const charToRule = new Map<number, string>();

  // Build word texts array and track character offsets per word
  let charOffset = 0;
  for (let wordId = line.first_word_id; wordId <= line.last_word_id; wordId++) {
    const wordInfo = digitalKhattDataService.getWordInfo(wordId);
    if (!wordInfo) {
      // Skip past this word's characters + space
      const wordText = digitalKhattDataService.getWordText(wordId);
      charOffset += wordText.length;
      if (wordId < line.last_word_id) charOffset += 1; // space
      continue;
    }

    const verseWords = indexedTajweedData[wordInfo.verseKey];
    if (!verseWords) {
      charOffset += wordInfo.text.length;
      if (wordId < line.last_word_id) charOffset += 1;
      continue;
    }

    // Find the matching tajweed word by position in verse
    const tajweedWord = verseWords.find(w => {
      const pos = parseInt(w.location.split(':')[2], 10);
      return pos === wordInfo.wordPositionInVerse;
    });

    // Get per-character rules: aligned QPC rules + tafkhim detection
    const wordRules = tajweedWord
      ? alignWordTajweed(wordInfo.text, tajweedWord.segments)
      : detectWordTafkhim(wordInfo.text);

    if (wordRules) {
      for (const [dkCharIdx, rule] of wordRules) {
        const lineCharIndex = charOffset + dkCharIdx;
        if (lineCharIndex < lineText.length) {
          charToRule.set(lineCharIndex, rule);
        }
      }
    }

    charOffset += wordInfo.text.length;
    if (wordId < line.last_word_id) charOffset += 1; // space between words
  }

  return charToRule.size > 0 ? charToRule : null;
}
