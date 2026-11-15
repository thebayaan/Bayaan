// @ai-generated
/**
 * The Quran text search engine: pure, given a source of postings (the
 * bundled index through QuranSearchDataService, or a map in tests and the
 * index build).
 *
 * 1. Look up every key of every token at once; the last token also matches
 *    as a prefix when it has 3 or more letters (feedback while typing, and
 *    pronoun suffixes: كتاب finds كتابه), unless it is a surah opening
 *    (typed as letters, ا ل م, or pasted, الٓمٓ), which matches whole
 *    words only.
 * 2. Score each word slot per token: exact 100 or prefix 60, plus 10 per
 *    tier (3 full spelling, 2 without proclitics, 1 without the article),
 *    minus 5 for a rasm-only spelling. A token typed with a hamza skips
 *    words without one; an opening skips words with one (الٓمٓ, not ألم).
 * 3. A phrase is the tokens on consecutive slots of one verse; its score is
 *    its weakest token's. It may also run on from an ayah of one word
 *    (QURAN_ONE_WORD_AYAHS: الم, حم, الرحمن, والعصر) into the start of
 *    the next ayah, which is the hit: الم ذلك الكتاب finds 2:2.
 * 4. Without any phrase, a query of 2 or more words falls back to the ayahs
 *    that hold every word somewhere ('allWords'), closest together first.
 * 5. Hits are ranked by score, then in mushaf order.
 */
