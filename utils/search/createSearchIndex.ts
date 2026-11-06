// @ai-generated
import {damerauLevenshtein, maxEditsFor} from './fuzzy';
import {
  ARTICLES,
  latinSkeleton,
  stripArabicArticle,
  stripLatinArticle,
  toSearchKey,
  tokenize,
} from './normalize';
import {swapKeyboardLayout} from './keyboardLayout'; // @ai

export const TIER = {
  exact: 100,
  prefix: 90,
  wordPrefix: 80,
  substring: 60,
  compact: 55,
  skeleton: 45,
  fuzzy: 30,
} as const;

export const MAX_QUERY_LENGTH = 100;

export interface SearchField<T> {
  get: (item: T) => string | readonly string[];
  weight: number;
}

export interface SearchIndexOptions<T> {
  fields: readonly SearchField<T>[];
  boost?: (item: T) => number;
  keyboardFallback?: boolean;
}

export interface SearchHit<T> {
  item: T;
  score: number;
}

export interface SearchIndex<T> {
  search(query: string, limit?: number): SearchHit<T>[];
}

interface PreparedField {
  key: string;
  compact: string;
  tokens: string[];
  tokenSkeletons: string[];
  skeletonSuffixes: string[];
  // Raw text from the same token boundary as skeletonSuffixes, used to
  // penalise skeleton matches by real spelling distance.
  rawSuffixes: string[];
  weight: number;
}

interface PreparedItem<T> {
  item: T;
  index: number;
  fields: PreparedField[];
  boost: number;
}

interface PreparedQuery {
  key: string;
  tokens: string[];
  compact: string;
  skeleton: string;
  // Content tokens without articles, joined: what skeleton hits are
  // spell-checked against.
  raw: string;
}

function prepareField(text: string, weight: number): PreparedField {
  const key = toSearchKey(text);
  const baseTokens = tokenize(key);
  const content = baseTokens
    .filter(token => !ARTICLES.has(token))
    .map(stripLatinArticle);
  const skeleton = content.map(latinSkeleton);
  // Article-less Arabic variants are extra tokens, so "بق" prefix-matches
  // "البقره" the way "ba" matches "baqarah".
  const tokens = baseTokens.flatMap(token => {
    const bare = stripArabicArticle(token);
    return bare === token ? [token] : [token, bare];
  });
  return {
    key,
    compact: baseTokens.join(''),
    tokens,
    tokenSkeletons: tokens.map(token =>
      ARTICLES.has(token) ? '' : latinSkeleton(token),
    ),
    skeletonSuffixes: skeleton.map((_, i) => skeleton.slice(i).join('')),
    rawSuffixes: content.map((_, i) => content.slice(i).join('')),
    weight,
  };
}

function prepareQuery(query: string): PreparedQuery {
  const key = toSearchKey(query.slice(0, MAX_QUERY_LENGTH));
  const tokens = tokenize(key);
  const content = tokens
    .filter(token => !ARTICLES.has(token))
    .map(stripLatinArticle);
  return {
    key,
    tokens,
    compact: tokens.join(''),
    skeleton: content.map(latinSkeleton).join(''),
    raw: content.join(''),
  };
}

/** Edit distance from `query` to the closest-length prefix of `text`. */
function prefixDistance(query: string, text: string): number {
  let best = Number.POSITIVE_INFINITY;
  for (let length = query.length - 1; length <= query.length + 2; length++) {
    if (length < 1 || length > text.length) continue;
    best = Math.min(best, damerauLevenshtein(query, text.slice(0, length), 5));
  }
  return Number.isFinite(best) ? best : damerauLevenshtein(query, text, 5);
}

/**
 * Skeleton hits are transliteration variants only when the real spelling is
 * also close; a shared consonant pattern alone ("mary" / "mursalat") is noise.
 */
function skeletonTier(distance: number, maxDistance: number): number {
  if (distance > maxDistance) return 0;
  return TIER.skeleton - Math.min(10, 2 * distance);
}

