// @ai-generated
/**
 * The Quran text search engine: pure, given a source of postings (the
 * bundled index through QuranSearchDataService, or a map in tests and the
 * index build).
 *
 * 1. Look up every key of every token at once; the last token also matches
 *    as a prefix when it has 3 or more letters (feedback while typing, and
 *    pronoun suffixes: كتاب finds كتابه).
 * 2. Score each word slot per token: exact 100 or prefix 60, plus 10 per
 *    tier (3 full spelling, 2 without proclitics, 1 without the article),
 *    minus 5 for a rasm-only spelling. A token typed with a hamza skips
 *    words without one.
 * 3. A phrase is the tokens on consecutive slots of one verse; its score is
 *    its weakest token's.
 * 4. Without any phrase, a query of 2 or more words falls back to the ayahs
 *    that hold every word somewhere ('allWords'), closest together first.
 * 5. Hits are ranked by score, then in mushaf order.
 */
import type {QuranQueryToken} from './quranText';
import {
  flagsOfCode,
  hasFlag,
  QURAN_FLAG,
  QURAN_SLOT_STRIDE,
  slotOfCode,
  verseKeyAt,
} from './quranIndexFormat';

/** Where the engine reads postings (codes, ascending) by form. */
export interface QuranPostingSource {
  /** The postings of each of these forms that exists. */
  exact(
    forms: readonly string[],
  ): Promise<ReadonlyMap<string, readonly number[]>>;
  /** The postings of up to `limit` forms that start with `prefix` (not it). */
  prefix(
    prefix: string,
    limit: number,
  ): Promise<ReadonlyMap<string, readonly number[]>>;
}

/** A matched run of words: DK slots position .. position + length - 1. */
export interface QuranMatch {
  position: number;
  length: number;
}

export interface QuranVerseHit {
  verseIndex: number;
  /** Hafs verse key. */
  verseKey: string;
  /** In slot order. */
  matches: readonly QuranMatch[];
  score: number;
}

export interface QuranTextResult {
  kind: 'phrase' | 'allWords';
  hits: readonly QuranVerseHit[];
  ayahCount: number;
  occurrenceCount: number;
}

export const QURAN_PREFIX_MIN_LETTERS = 3;
export const QURAN_PREFIX_FORM_LIMIT = 4000;
export const QURAN_MAX_TOKENS = 24;

const EXACT_SCORE = 100;
const PREFIX_SCORE = 60;
const TIER_SCORE = 10;
const RASM_PENALTY = 5;

/** The score of one posting code matched exactly or as a prefix. */
export function postingScore(code: number, exact: boolean): number {
  const flags = flagsOfCode(code);
  return (
    (exact ? EXACT_SCORE : PREFIX_SCORE) +
    (flags % 4) * TIER_SCORE -
    (hasFlag(flags, QURAN_FLAG.rasmOnly) ? RASM_PENALTY : 0)
  );
}

function addPostings(
  slots: Map<number, number>,
  codes: readonly number[] | undefined,
  exact: boolean,
  needsHamza: boolean,
): void {
  if (!codes) return;
  for (const code of codes) {
    if (needsHamza && !hasFlag(flagsOfCode(code), QURAN_FLAG.hasHamza)) {
      continue;
    }
    const slot = slotOfCode(code);
    const score = postingScore(code, exact);
    if ((slots.get(slot) ?? 0) < score) slots.set(slot, score);
  }
}

/**
 * Consecutive runs of the tokens inside one verse, grouped by verse:
 * tokenSlots[k] maps a slot to token k's score there.
 */
export function joinPhrase(
  tokenSlots: readonly ReadonlyMap<number, number>[],
): QuranVerseHit[] {
  if (!tokenSlots.length) return [];
  let anchor = 0;
  for (let k = 1; k < tokenSlots.length; k++) {
    if (tokenSlots[k].size < tokenSlots[anchor].size) anchor = k;
  }
  const verses = new Map<number, {score: number; starts: number[]}>();
  for (const [slot, anchorScore] of tokenSlots[anchor]) {
    const start = slot - anchor;
    let score = anchorScore;
    for (let k = 0; k < tokenSlots.length && score > 0; k++) {
      if (k === anchor) continue;
      score = Math.min(score, tokenSlots[k].get(start + k) ?? 0);
    }
    if (score <= 0) continue;
    const verseIndex = Math.floor(start / QURAN_SLOT_STRIDE);
    const position = start % QURAN_SLOT_STRIDE;
    // The stride keeps a phrase inside one verse: a start before slot 1
    // could only reach the previous verse's unused high slots.
    if (position < 1) continue;
    const verse = verses.get(verseIndex);
    if (verse) {
      verse.score = Math.max(verse.score, score);
      verse.starts.push(position);
    } else {
      verses.set(verseIndex, {score, starts: [position]});
    }
  }
  const length = tokenSlots.length;
  return [...verses].map(([verseIndex, {score, starts}]) => ({
    verseIndex,
    verseKey: verseKeyAt(verseIndex),
    matches: starts.sort((a, b) => a - b).map(position => ({position, length})),
    score,
  }));
}