import type {QuranQueryToken} from './quranText';
import {
  flagsOfCode,
  hasFlag,
  QURAN_FLAG,
  QURAN_FLAG_RANGE,
  QURAN_SLOT_STRIDE,
  QURAN_VERSE_COUNT,
  slotOfCode,
  verseIndexOf,
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
/** Above this many postings lists, a token is merged into a map to look up. */
const MAP_LOOKUP_LISTS = 8;

/**
 * The ayahs of the Hafs text that are one word: the surah openings that are
 * an ayah of their own (الٓمٓ 2:1, حمٓ 40:1, عٓسٓقٓ 42:2) and الطور,
 * الرحمن, مدهامتان, الحاقة, الفجر, الضحى, القارعة and العصر. A phrase
 * runs on from one into the next ayah: no other ayah boundary is known to
 * the index, which keeps no verse lengths. Checked against the Digital
 * Khatt words by services/search/__tests__/quranSearchDb.test.ts.
 */
export const QURAN_ONE_WORD_AYAHS: readonly string[] = [
  '2:1',
  '3:1',
  '7:1',
  '19:1',
  '20:1',
  '26:1',
  '28:1',
  '29:1',
  '30:1',
  '31:1',
  '32:1',
  '36:1',
  '40:1',
  '41:1',
  '42:1',
  '42:2',
  '43:1',
  '44:1',
  '45:1',
  '46:1',
  '52:1',
  '55:1',
  '55:64',
  '69:1',
  '89:1',
  '93:1',
  '101:1',
  '103:1',
];

const ONE_WORD_VERSES: ReadonlySet<number> = new Set(
  QURAN_ONE_WORD_AYAHS.map(key => verseIndexOf(key) as number),
);

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

/**
 * What a token asks of a word's hamza: true, words with one (typed with a
 * hamza); false, words without one (an opening); null, either.
 */
type HamzaRule = boolean | null;

function hamzaRule(token: QuranQueryToken): HamzaRule {
  if (token.needsHamza) return true;
  return token.opening ? false : null;
}

function allows(rule: HamzaRule, code: number): boolean {
  return (
    rule === null || hasFlag(flagsOfCode(code), QURAN_FLAG.hasHamza) === rule
  );
}

function addPostings(
  slots: Map<number, number>,
  codes: readonly number[] | undefined,
  exact: boolean,
  hamza: HamzaRule,
): void {
  if (!codes) return;
  for (const code of codes) {
    if (!allows(hamza, code)) continue;
    const slot = slotOfCode(code);
    const score = postingScore(code, exact);
    if ((slots.get(slot) ?? 0) < score) slots.set(slot, score);
  }
}

/** A token's postings lists, each ascending, with how they matched. */
interface TokenPostings {
  lists: {codes: readonly number[]; exact: boolean}[];
  hamza: HamzaRule;
}

function firstAtLeast(codes: readonly number[], value: number): number {
  let lo = 0;
  let hi = codes.length;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (codes[mid] < value) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** A token's best score at one slot, by binary search in its lists. */
function scoreAt(token: TokenPostings, slot: number): number {
  const from = slot * QURAN_FLAG_RANGE;
  let best = 0;
  for (const {codes, exact} of token.lists) {
    for (
      let i = firstAtLeast(codes, from);
      i < codes.length && codes[i] < from + QURAN_FLAG_RANGE;
      i++
    ) {
      const code = codes[i];
      if (!allows(token.hamza, code)) continue;
      best = Math.max(best, postingScore(code, exact));
    }
  }
  return best;
}

function slotsOf(token: TokenPostings): Map<number, number> {
  const slots = new Map<number, number>();
  for (const {codes, exact} of token.lists) {
    addPostings(slots, codes, exact, token.hamza);
  }
  return slots;
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
  return joinFromAnchor(
    tokenSlots.length,
    anchor,
    tokenSlots[anchor],
    (k, slot) => tokenSlots[k].get(slot) ?? 0,
  );
}

/**
 * The phrase join from one token's slots (the anchor, the rarest): every
 * other token is only looked up at the slot the phrase puts it on.
 */
function joinFromAnchor(
  length: number,
  anchor: number,
  anchorSlots: ReadonlyMap<number, number>,
  scoreOf: (k: number, slot: number) => number,
): QuranVerseHit[] {
  const verses = new Map<number, {score: number; starts: number[]}>();
  for (const [slot, anchorScore] of anchorSlots) {
    const start = slot - anchor;
    const verseIndex = Math.floor(start / QURAN_SLOT_STRIDE);
    const position = start % QURAN_SLOT_STRIDE;
    // The stride keeps a phrase inside one verse: a start before slot 1
    // could only reach the previous verse's unused high slots.
    if (position < 1) continue;
    let score = anchorScore;
    for (let k = 0; k < length && score > 0; k++) {
      if (k !== anchor) score = Math.min(score, scoreOf(k, start + k));
    }
    if (score <= 0) continue;
    const verse = verses.get(verseIndex);
    if (verse) {
      verse.score = Math.max(verse.score, score);
      verse.starts.push(position);
    } else {
      verses.set(verseIndex, {score, starts: [position]});
    }
  }
  return [...verses].map(([verseIndex, {score, starts}]) => ({
    verseIndex,
    verseKey: verseKeyAt(verseIndex),
    matches: starts.sort((a, b) => a - b).map(position => ({position, length})),
    score,
  }));
}

/** The surah of a verse index ('2:255' → 2). */
function surahOf(verseIndex: number): string {
  return verseKeyAt(verseIndex).split(':')[0];
}

/**
 * The phrases that run on from ayahs of one word: the first tokens on such
 * ayahs in a row (حم 42:1, then عسق 42:2), the rest from the first word of
 * the ayah after them, in the same surah. Each hit is that ayah, with its
 * words the phrase matched: الم ذلك الكتاب finds 2:2 (ذلك الكتاب).
 */
function joinRunOn(
  length: number,
  scoreOf: (k: number, slot: number) => number,
): QuranVerseHit[] {
  const hits: QuranVerseHit[] = [];
  for (const first of ONE_WORD_VERSES) {
    let score = Infinity;
    // Tokens 0 .. lead - 1 on the one-word ayahs first .. first + lead - 1.
    for (let lead = 1; lead < length; lead++) {
      const verse = first + lead - 1;
      if (!ONE_WORD_VERSES.has(verse)) break;
      score = Math.min(score, scoreOf(lead - 1, verse * QURAN_SLOT_STRIDE + 1));
      if (score <= 0) break;
      const next = verse + 1;
      if (next >= QURAN_VERSE_COUNT || surahOf(next) !== surahOf(first)) {
        break;
      }
      let total = score;
      for (let k = lead; k < length && total > 0; k++) {
        total = Math.min(
          total,
          scoreOf(k, next * QURAN_SLOT_STRIDE + 1 + k - lead),
        );
      }
      if (total > 0) {
        hits.push({
          verseIndex: next,
          verseKey: verseKeyAt(next),
          matches: [{position: 1, length: length - lead}],
          score: total,
        });
      }
    }
  }
  return hits;
}

/** Hits of one search, one per ayah: matches joined, the best score. */
function mergeHits(
  a: readonly QuranVerseHit[],
  b: readonly QuranVerseHit[],
): QuranVerseHit[] {
  const byVerse = new Map(a.map(hit => [hit.verseIndex, hit]));
  for (const hit of b) {
    const other = byVerse.get(hit.verseIndex);
    if (!other) {
      byVerse.set(hit.verseIndex, hit);
      continue;
    }
    const seen = new Set<string>();
    const matches = [...other.matches, ...hit.matches]
      .filter(m => {
        const id = `${m.position}+${m.length}`;
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      })
      .sort((x, y) => x.position - y.position || x.length - y.length);
    byVerse.set(hit.verseIndex, {
      ...other,
      matches,
      score: Math.max(other.score, hit.score),
    });
  }
  return [...byVerse.values()];
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
  // An opening (typed as letters, or pasted) is a whole word: no prefixes.
  const prefixKeys = last.opening
    ? []
    : last.keys.filter(key => key.length >= QURAN_PREFIX_MIN_LETTERS);
  const [exact, ...prefixes] = await Promise.all([
    source.exact(allKeys),
    ...prefixKeys.map(key => source.prefix(key, QURAN_PREFIX_FORM_LIMIT)),
  ]);

  const postings: TokenPostings[] = tokens.map((token, k) => {
    const lists: TokenPostings['lists'] = [];
    for (const key of token.keys) {
      const codes = exact.get(key);
      if (codes?.length) lists.push({codes, exact: true});
    }
    if (k === tokens.length - 1) {
      for (const forms of prefixes) {
        for (const codes of forms.values()) {
          if (codes.length) lists.push({codes, exact: false});
        }
      }
    }
    return {lists, hamza: hamzaRule(token)};
  });

  // Walk the rarest token's slots and look the others up only where the
  // phrase puts them; a token with many lists (a short prefix) is merged
  // into one map first.
  const sizes = postings.map(token =>
    token.lists.reduce((n, list) => n + list.codes.length, 0),
  );
  let anchor = 0;
  for (let k = 1; k < sizes.length; k++) {
    if (sizes[k] < sizes[anchor]) anchor = k;
  }
  const maps = postings.map((token, k) =>
    k === anchor || token.lists.length > MAP_LOOKUP_LISTS
      ? slotsOf(token)
      : null,
  );
  const scoreOf = (k: number, slot: number) => {
    const map = maps[k];
    if (!map) return scoreAt(postings[k], slot);
    return map.get(slot) ?? 0;
  };
  const phrase = mergeHits(
    joinFromAnchor(tokens.length, anchor, maps[anchor] ?? new Map(), scoreOf),
    tokens.length > 1 ? joinRunOn(tokens.length, scoreOf) : [],
  );
  if (phrase.length || tokens.length < 2) {
    return result('phrase', phrase.sort(byScoreThenMushaf));
  }
  const allWords = joinAllWords(
    postings.map((token, k) => maps[k] ?? slotsOf(token)),
  );
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
