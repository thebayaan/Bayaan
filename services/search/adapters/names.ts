import asmaRaw from '@/data/asma.json';
import {createEntityIndex, type EntityIndex} from '../entityIndex';
import type {RankedResult, RankingFeatures} from '../types';

export interface NameOfAllah {
  index: number;
  arabic: string;
  transliteration: string;
  meaning_en: string;
}

export function loadAsma(): NameOfAllah[] {
  return asmaRaw as NameOfAllah[];
}

const FIELDS = [
  {key: 'arabic', weight: 2.0},
  {key: 'transliteration', weight: 1.8},
  {key: 'meaning_en', weight: 1.6},
];

export interface NamesIndex {
  search: EntityIndex['search'];
  byId: Map<string, NameOfAllah>;
}

export function buildNamesIndex(rows: NameOfAllah[]): NamesIndex {
  const idx = createEntityIndex<NameOfAllah>({
    rows,
    idOf: n => `name:${n.index}`,
    fields: FIELDS,
    valueOf: (n, k) => (n as unknown as Record<string, string | undefined>)[k],
  });
  return {
    search: idx.search,
    byId: new Map(rows.map(n => [`name:${n.index}`, n])),
  };
}

export function nameToResult(
  n: NameOfAllah,
  features: RankingFeatures,
): RankedResult {
  return {
    id: `name:${n.index}`,
    type: 'name_of_allah',
    title: `${n.transliteration} - ${n.meaning_en}`,
    subtitle: `Beautiful Name ${n.index} of 99`,
    arabicPreview: n.arabic,
    artwork: {kind: 'name', label: String(n.index)},
    features,
    payload: {kind: 'name_of_allah', index: n.index},
  };
}
