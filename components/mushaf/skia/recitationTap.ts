import type {DKLine} from '@/services/mushaf/DigitalKhattDataService';
import {digitalKhattDataService} from '@/services/mushaf/DigitalKhattDataService';
import {getLineWordSpans} from '@/services/mushaf/lineWordSpans';
import type {WordMark} from '@/services/recitation/wordMarks';
import {dkWordPosition} from './recitedWord';

/**
 * The word mark under a tapped character of a Digital Khatt line, or null.
 * @param charIndex - From the line paragraph's glyph position at the tap
 */
export function markAtChar(
  line: DKLine,
  charIndex: number,
  marks: readonly WordMark[],
): WordMark | null {
  if (marks.length === 0) return null;
  const span = getLineWordSpans(line, digitalKhattDataService).find(
    s => charIndex >= s.start && charIndex <= s.wordEnd,
  );
  if (!span) return null;
  const {verseKey, wordPositionInVerse} = span.info;
  for (const mark of marks) {
    if (`${mark.surah}:${mark.ayah}` !== verseKey) continue;
    const position = dkWordPosition(
      digitalKhattDataService.getVerseWords(verseKey),
      mark.word,
      mark.totalWords,
    );
    if (position === wordPositionInVerse) return mark;
  }
  return null;
}
