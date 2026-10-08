// @ai-generated
/**
 * Text of a similar-verses "shared phrase" snippet: the words a QUL phrase
 * covers in its source verse, read from the rewayah the screen shows (the
 * rewayah its verse actions sheet was opened for, which may differ from the
 * active mushaf one).
 *
 * QUL word positions are Hafs positions, and every rewayah words DB keeps the
 * Hafs slot positions (Release 1 slot model), so the phrase is the slots in
 * that position range.
 *  - Hafs: exactly the text this snippet showed before Release 1, the slot
 *    texts joined by single spaces. A range that reaches the verse-end
 *    marker slot keeps the marker (5 of the 814 bundled phrases do).
 *  - Other rewayat: blank slots are skipped, a multi-token slot stays whole,
 *    and inline rewayah verse markers are dropped (a rewayah marker inside a
 *    Hafs-numbered phrase would mix two numberings).
 */
import {
  digitalKhattDataService,
  type DKWordInfo,
} from '@/services/mushaf/DigitalKhattDataService';
import {joinWholeWords} from '@/services/mushaf/lineWordSpans';
import type {RewayahId} from '@/services/rewayah/RewayahIdentity';

/** The phrase text for words `wordFrom..wordTo` (Hafs positions) of `words`. */
export function joinPhraseWords(
  words: readonly DKWordInfo[],
  wordFrom: number,
  wordTo: number,
  rewayah: RewayahId,
): string {
  const inRange = words.filter(
    w => w.wordPositionInVerse >= wordFrom && w.wordPositionInVerse <= wordTo,
  );
  if (rewayah === 'hafs') return inRange.map(w => w.text).join(' ');
  return joinWholeWords(inRange);
}

/**
 * The phrase text of a QUL phrase in its source verse, in `rewayah`. The
 * caller makes sure that rewayah's words are loaded; until then it is ''.
 */
export function getSimilarPhraseText(
  sourceVerse: string,
  wordFrom: number,
  wordTo: number,
  rewayah: RewayahId,
): string {
  return joinPhraseWords(
    digitalKhattDataService.getVerseWords(sourceVerse, rewayah),
    wordFrom,
    wordTo,
    rewayah,
  );
}
