import type {DKLine, DKWordInfo} from './DigitalKhattDataService';

/**
 * Single source of truth for how DigitalKhatt word slots become rendered text
 * and per-word character spans (Release 1 slot model).
 *
 * Every rewayah words DB keeps the Hafs word ids, verse keys and the shared
 * Hafs 604-page layout; only `words.text` differs. A slot's text is:
 *   - '' (blank): a Hafs word or verse-end marker this rewayah does not have.
 *     It renders nothing and contributes NO separator;
 *   - one token; or
 *   - several tokens separated by single U+0020 spaces (two rewayah words in
 *     one Hafs slot, or Hafs 37:130:3 'إِلْ يَاسِينَ'). The slot is still ONE
 *     word unit for layout, hit-testing and highlights;
 *   - optionally ending with an inline verse marker token ' ۝N' (a rewayah
 *     verse end that has no Hafs marker slot). The marker belongs to the slot
 *     span but is excluded from whole-word tints.
 *
 * DigitalKhattDataService.getLineText / getVerseText / getVerseWords build
 * their strings with the functions below, and every overlay (verse segments
 * and tap targets, tajweed, Allah-name, rewayah diff fg/bg, silah) derives its
 * character offsets from the same spans. Never count word ids, and never use
 * QuranTextService.analyzeText().wordInfos (it splits multi-token slots) as a
 * proxy for word ids.
 *
 * Offsets are UTF-16 code-unit indices, like String.prototype.charAt and
 * SkParagraph.getRectsForRange.
 */

const SEPARATOR = ' ';

// A verse-end marker token at the very end of a slot: ' ۝' + digits, or a slot
// that is only a marker (Hafs marker slots holding the rewayah's marker text).
const TRAILING_VERSE_MARKER = /(?:^| )\u06DD[\u0660-\u0669\u06F0-\u06F9]+$/;

/** A blank slot renders nothing and takes no separator. */
export function isBlankSlot(text: string | null | undefined): boolean {
  return !text;
}

/**
 * Length (UTF-16 units) of the whole-word part of a slot: the slot text minus
 * a trailing inline verse marker token and the space before it. 0 when the
 * slot is only a marker.
 */
export function wholeWordLength(text: string): number {
  const match = TRAILING_VERSE_MARKER.exec(text);
  return match ? match.index : text.length;
}

/** The whole-word part of a slot (trailing inline verse marker removed). */
export function wholeWordText(text: string): string {
  return text.slice(0, wholeWordLength(text));
}

export interface SlotSpan {
  /** The slot text exactly as rendered. */
  text: string;
  /** Inclusive start index in the joined string. */
  start: number;
  /** Inclusive end index of the whole slot (covers a trailing ' ۝N'). */
  end: number;
  /**
   * Inclusive end index of the whole-word part (excludes a trailing inline
   * verse marker). `start - 1` when the slot is only a marker.
   */
  wordEnd: number;
}

export interface SlotLayout<T> {
  /** The joined string: non-blank slot texts separated by single spaces. */
  text: string;
  /** One span per non-blank slot, in order. */
  spans: Array<SlotSpan & {item: T}>;
}

class SlotJoiner<T> {
  private readonly parts: string[] = [];
  private offset = 0;
  readonly spans: Array<SlotSpan & {item: T}> = [];

  add(item: T, text: string | null | undefined): void {
    if (!text) return; // blank slot: no span, no separator
    if (this.parts.length > 0) this.offset += SEPARATOR.length;
    const start = this.offset;
    this.spans.push({
      item,
      text,
      start,
      end: start + text.length - 1,
      wordEnd: start + wholeWordLength(text) - 1,
    });
    this.parts.push(text);
    this.offset += text.length;
  }

  layout(): SlotLayout<T> {
    return {text: this.parts.join(SEPARATOR), spans: this.spans};
  }
}

