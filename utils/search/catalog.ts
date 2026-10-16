// @ai-generated
import {SURAHS, type Surah} from '@/data/surahData';
import {RECITERS, getRecitersVersion, type Reciter} from '@/data/reciterData';
import {SURAH_ALIASES} from '@/data/searchAliases';
import {FEATURED_RECITER_NAMES} from '@/data/featuredReciters';
import {getReciterDisplayName} from '@/i18n/format';
import {getDisplayLabelFromName} from '@/services/rewayah/RewayahIdentity';
import {
  createSearchIndex,
  TIER,
  type SearchHit,
  type SearchIndex,
} from './createSearchIndex';
import {toSearchKey, tokenize} from './normalize';

// "surah 36", "sura yasin", "سورة يس": the prefix word carries no meaning.
const SURAH_PREFIX = /^(surah|surat|sura|soorah|سوره|سورت)\s+/;
const FEATURED = new Set(FEATURED_RECITER_NAMES);

export function createSurahSearch(
  surahs: readonly Surah[],
): SearchIndex<Surah> {
  const index = createSearchIndex(surahs, {
    fields: [
      {get: surah => surah.name, weight: 1},
      {get: surah => surah.name_arabic, weight: 1},
      {get: surah => surah.translated_name_english, weight: 0.8},
      {get: surah => SURAH_ALIASES[surah.id] ?? [], weight: 0.9},
    ],
  });
  return {
    search(query: string, limit?: number): SearchHit<Surah>[] {
      const key = toSearchKey(query);
      const unprefixed = key.replace(SURAH_PREFIX, '');
      if (/^\d+$/.test(unprefixed)) {
        const surah = surahs.find(item => item.id === Number(unprefixed));
        return surah ? [{item: surah, score: TIER.exact}] : [];
      }
      const tokens = tokenize(unprefixed);
      const numbers = new Set(
        tokens.filter(token => /^\d+$/.test(token)).map(Number),
      );
      if (numbers.size === 0 && unprefixed === key) {
        // Pass the raw query: the wrong-keyboard fallback needs keys that
        // toSearchKey strips (";" is ك, "." is ز on the Arabic layout).
        return index.search(query, limit);
      }
      const text = tokens.filter(token => !/^\d+$/.test(token)).join(' ');
      const hits = index.search(text);
      // "Al-Fatihah (1)": the number picks among name matches.
      const numbered = hits.filter(hit => numbers.has(hit.item.id));
      return (numbered.length > 0 ? numbered : hits).slice(0, limit);
    },
  };
}

export function createReciterSearch(
  reciters: readonly Reciter[],
): SearchIndex<Reciter> {
  return createSearchIndex(reciters, {
    fields: [
      {get: reciter => reciter.name, weight: 1},
      {get: reciter => getReciterDisplayName(reciter, 'ar'), weight: 1},
      {get: reciter => reciter.rewayat.map(r => r.name), weight: 0.6},
      {
        get: reciter =>
          reciter.rewayat.map(r => getDisplayLabelFromName(r.name)),
        weight: 0.6,
      },
      {get: reciter => reciter.rewayat.map(r => r.style), weight: 0.4},
    ],
    boost: reciter => (FEATURED.has(reciter.name) ? 1 : 0),
  });
}

let surahIndex: SearchIndex<Surah> | null = null;

function getSurahIndex(): SearchIndex<Surah> {
  surahIndex ??= createSurahSearch(SURAHS);
  return surahIndex;
}

// RECITERS is filled in place by dataService (splice), possibly after the
// first query, and refreshed in the background with the same shape. Rebuild
// on its version (bumped by dataService) or a length change.
let reciterIndex: SearchIndex<Reciter> | null = null;
let reciterSignature = '';

function getReciterIndex(): SearchIndex<Reciter> {
  const signature = `${getRecitersVersion()}:${RECITERS.length}`;
  if (!reciterIndex || signature !== reciterSignature) {
    reciterIndex = createReciterSearch(RECITERS);
    reciterSignature = signature;
  }
  return reciterIndex;
}

function restrict<T extends {id: number | string}>(
  hits: readonly SearchHit<T>[],
  within: readonly T[] | undefined,
): T[] {
  if (!within) return hits.map(hit => hit.item);
  // Return the caller's objects (e.g. persisted favorites), not the index's.
  const byId = new Map(within.map(item => [item.id, item]));
  return hits.flatMap(hit => {
    const own = byId.get(hit.item.id);
    return own ? [own] : [];
  });
}

export function rankSurahs(
  query: string,
  within?: readonly Surah[],
): readonly Surah[] {
  if (!query.trim()) return within ?? SURAHS;
  return restrict(getSurahIndex().search(query), within);
}

// Subsets (favorites, complete-Quran reciters) get their own index so items
// missing from RECITERS, or searched before it loads, are still found.
const subsetIndexes = new WeakMap<readonly Reciter[], SearchIndex<Reciter>>();

function getSubsetIndex(within: readonly Reciter[]): SearchIndex<Reciter> {
  let index = subsetIndexes.get(within);
  if (!index) {
    index = createReciterSearch(within);
    subsetIndexes.set(within, index);
  }
  return index;
}

export function rankReciters(
  query: string,
  within?: readonly Reciter[],
): readonly Reciter[] {
  if (!query.trim()) return within ?? RECITERS;
  const index = within ? getSubsetIndex(within) : getReciterIndex();
  return index.search(query).map(hit => hit.item);
}

export interface CatalogSearchResult {
  type: 'surah' | 'reciter';
  item: Surah | Reciter;
  score: number;
}

/** Home search: surahs and reciters merged by relevance (higher is better). */
export function createCatalogSearch(
  reciters: readonly Reciter[],
  surahs: readonly Surah[],
): {search(query: string): CatalogSearchResult[]} {
  const surahSearch = createSurahSearch(surahs);
  const reciterSearch = createReciterSearch(reciters);
  return {
    search(query: string): CatalogSearchResult[] {
      const surahHits = surahSearch.search(query);
      // A bare number is a surah reference; reciters never match digits.
      if (/^\d+$/.test(toSearchKey(query))) {
        return surahHits.map(hit => ({type: 'surah' as const, ...hit}));
      }
      return [
        ...surahHits.map(hit => ({type: 'surah' as const, ...hit})),
        ...reciterSearch
          .search(query)
          .map(hit => ({type: 'reciter' as const, ...hit})),
      ].sort((a, b) => b.score - a.score);
    },
  };
}
