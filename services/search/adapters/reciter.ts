import type {Reciter} from '@/data/reciterData';
import {createEntityIndex, type EntityIndex} from '../entityIndex';
import type {RankedResult, RankingFeatures} from '../types';

// Fields indexed per reciter. The slug carries transliterated tokens
// (e.g. "mishary-rashid-alafasy") that complement the display name.
const FIELDS = [
  {key: 'name', weight: 2.0},
  {key: 'slug', weight: 1.5},
  {key: 'rewayat_names', weight: 0.8},
];

export interface ReciterIndex {
  search: EntityIndex['search'];
  byId: Map<string, Reciter>;
}

export function buildReciterIndex(reciters: Reciter[]): ReciterIndex {
  const idx = createEntityIndex<Reciter>({
    rows: reciters,
    idOf: r => `reciter:${r.id}`,
    fields: FIELDS,
    valueOf: (r, key): string | string[] | undefined => {
      if (key === 'name') return r.name;
      if (key === 'slug') return r.slug ?? undefined;
      if (key === 'rewayat_names') return r.rewayat.map(rw => rw.name);
      return undefined;
    },
  });

  return {
    search: idx.search,
    byId: new Map(reciters.map(r => [`reciter:${r.id}`, r])),
  };
}

export function reciterToResult(
  r: Reciter,
  features: RankingFeatures,
): RankedResult {
  const initials = r.name
    .split(' ')
    .map(p => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const count = r.rewayat.length;
  const styles =
    [...new Set(r.rewayat.map(rw => rw.style))].join(', ') || 'murattal';
  const subtitle = `${count} narration${count === 1 ? '' : 's'} - ${styles}`;

  return {
    id: `reciter:${r.id}`,
    type: 'reciter',
    title: r.name,
    subtitle,
    artwork: {kind: 'reciter', label: initials},
    features,
    payload: {kind: 'reciter', reciter: r},
  };
}
