import type {DKLine} from '@/services/mushaf/DigitalKhattDataService';
import {digitalKhattDataService} from '@/services/mushaf/DigitalKhattDataService';
import {
  getLineWordSpans,
  type LineWordSpan,
} from '@/services/mushaf/lineWordSpans';
import type {WordMark} from '@/services/recitation/wordMarks';
import {dkWordPosition} from './recitedWord';

/** The mark of this kind on the word of a span, if any. */
function markOnSpan(
  span: LineWordSpan,
  marks: readonly WordMark[],
  added: boolean,
): WordMark | null {
  const {verseKey, wordPositionInVerse} = span.info;
  for (const mark of marks) {
    if (`${mark.surah}:${mark.ayah}` !== verseKey) continue;
    if ((mark.kind === 'added') !== added) continue;
    const position = dkWordPosition(
      digitalKhattDataService.getVerseWords(verseKey),
      mark.word,
      mark.totalWords,
    );
    if (position === wordPositionInVerse) return mark;
  }
  return null;
}

/**
 * The word mark under a tapped character of a Digital Khatt line, or null. An
 * added mark sits in the gap before its word, which is too narrow to hit: a tap
 * there, or anywhere on that word, finds it. Red letters come first.
 * @param charIndex - From the line paragraph's glyph position at the tap
 */
export function markAtChar(
  line: DKLine,
  charIndex: number,
  marks: readonly WordMark[],
): WordMark | null {
  if (marks.length === 0) return null;
  const spans = getLineWordSpans(line, digitalKhattDataService);
  const on = spans.find(s => charIndex >= s.start && charIndex <= s.wordEnd);
  if (on) {
    const onWord = markOnSpan(on, marks, false) ?? markOnSpan(on, marks, true);
    if (onWord) return onWord;
  }
  const after = spans.find(
    s => charIndex === s.start || charIndex === s.start - 1,
  );
  return after ? markOnSpan(after, marks, true) : null;
}
