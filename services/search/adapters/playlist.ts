import {createEntityIndex, type EntityIndex} from '../entityIndex';
import type {RankedResult, RankingFeatures} from '../types';

export interface PlaylistSummary {
  id: string;
  name: string;
  itemCount: number;
}

const FIELDS = [{key: 'name', weight: 2.0}];

export interface PlaylistIndex {
  search: EntityIndex['search'];
  byId: Map<string, PlaylistSummary>;
}

export function buildPlaylistIndex(rows: PlaylistSummary[]): PlaylistIndex {
  const idx = createEntityIndex<PlaylistSummary>({
    rows,
    idOf: p => `playlist:${p.id}`,
    fields: FIELDS,
    valueOf: (p, k) => (p as unknown as Record<string, string | undefined>)[k],
  });
  return {
    search: idx.search,
    byId: new Map(rows.map(p => [`playlist:${p.id}`, p])),
  };
}

export function playlistToResult(
  p: PlaylistSummary,
  features: RankingFeatures,
): RankedResult {
  return {
    id: `playlist:${p.id}`,
    type: 'playlist',
    title: p.name,
    subtitle: `${p.itemCount} item${p.itemCount === 1 ? '' : 's'}`,
    artwork: {kind: 'playlist', label: p.name[0]?.toUpperCase() ?? 'P'},
    features,
    payload: {kind: 'playlist', playlistId: p.id},
  };
}
