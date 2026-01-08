import bloomData from '@/data/surah_bloom_filters.json';
import exactIndex from '@/data/surah_variations_index.json';

// Simple Base64 decoder to avoid 'buffer' dependency in RN
const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const lookup = new Uint8Array(256);
for (let i = 0; i < chars.length; i++) {
  lookup[chars.charCodeAt(i)] = i;
}

function decodeBase64(base64: string): Uint8Array {
  const len = base64.length;
  let bufferLength = base64.length * 0.75;
  if (base64[base64.length - 1] === '=') {
    bufferLength--;
    if (base64[base64.length - 2] === '=') {
      bufferLength--;
    }
  }

  const array = new Uint8Array(bufferLength);
  let p = 0;
  let encoded1, encoded2, encoded3, encoded4;

  for (let i = 0; i < len; i += 4) {
    encoded1 = lookup[base64.charCodeAt(i)];
    encoded2 = lookup[base64.charCodeAt(i + 1)];
    encoded3 = lookup[base64.charCodeAt(i + 2)];
    encoded4 = lookup[base64.charCodeAt(i + 3)];

    array[p++] = (encoded1 << 2) | (encoded2 >> 4);
    if (encoded3 !== 64) {
      array[p++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
    }
    if (encoded4 !== 64) {
      array[p++] = ((encoded3 & 3) << 6) | encoded4;
    }
  }

  return array;
}

type BloomFilterRecord = {
  id: number;
  canonical?: string;
  arabic_canonical?: string;
  m: number;
  k: number;
  bitset: string;
  count: number;
};

type WildcardConfig = {
  prefix_patterns?: string[];
  suffix_patterns?: string[];
  noise_patterns?: string[];
  transliteration_rules?: string[];
  typo_rules?: string[];
};

type Wildcards = {
  latin?: WildcardConfig;
  arabic?: WildcardConfig;
};

const SEED1 = bloomData.hashing.seed1;
const SEED2 = bloomData.hashing.seed2;

const NON_ALNUM_REGEX = /[^0-9a-z\u0600-\u06FF]+/gi;

const filters = (bloomData.filters as BloomFilterRecord[]).map(filter => ({
  ...filter,
  bits: decodeBase64(filter.bitset),
}));

const wildcards: Wildcards = bloomData.wildcards ?? {};

const noiseRegexes = [
  ...(wildcards.latin?.noise_patterns ?? []),
  ...(wildcards.arabic?.noise_patterns ?? []),
].map(pattern => new RegExp(pattern, 'i'));

const latinPrefix = wildcards.latin?.prefix_patterns ?? [];
const latinSuffix = wildcards.latin?.suffix_patterns ?? [];
const arabicPrefix = wildcards.arabic?.prefix_patterns ?? [];
const arabicSuffix = wildcards.arabic?.suffix_patterns ?? [];

const transliterationPairs = parsePairs(wildcards.latin?.transliteration_rules);
const arabicPairs = parsePairs(wildcards.arabic?.typo_rules);
const optionalSuffixes = extractOptionalSuffixes([
  ...(wildcards.latin?.transliteration_rules ?? []),
  ...(wildcards.arabic?.typo_rules ?? []),
]);
const dropTokens = extractDrops([
  ...(wildcards.latin?.transliteration_rules ?? []),
  ...(wildcards.arabic?.typo_rules ?? []),
]);

function parsePairs(rules?: string[]): Array<[string, string]> {
  if (!rules) return [];
  return rules
    .map(rule => rule.split('<->'))
    .filter(parts => parts.length === 2)
    .map(parts => [parts[0].trim(), parts[1].trim()] as [string, string])
    .filter(([a, b]) => a && b);
}

function extractOptionalSuffixes(rules: string[]): string[] {
  return rules
    .filter(rule => rule.toLowerCase().startsWith('optional '))
    .map(rule => rule.replace(/^optional\s+/i, '').trim())
    .filter(Boolean);
}

function extractDrops(rules: string[]): string[] {
  return rules
    .filter(rule => rule.toLowerCase().startsWith('drop '))
    .map(rule => rule.replace(/^drop\s+/i, '').trim())
    .filter(Boolean);
}

// Simple string replacement for drops instead of regex
function removeToken(text: string, token: string): string {
  // Use split/join to remove all occurrences without regex
  return text.split(token).join('');
}

export function normalizeName(value: string): string {
  const lower = value.trim().toLowerCase();
  // Remove extension (simple last index check)
  const lastDot = lower.lastIndexOf('.');
  const withoutExt = lastDot !== -1 && lastDot > lower.lastIndexOf('/') ? lower.substring(0, lastDot) : lower;
  
  // Replace non-alnum with hyphen using character check
  // Effectively [^0-9a-z\u0600-\u06FF] -> '-'
  // Kept as regex for efficiency and Unicode support across platforms.
  const hyphenated = withoutExt.replace(NON_ALNUM_REGEX, '-');
  return hyphenated.replace(/-{2,}/g, '-').replace(/^-+|-+$/g, '');
}

function fnv1a32(value: string, seed: number): number {
  let hash = 0x811c9dc5 ^ seed;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

function mightContain(filter: {m: number; k: number; bits: Uint8Array}, value: string) {
  const h1 = fnv1a32(value, SEED1);
  const h2 = fnv1a32(value, SEED2);

  for (let i = 0; i < filter.k; i++) {
    const idx = (h1 + i * h2) % filter.m;
    const byte = filter.bits[idx >> 3];
    const mask = 1 << (idx & 7);
    if ((byte & mask) === 0) {
      return false;
    }
  }

  return true;
}

function stripNoise(value: string): string {
  let current = value;
  noiseRegexes.forEach(rx => {
    current = current.replace(rx, '');
  });
  return normalizeName(current);
}

function applyPrefixSuffix(value: string, prefixes: string[], suffixes: string[]): Set<string> {
  const result = new Set<string>();

  prefixes.forEach(pattern => {
    const token = pattern.replace('*', '').trim();
    if (!token) return;
    if (value.startsWith(token)) {
      result.add(normalizeName(value.slice(token.length)));
    }
  });

  suffixes.forEach(pattern => {
    const token = pattern.replace('*', '').trim();
    if (!token) return;
    if (value.endsWith(token)) {
      result.add(normalizeName(value.slice(0, value.length - token.length)));
    }
  });

  return result;
}

function applyPairs(values: Set<string>, pairs: Array<[string, string]>): Set<string> {
  const next = new Set(values);
  pairs.forEach(([a, b]) => {
    values.forEach(value => {
      if (value.includes(a)) next.add(normalizeName(value.replace(a, b)));
      if (value.includes(b)) next.add(normalizeName(value.replace(b, a)));
    });
  });
  return next;
}

function applyOptionals(values: Set<string>, suffixes: string[], drops: string[]): Set<string> {
  const next = new Set(values);
  suffixes.forEach(suffix => {
    values.forEach(value => {
      if (value.endsWith(suffix)) {
        next.add(normalizeName(value.slice(0, value.length - suffix.length)));
      }
    });
  });

  drops.forEach(token => {
    values.forEach(value => {
      // Use simple replace logic
      const replaced = removeToken(value, token);
      if (replaced !== value) {
        next.add(normalizeName(replaced));
      }
    });
  });

  return next;
}

function generateCandidates(rawName: string): string[] {
  const base = normalizeName(rawName);
  const candidates = new Set<string>();
  if (base) candidates.add(base);

  const noiseStripped = stripNoise(base);
  if (noiseStripped) candidates.add(noiseStripped);

  const segments = base.split('-').filter(Boolean);
  segments.forEach(seg => {
    if (seg.length > 2) candidates.add(seg);
  });

  [
    applyPrefixSuffix(base, latinPrefix, latinSuffix),
    applyPrefixSuffix(base, arabicPrefix, arabicSuffix),
  ].forEach(set => set.forEach(value => value && candidates.add(value)));

  let expanded = applyPairs(candidates, transliterationPairs);
  expanded = applyPairs(expanded, arabicPairs);
  expanded = applyOptionals(expanded, optionalSuffixes, dropTokens);

  return Array.from(expanded).filter(Boolean);
}

// Load the exact match map (normalized variation -> surahId)
const exactMap: Record<string, number> = exactIndex;

export function matchSurahFromFileName(fileName: string): number | null {
  const candidates = generateCandidates(fileName);
  if (candidates.length === 0) return null;

  // We want to find the BEST match.
  // Workflow:
  // 1. Generate all possible normalized candidates from filename
  // 2. Check Bloom filters for potential matches (fast rejection)
  // 3. Verify Bloom positives against Exact Map (guarantees 0 false positives)
  // 4. Prefer longer/more specific matches

  let bestMatchId: number | null = null;
  let bestMatchLen = 0;

  for (const candidate of candidates) {
    // We iterate filters to find which Surah claims this string.
    // Double verification pattern: Bloom -> Exact Map.

    for (const filter of filters) {
      if (mightContain(filter, candidate)) {
        // Bloom positive: Check exact map to confirm.
        const exactId = exactMap[candidate];
        
        if (exactId === filter.id) {
          // Confirmed match.
          if (candidate.length > bestMatchLen) {
            bestMatchLen = candidate.length;
            bestMatchId = exactId;
          }
        }
      }
    }
  }

  return bestMatchId;
}

export function matchSurahFromText(text: string): SurahMatchResult {
  const id = matchSurahFromFileName(text);
  return {
    surahId: id,
    fromBloom: Boolean(id),
    candidates: id ? [id] : [],
  };
}

export type SurahMatchResult = {
  surahId: number | null;
  fromBloom: boolean;
  candidates: number[];
};

