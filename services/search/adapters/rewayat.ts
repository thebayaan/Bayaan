import {type RewayatEntry} from '@/data/rewayat';
import {createEntityIndex, type EntityIndex} from '../entityIndex';
import {aliasesFor} from '../aliases';
import type {RankedResult, RankingFeatures} from '../types';

const FIELDS = [
  {key: 'displayName', weight: 2.0},
  {key: 'name', weight: 1.8},
  {key: 'aliases', weight: 1.5},
  {key: 'teacher', weight: 0.8},
  {key: 'student', weight: 0.8},
  {key: 'description', weight: 0.7},
];

export interface RewayatIndex {
  search: EntityIndex['search'];
  byId: Map<string, RewayatEntry>;
}

export function buildRewayatIndex(rows: RewayatEntry[]): RewayatIndex {
  const idx = createEntityIndex<RewayatEntry>({
    rows,
    idOf: r => `rewayat:${r.id}`,
    fields: FIELDS,
    valueOf: (r, k) => {
      if (k === 'aliases') return aliasesFor('rewayat', r.id);
      return (r as unknown as Record<string, string | undefined>)[k];
    },
  });
  return {
    search: idx.search,
    byId: new Map(rows.map(r => [`rewayat:${r.id}`, r])),
  };
}

export function rewayatToResult(
  r: RewayatEntry,
  features: RankingFeatures,
): RankedResult {
  return {
    id: `rewayat:${r.id}`,
    type: 'rewayat',
    title: r.displayName,
    subtitle: r.description,
    artwork: {kind: 'rewayat', label: r.displayName.slice(0, 2)},
    features,
    payload: {kind: 'rewayat', rewayat: r},
  };
}