function scoreWholeField(field: PreparedField, query: PreparedQuery): number {
  if (!field.key) return 0;
  if (field.key === query.key) return TIER.exact;
  if (field.key.startsWith(query.key)) return TIER.prefix;
  if (query.compact.length < 3) return 0;
  if (field.key.includes(query.key)) return TIER.substring;
  if (field.compact.includes(query.compact)) return TIER.compact;
  if (query.skeleton.length < 3) return 0;
  let best = 0;
  field.skeletonSuffixes.forEach((suffix, i) => {
    if (!suffix.startsWith(query.skeleton)) return;
    const distance = prefixDistance(query.raw, field.rawSuffixes[i]);
    // Whole-field hits can span words ("saud shuraim" for "sudais"), so they
    // get a tighter spelling budget than single-word hits.
    best = Math.max(best, skeletonTier(distance, query.raw.length / 3));
  });
  return best;
}

function scoreToken(
  fields: readonly PreparedField[],
  token: string,
  isLast: boolean,
): number {
  const tokenSkeleton = latinSkeleton(token);
  const latinBare = stripLatinArticle(token);
  // Typo budget and comparison use the word without its article, so shared
  // "ال" / "al" prefixes neither inflate the budget nor pass the letter gate.
  const bare = stripArabicArticle(latinBare);
  const maxEdits = maxEditsFor(bare.length);
  let best = 0;
  for (const field of fields) {
    for (let t = 0; t < field.tokens.length; t++) {
      const fieldToken = field.tokens[t];
      let tier = 0;
      if (fieldToken === token) {
        tier = TIER.exact;
      } else if (fieldToken.startsWith(token)) {
        tier = TIER.wordPrefix;
      } else if (
        token.length >= 3 &&
        tokenSkeleton.length >= 3 &&
        field.tokenSkeletons[t].startsWith(tokenSkeleton)
      ) {
        const distance = prefixDistance(
          latinBare,
          stripLatinArticle(fieldToken),
        );
        tier = skeletonTier(distance, latinBare.length / 2);
      }
      if (tier === 0 && maxEdits > 0) {
        const fieldBare = stripArabicArticle(stripLatinArticle(fieldToken));
        // Typos rarely hit both leading letters; this skips most DL work.
        if (bare[0] === fieldBare[0] || bare[1] === fieldBare[1]) {
          const target =
            isLast && fieldBare.length > bare.length
              ? fieldBare.slice(0, bare.length)
              : fieldBare;
          const distance = damerauLevenshtein(bare, target, maxEdits);
          if (distance <= maxEdits) tier = TIER.fuzzy - 5 * distance;
        }
      }
      best = Math.max(best, tier * field.weight);
    }
  }
  return best;
}

function toTexts(value: string | readonly string[]): readonly string[] {
  return typeof value === 'string' ? [value] : value;
}

export function createSearchIndex<T>(
  items: readonly T[],
  options: SearchIndexOptions<T>,
): SearchIndex<T> {
  const prepared: PreparedItem<T>[] = items.map((item, index) => ({
    item,
    index,
    boost: options.boost?.(item) ?? 0,
    fields: options.fields.flatMap(field =>
      toTexts(field.get(item))
        .filter(text => text.length > 0)
        .map(text => prepareField(text, field.weight)),
    ),
  }));

  function run(query: PreparedQuery, limit: number): SearchHit<T>[] {
    if (!query.key) return [];
    const hits: (SearchHit<T> & {index: number})[] = [];
    for (const entry of prepared) {
      let score = 0;
      for (const field of entry.fields) {
        score = Math.max(score, scoreWholeField(field, query) * field.weight);
      }
      const tokenScores = query.tokens.map((token, i) =>
        scoreToken(entry.fields, token, i === query.tokens.length - 1),
      );
      score = Math.max(score, Math.min(...tokenScores));
      if (score > 0) {
        hits.push({
          item: entry.item,
          score: score + entry.boost,
          index: entry.index,
        });
      }
    }
    hits.sort((a, b) => b.score - a.score || a.index - b.index);
    return hits.slice(0, limit).map(({item, score}) => ({item, score}));
  }

  return {
    search(
      query: string,
      limit: number = Number.POSITIVE_INFINITY,
    ): SearchHit<T>[] {
      const hits = run(prepareQuery(query), limit);
      if (hits.length > 0 || options.keyboardFallback === false) return hits;
      const swapped = swapKeyboardLayout(query);
      return swapped ? run(prepareQuery(swapped), limit) : hits;
    },
  };
}