/**
 * The ayahs that hold every token somewhere, each with its smallest window
 * covering one slot of every token (`span`, in slots).
 */
function joinAllWords(
  tokenSlots: readonly ReadonlyMap<number, number>[],
): (QuranVerseHit & {span: number})[] {
  // verse -> per token: slot positions with scores
  const byVerse = new Map<number, Map<number, number>[]>();
  tokenSlots.forEach((slots, k) => {
    for (const [slot, score] of slots) {
      const verseIndex = Math.floor(slot / QURAN_SLOT_STRIDE);
      if (k > 0 && !byVerse.has(verseIndex)) continue;
      let perToken = byVerse.get(verseIndex);
      if (!perToken) {
        perToken = tokenSlots.map(() => new Map<number, number>());
        byVerse.set(verseIndex, perToken);
      }
      perToken[k].set(slot % QURAN_SLOT_STRIDE, score);
    }
  });
  const hits: (QuranVerseHit & {span: number})[] = [];
  for (const [verseIndex, perToken] of byVerse) {
    if (perToken.some(positions => positions.size === 0)) continue;
    const score = Math.min(
      ...perToken.map(positions => Math.max(...positions.values())),
    );
    const words = new Set<number>();
    for (const positions of perToken) {
      for (const position of positions.keys()) words.add(position);
    }
    hits.push({
      verseIndex,
      verseKey: verseKeyAt(verseIndex),
      matches: [...words]
        .sort((a, b) => a - b)
        .map(position => ({position, length: 1})),
      score,
      span: smallestWindow(perToken),
    });
  }
  return hits;
}

/** The fewest slots that hold one position of every token. */
function smallestWindow(perToken: readonly Map<number, number>[]): number {
  const events: [number, number][] = [];
  perToken.forEach((positions, k) => {
    for (const position of positions.keys()) events.push([position, k]);
  });
  events.sort((a, b) => a[0] - b[0]);
  const count = new Array<number>(perToken.length).fill(0);
  let covered = 0;
  let best = Infinity;
  let left = 0;
  for (const [position, k] of events) {
    if (count[k]++ === 0) covered++;
    while (covered === perToken.length) {
      const [leftPosition, leftToken] = events[left];
      best = Math.min(best, position - leftPosition + 1);
      if (--count[leftToken] === 0) covered--;
      left++;
    }
  }
  return best;
}

function byScoreThenMushaf(a: QuranVerseHit, b: QuranVerseHit): number {
  return b.score - a.score || a.verseIndex - b.verseIndex;
}

function result(
  kind: QuranTextResult['kind'],
  hits: QuranVerseHit[],
): QuranTextResult {
  let occurrenceCount = 0;
  for (const hit of hits) occurrenceCount += hit.matches.length;
  return {kind, hits, ayahCount: hits.length, occurrenceCount};
}

/** Searches the Quran text for the tokens of a parsed query. */
export async function searchQuranText(
  queryTokens: readonly QuranQueryToken[],
  source: QuranPostingSource,
): Promise<QuranTextResult> {
  const tokens = queryTokens.slice(0, QURAN_MAX_TOKENS);
  if (!tokens.length) return result('phrase', []);
  const allKeys = [...new Set(tokens.flatMap(token => token.keys))];
  const last = tokens[tokens.length - 1];
  const prefixKeys = last.keys.filter(
    key => key.length >= QURAN_PREFIX_MIN_LETTERS,
  );
  const [exact, ...prefixes] = await Promise.all([
    source.exact(allKeys),
    ...prefixKeys.map(key => source.prefix(key, QURAN_PREFIX_FORM_LIMIT)),
  ]);

  const tokenSlots = tokens.map((token, k) => {
    const slots = new Map<number, number>();
    for (const key of token.keys) {
      addPostings(slots, exact.get(key), true, token.needsHamza);
    }
    if (k === tokens.length - 1) {
      for (const forms of prefixes) {
        for (const codes of forms.values()) {
          addPostings(slots, codes, false, token.needsHamza);
        }
      }
    }
    return slots;
  });

  const phrase = joinPhrase(tokenSlots);
  if (phrase.length || tokens.length < 2) {
    return result('phrase', phrase.sort(byScoreThenMushaf));
  }
  const allWords = joinAllWords(tokenSlots);
  allWords.sort(
    (a, b) =>
      a.span - b.span || b.score - a.score || a.verseIndex - b.verseIndex,
  );
  return result(
    'allWords',
    allWords.map(hit => ({
      verseIndex: hit.verseIndex,
      verseKey: hit.verseKey,
      matches: hit.matches,
      score: hit.score,
    })),
  );
}

/** Every matched DK slot of a hit, ascending. */
export function matchedPositions(hit: QuranVerseHit): number[] {
  const positions = new Set<number>();
  for (const match of hit.matches) {
    for (let i = 0; i < match.length; i++) positions.add(match.position + i);
  }
  return [...positions].sort((a, b) => a - b);
}
