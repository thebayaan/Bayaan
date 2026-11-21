// @ai-generated
/**
 * The part of a verse a search result shows: the whole verse up to 20
 * words, otherwise a window of 20 starting 5 words before the first match,
 * with the matched words' character ranges for SkiaVerseText's tint.
 */
import {layoutWords} from '@/services/mushaf/lineWordSpans';

export const VERSE_SNIPPET_MAX_WORDS = 20;
/** Words kept before the first match when the verse is cut. */
const LEAD_WORDS = 5;

export interface VerseSnippet<
  T extends {text: string; wordPositionInVerse: number},
> {
  words: readonly T[];
  /** Words of the verse were left out before / after the snippet. */
  cutStart: boolean;
  cutEnd: boolean;
  /** Inclusive char ranges in layoutWords(words).text, one per matched word. */
  highlights: readonly {start: number; end: number}[];
}

/**
 * The snippet of `words` (a verse's rendered words, as useRewayahWords gives
 * them) around the matched slots `positions`.
 */
export function verseSnippet<
  T extends {text: string; wordPositionInVerse: number},
>(
  words: readonly T[],
  positions: readonly number[],
  maxWords = VERSE_SNIPPET_MAX_WORDS,
): VerseSnippet<T> {
  const matched = new Set(positions);
  let from = 0;
  let to = words.length;
  if (words.length > maxWords) {
    const first = words.findIndex(word =>
      matched.has(word.wordPositionInVerse),
    );
    from = Math.max(0, (first < 0 ? 0 : first) - LEAD_WORDS);
    to = Math.min(words.length, from + maxWords);
    from = Math.max(0, to - maxWords);
  }
  const shown = words.slice(from, to);
  const highlights: {start: number; end: number}[] = [];
  for (const span of layoutWords(shown).spans) {
    // wordEnd leaves out an inline verse marker; a marker-only slot has
    // wordEnd < start and is never a match.
    if (
      matched.has(span.item.wordPositionInVerse) &&
      span.wordEnd >= span.start
    ) {
      highlights.push({start: span.start, end: span.wordEnd});
    }
  }
  return {
    words: shown,
    cutStart: from > 0,
    cutEnd: to < words.length,
    highlights,
  };
}
