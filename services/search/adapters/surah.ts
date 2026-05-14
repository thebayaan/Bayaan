import {SURAHS, type Surah} from '@/data/surahData';
import {createEntityIndex, type EntityIndex} from '../entityIndex';
import {aliasesFor} from '../aliases';
import type {RankedResult, RankingFeatures} from '../types';

const FIELDS = [
  {key: 'translated_name_english', weight: 2.0},
  {key: 'name_arabic', weight: 2.0},
  {key: 'name', weight: 1.8},
  {key: 'aliases', weight: 1.8},
  {key: 'id', weight: 1.0},
  {key: 'revelation_place', weight: 0.5},
];

export interface SurahIndex {
  search: EntityIndex['search'];
  byId: Map<string, Surah>;
}

export function buildSurahIndex(surahs: Surah[]): SurahIndex {
  const idx = createEntityIndex<Surah>({
    rows: surahs,
    idOf: s => `surah:${s.id}`,
    fields: FIELDS,
    valueOf: (s, k): string | string[] | undefined => {
      if (k === 'aliases') return aliasesFor('surah', s.id);
      if (k === 'id') return String(s.id);
      return (s as unknown as Record<string, string | undefined>)[k];
    },
  });
  return {
    search: idx.search,
    byId: new Map(surahs.map(s => [`surah:${s.id}`, s])),
  };
}

export function surahToResult(
  s: Surah,
  features: RankingFeatures,
): RankedResult {
  return {
    id: `surah:${s.id}`,
    type: 'surah',
    title: s.translated_name_english ?? s.name,
    subtitle: `Chapter ${s.id} - ${s.verses_count} verses - ${s.revelation_place}`,
    arabicPreview: s.name_arabic,
    artwork: {kind: 'surah', label: String(s.id)},
    features,
    payload: {kind: 'surah', surah: s},
  };
}

export {SURAHS};
