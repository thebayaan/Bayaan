// @ai-generated
import {damerauLevenshtein, maxEditsFor} from './fuzzy';
import {
  ARTICLES,
  foldLongVowels, // @ai
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

// @ai-start
// One Arabic article, spelled the way it sounds before the next letter:
// "al nur" is "An-Nur", "al rum" is "Ar-Rum".
const DEFINITE_ARTICLES: ReadonlySet<string> = new Set([
  'al',
  'el',
  'an',
  'ar',
  'as',
  'ash',
  'at',
  'ad',
  'az',
  'ul',
]);
// @ai-end

// A sounded article glued to a Latin name: "Arrifai", "Assadan".
const GLUED_ARTICLE = /^a([tdrzsn])\1[a-z]{3,}$/;

// What reading a typed article as another spelling costs the whole entry:
// more than the featured boost, so "as s" lists As-Sayegh before the
// featured Saud Al-Shuraim, whose words would otherwise score the same.
const ARTICLE_SPELLING_COST = 2;

export interface SearchField<T> {
  get: (item: T) => string | readonly string[];
  weight: number;
  /**
   * Whether a typed article ("al") also matches another spelling of an
   * article in this field ("An-Nur"). Defaults to true. False where the
   * article-like words are not articles: rewayah names join reader and
   * teacher with "A'n" ("from"), keyed "an".
   */
  articleSpellings?: boolean;
}

export interface SearchIndexOptions<T> {
  fields: readonly SearchField<T>[];
  boost?: (item: T) => number;
  keyboardFallback?: boolean;
  // @ai-start
  /**
   * Words people put in front of a name ("sheikh", "qari", "الشيخ") that the
   * catalogue rarely carries. A query is also scored without them, slightly
   * lower, so a name that does carry the word still ranks first.
   */
  fillerWords?: ReadonlySet<string>;
  // @ai-end
}

export interface SearchHit<T> {
  item: T;
  score: number;
}

// @ai-start
export interface SearchOptions {
  /**
   * Last resort for a query that found nothing: let one word match nothing
   * ("mishary rashid alafasy" when the catalogue has no "rashid"). The other
   * words must match without typos and the score is halved.
   */
  allowOneMissingWord?: boolean;
}
// @ai-end

export interface SearchIndex<T> {
  search(
    query: string,
    limit?: number,
    searchOptions?: SearchOptions, // @ai
  ): SearchHit<T>[];
}

interface PreparedField {
  key: string;
  compact: string;
  tokens: string[];
  foldedTokens: string[]; // @ai
  tokenSkeletons: string[];
  skeletonSuffixes: string[];
  // Raw text from the same token boundary as skeletonSuffixes, used to
  // penalise skeleton matches by real spelling distance.
  rawSuffixes: string[];
  weight: number;
  // The words that follow an article ("nur" in "An-Nur"), for reading a
  // typed article as another spelling of it; null when there are none.
  afterArticle: PreparedField | null;
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

function prepareField(
  text: string,
  weight: number,
  articleSpellings: boolean,
): PreparedField {
  const key = toSearchKey(text);
  const baseTokens = tokenize(key);
  const content = baseTokens
    .filter(token => !ARTICLES.has(token))
    .map(stripLatinArticle);
  const skeleton = content.map(latinSkeleton);
  // Article-less Arabic variants are extra tokens, so "بق" prefix-matches
  // "البقره" the way "ba" matches "baqarah".
  const tokens = baseTokens.flatMap(token => {
    // @ai-start
    // A sounded article glued to a Latin name ("Arrifai", "Assadan") is
    // also split off, so "hani al rifai" and "hani rifai" find "Hani Arrifai".
    // The article is matched only as an article (afterArticle), not as a
    // word: a typed "ar" or "as" still lists Al-Arkani and As-Sayegh first.
    if (GLUED_ARTICLE.test(token)) return [token, token.slice(2)];
    // @ai-end
    const bare = stripArabicArticle(token);
    return bare === token ? [token] : [token, bare];
  });
  const afterArticle = articleSpellings
    ? baseTokens.flatMap((token, i) => {
        if (GLUED_ARTICLE.test(token)) return [token.slice(2)];
        const next = baseTokens[i + 1];
        return next && DEFINITE_ARTICLES.has(token) ? [next] : [];
      })
    : [];
  return {
    key,
    compact: baseTokens.join(''),
    tokens,
    foldedTokens: tokens.map(foldLongVowels), // @ai
    tokenSkeletons: tokens.map(token =>
      ARTICLES.has(token) ? '' : latinSkeleton(token),
    ),
    skeletonSuffixes: skeleton.map((_, i) => skeleton.slice(i).join('')),
    rawSuffixes: content.map((_, i) => content.slice(i).join('')),
    weight,
    afterArticle:
      afterArticle.length > 0
        ? prepareField(afterArticle.join(' '), weight, false)
        : null,
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
  allowTypos = true, // @ai
): number {
  const tokenSkeleton = latinSkeleton(token);
  const latinBare = stripLatinArticle(token);
  // Typo budget and comparison use the word without its article, so shared
  // "ال" / "al" prefixes neither inflate the budget nor pass the letter gate.
  const bare = stripArabicArticle(latinBare);
  const maxEdits = maxEditsFor(bare.length);
  // @ai-start
  // Only a typed doubled vowel ("noor", "feel") is folded, and then compared
  // with folded names a step below a literal match.
  const folded = foldLongVowels(token);
  const isFolded = folded !== token;
  // @ai-end
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
      // @ai-start
      if (isFolded) {
        const foldedField = field.foldedTokens[t];
        if (foldedField === folded) {
          tier = Math.max(tier, TIER.exact - 5);
        } else if (folded.length >= 3 && foldedField.startsWith(folded)) {
          tier = Math.max(tier, TIER.wordPrefix - 5);
        }
      }
      // @ai-end
      // @ai-start
      if (tier === 0 && allowTypos && maxEdits > 0) {
        // @ai-end
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

/**
 * Typed word `i` read as another spelling of an article in the entry: "al
 * nur" for "An-Nur", "al rum" for "Ar-Rum". The article belongs to the next
 * typed word, which must match a word that follows an article in the same
 * field: "at tariq" is not the "Al" of Al-Airawy plus his rewayah's "Tariq".
 * Never the word still being typed: "ad", "ar", "ash" are also how "Adel",
 * "Arkani" and "Ash-Shams" begin, and would otherwise match every "Al-" name
 * above the names that really start that way.
 */
function articleSpelling(
  fields: readonly PreparedField[],
  tokens: readonly string[],
  i: number,
  allowTypos: boolean,
): number {
  const last = tokens.length - 1;
  if (i >= last || !DEFINITE_ARTICLES.has(tokens[i])) return 0;
  let best = 0;
  for (const field of fields) {
    const after = field.afterArticle;
    if (
      after &&
      scoreToken([after], tokens[i + 1], i + 1 === last, allowTypos) > 0
    ) {
      best = Math.max(best, (TIER.exact - 5) * field.weight);
    }
  }
  return best;
}

type WordScorer = (token: string, isLast: boolean) => number;

/**
 * Scores each word once per entry: the pass without filler words ("sheikh",
 * "bin") repeats the words of the first pass.
 */
function wordScorer(
  fields: readonly PreparedField[],
  allowTypos: boolean,
): WordScorer {
  const scored = new Map<string, number>();
  return (token, isLast) => {
    // A space never occurs inside a word.
    const key = isLast ? `${token} ` : token;
    let score = scored.get(key);
    if (score === undefined) {
      score = scoreToken(fields, token, isLast, allowTypos);
      scored.set(key, score);
    }
    return score;
  };
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
        .map(text =>
          prepareField(text, field.weight, field.articleSpellings !== false),
        ),
    ),
  }));

  // @ai-start
  function scoreEntry(
    entry: PreparedItem<T>,
    query: PreparedQuery,
    scoreWord: WordScorer,
  ): number {
    let score = 0;
    for (const field of entry.fields) {
      score = Math.max(score, scoreWholeField(field, query) * field.weight);
    }
    // Every word must match, so the weakest word scores the entry (and the
    // rest need no scoring once one misses). A typed article read as another
    // spelling costs the whole entry a little, where the weakest word cannot
    // hide it.
    const last = query.tokens.length - 1;
    let plain = Number.POSITIVE_INFINITY;
    let spelled = Number.POSITIVE_INFINITY;
    for (let i = 0; i <= last && spelled > 0; i++) {
      const word = scoreWord(query.tokens[i], i === last);
      plain = Math.min(plain, word);
      spelled = Math.min(
        spelled,
        Math.max(word, articleSpelling(entry.fields, query.tokens, i, true)),
      );
    }
    return Math.max(score, plain, spelled - ARTICLE_SPELLING_COST);
  }

  function scoreWithOneMissing(
    entry: PreparedItem<T>,
    query: PreparedQuery,
    scoreWord: WordScorer,
  ): number {
    if (query.tokens.length < 2) return 0;
    const last = query.tokens.length - 1;
    const scores = query.tokens.map((token, i) =>
      Math.max(
        scoreWord(token, i === last),
        articleSpelling(entry.fields, query.tokens, i, false),
      ),
    );
    const matched = query.tokens.filter((_, i) => scores[i] > 0);
    if (matched.length !== query.tokens.length - 1) return 0;
    // "al x" must not list every reciter with an article.
    if (matched.join('').length < 3) return 0;
    // One real word must match closely: a loose consonant match alone
    // ("kursi" in "Alquraishi") is a guess, not a result. An article with a
    // doubled vowel is still an article: "aal" matches as "al".
    const anchored = query.tokens.some(
      (token, i) =>
        !ARTICLES.has(foldLongVowels(token)) && scores[i] >= TIER.skeleton - 2,
    );
    if (!anchored) return 0;
    return Math.min(...scores.filter(score => score > 0)) / 2;
  }

  function withoutFillers(query: PreparedQuery): PreparedQuery | null {
    const fillers = options.fillerWords;
    if (!fillers) return null;
    const kept = query.tokens.filter(token => !fillers.has(token));
    if (kept.length === 0 || kept.length === query.tokens.length) return null;
    // @ai-start
    // A bare article is no name: "al qari" scored as just "al" listed every
    // reciter carrying "Al" above Al-Qari'ah and Al-Qaria Yassen. So is one
    // with a doubled vowel: "aal" matches as "al".
    if (kept.every(token => ARTICLES.has(foldLongVowels(token)))) return null;
    // @ai-end
    return prepareQuery(kept.join(' '));
  }

  function run(
    query: PreparedQuery,
    limit: number,
    oneMissing = false,
  ): SearchHit<T>[] {
    if (!query.key) return [];
    const bare = withoutFillers(query);
    const scoreOf = oneMissing ? scoreWithOneMissing : scoreEntry;
    const hits: (SearchHit<T> & {index: number})[] = [];
    for (const entry of prepared) {
      const scoreWord = wordScorer(entry.fields, !oneMissing);
      let score = scoreOf(entry, query, scoreWord);
      if (bare) {
        // Two points under the full query: "sheikh sudais" finds Alsudaes,
        // and "Shaik Abu Bakr Al Shatri" still outranks a bare "Shatri".
        score = Math.max(score, scoreOf(entry, bare, scoreWord) - 2);
      }
      // @ai-end
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
      searchOptions?: SearchOptions, // @ai
    ): SearchHit<T>[] {
      // @ai-start
      if (searchOptions?.allowOneMissingWord) {
        return run(prepareQuery(query), limit, true);
      }
      // @ai-end
      const hits = run(prepareQuery(query), limit);
      if (hits.length > 0 || options.keyboardFallback === false) return hits;
      const swapped = swapKeyboardLayout(query);
      return swapped ? run(prepareQuery(swapped), limit) : hits;
    },
  };
}
