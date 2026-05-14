import adhkarRaw from '@/data/adhkar.json';
import {createEntityIndex, type EntityIndex} from '../entityIndex';
import type {RankedResult, RankingFeatures} from '../types';

export interface AdhkarCategory {
  id: string;
  title: string;
  audio_url?: string;
  broad_tags?: string[];
  dhikr_count?: number;
}

export function loadAdhkarCategories(): AdhkarCategory[] {
  const data = adhkarRaw as {categories?: AdhkarCategory[]} | AdhkarCategory[];
  return Array.isArray(data) ? data : (data.categories ?? []);
}

const FIELDS = [
  {key: 'title', weight: 2.0},
  {key: 'broad_tags', weight: 1.0},
];

export interface AdhkarCategoryIndex {
  search: EntityIndex['search'];
  byId: Map<string, AdhkarCategory>;
}

export function buildAdhkarCategoryIndex(
  rows: AdhkarCategory[],
): AdhkarCategoryIndex {
  const idx = createEntityIndex<AdhkarCategory>({
    rows,
    idOf: c => `adhkar:${c.id}`,
    fields: FIELDS,
    valueOf: (c, k) => {
      if (k === 'broad_tags') return c.broad_tags ?? [];
      return (c as unknown as Record<string, string | undefined>)[k];
    },
  });
  return {
    search: idx.search,
    byId: new Map(rows.map(c => [`adhkar:${c.id}`, c])),
  };
}

export function adhkarCategoryToResult(
  c: AdhkarCategory,
  features: RankingFeatures,
): RankedResult {
  return {
    id: `adhkar:${c.id}`,
    type: 'adhkar_category',
    title: c.title,
    subtitle: `${c.dhikr_count ?? 0} adhkar`,
    artwork: {kind: 'adhkar', label: c.title[0] ?? '?'},
    features,
    payload: {kind: 'adhkar_category', categoryId: c.id},
  };
}