/**
 * Lays out the slots `firstWordId..lastWordId` of a mushaf line. `textOf`
 * returns a slot's stored text ('' / undefined for blank or unknown ids).
 */
export function layoutLineSlots(
  firstWordId: number,
  lastWordId: number,
  textOf: (wordId: number) => string | null | undefined,
): SlotLayout<number> {
  const joiner = new SlotJoiner<number>();
  const first = Number(firstWordId);
  const last = Number(lastWordId);
  if (Number.isFinite(first) && Number.isFinite(last)) {
    for (let wordId = first; wordId <= last; wordId++) {
      joiner.add(wordId, textOf(wordId));
    }
  }
  return joiner.layout();
}

/** Lays out a verse-level word list (e.g. getVerseWords) joined by spaces. */
export function layoutWords<T extends {text: string}>(
  words: readonly T[],
): SlotLayout<T> {
  const joiner = new SlotJoiner<T>();
  for (const word of words) joiner.add(word, word.text);
  return joiner.layout();
}

/** The rendered string for a word list: blank slots skipped, single spaces. */
export function joinSlotTexts(words: readonly {text: string}[]): string {
  const parts: string[] = [];
  for (const word of words) {
    if (word.text) parts.push(word.text);
  }
  return parts.join(SEPARATOR);
}

/**
 * Joins the whole-word parts of a word list (blank slots skipped, trailing
 * inline verse markers dropped). For word-range snippets such as
 * similar-verse phrases, which show words, never verse numbers.
 */
export function joinWholeWords(words: readonly {text: string}[]): string {
  const parts: string[] = [];
  for (const word of words) {
    const whole = wholeWordText(word.text);
    if (whole) parts.push(whole);
  }
  return parts.join(SEPARATOR);
}

const visibleWordsCache = new WeakMap<readonly object[], readonly object[]>();

/**
 * The word list without blank slots, memoized per input array so repeated
 * calls on the same (immutable) cache array return the same reference. When
 * nothing is blank the input array itself is returned.
 */
export function visibleWords<T extends {text: string}>(
  words: readonly T[],
): T[] {
  const cached = visibleWordsCache.get(words);
  if (cached) return cached as T[];
  const visible = words.some(w => !w.text)
    ? words.filter(w => !!w.text)
    : (words as T[]);
  visibleWordsCache.set(words, visible);
  return visible;
}

/** Space-separated tokens of a slot text with their absolute start index. */
export function spanTokens(
  text: string,
  start: number,
): Array<{token: string; start: number}> {
  const out: Array<{token: string; start: number}> = [];
  let index = 0;
  for (const token of text.split(SEPARATOR)) {
    if (token) out.push({token, start: start + index});
    index += token.length + SEPARATOR.length;
  }
  return out;
}

/** Minimal read API over the active words cache (DigitalKhattDataService). */
export interface WordSlotSource {
  getWordText(wordId: number): string;
  getWordInfo(wordId: number): DKWordInfo | undefined;
}

export interface LineWordSpan extends SlotSpan {
  wordId: number;
  info: DKWordInfo;
}

/**
 * Per-word spans of an ayah line, indexed into the exact string
 * DigitalKhattDataService.getLineText(line) renders. Surah-name and basmallah
 * lines have no word slots and return []. A slot whose id has no word info
 * still occupies its place in the string but yields no span.
 */
export function getLineWordSpans(
  line: DKLine | undefined,
  source: WordSlotSource,
): LineWordSpan[] {
  if (!line || line.line_type !== 'ayah') return [];
  const {spans} = layoutLineSlots(
    line.first_word_id,
    line.last_word_id,
    wordId => source.getWordText(wordId),
  );
  const out: LineWordSpan[] = [];
  for (const span of spans) {
    const info = source.getWordInfo(span.item);
    if (!info) continue;
    out.push({
      wordId: span.item,
      info,
      text: span.text,
      start: span.start,
      end: span.end,
      wordEnd: span.wordEnd,
    });
  }
  return out;
}
