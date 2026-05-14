import type {Reciter} from '@/data/reciterData';
import type {Surah} from '@/data/surahData';
import type {RewayatEntry} from '@/data/rewayat';
import {buildReciterIndex, reciterToResult} from './adapters/reciter';
import {buildSurahIndex, surahToResult} from './adapters/surah';
import {buildRewayatIndex, rewayatToResult} from './adapters/rewayat';
import {
  buildAdhkarCategoryIndex,
  adhkarCategoryToResult,
  type AdhkarCategory,
} from './adapters/adhkar';
import {
  buildNamesIndex,
  nameToResult,
  type NameOfAllah,
} from './adapters/names';
import {
  buildPlaylistIndex,
  playlistToResult,
  type PlaylistSummary,
} from './adapters/playlist';
import {parseRef} from './refParser';
import {computePersonalBoost, type PersonalContext} from './personalSignals';
import {computeContextualBoost} from './contextualSignals';
import type {
  RankedResult,
  RankingFeatures,
  SearchRequest,
  SearchResponse,
  EntityType,
} from './types';
import type {EntityHit} from './entityIndex';

export interface OrchestratorDeps {
  reciters: Reciter[];
  surahs: Surah[];
  rewayat: RewayatEntry[];
  adhkarCategories: AdhkarCategory[];
  names: NameOfAllah[];
  playlists: PlaylistSummary[];
  personalCtxProvider: () => PersonalContext;
}

export interface Orchestrator {
  search(req: SearchRequest): SearchResponse;
}

const TAB_LABELS: Record<EntityType | 'all', string> = {
  all: 'All',
  numeric_ref: 'Jump to',
  reciter: 'Reciters',
  surah: 'Surahs',
  rewayat: 'Rewayat',
  adhkar_category: 'Adhkar',
  name_of_allah: 'Names of Allah',
  playlist: 'Playlists',
};

const TAB_ORDER: Array<EntityType | 'all'> = [
  'all',
  'numeric_ref',
  'reciter',
  'surah',
  'rewayat',
  'adhkar_category',
  'name_of_allah',
  'playlist',
];

export function createOrchestrator(deps: OrchestratorDeps): Orchestrator {
  const recIdx = buildReciterIndex(deps.reciters);
  const surahIdx = buildSurahIndex(deps.surahs);
  const rewIdx = buildRewayatIndex(deps.rewayat);
  const adhkarIdx = buildAdhkarCategoryIndex(deps.adhkarCategories);
  const namesIdx = buildNamesIndex(deps.names);
  const playlistIdx = buildPlaylistIndex(deps.playlists);

  function search(req: SearchRequest): SearchResponse {
    const q = req.query.trim();
    if (!q) return {query: q, results: [], tabs: []};

    const ctx = deps.personalCtxProvider();
    const now = req.now ?? Date.now();
    const accum: RankedResult[] = [];

    function pushWithBoosts<T>(
      hits: EntityHit[],
      byId: Map<string, T>,
      toResult: (item: T, features: RankingFeatures) => RankedResult,
    ): void {
      for (const h of hits) {
        const item = byId.get(h.id);
        if (!item) continue;
        const personal = computePersonalBoost(h.id, ctx);
        const contextual = computeContextualBoost(h.id, {now});
        const final = h.textualScore * (1 + personal.boost + contextual.boost);
        accum.push(
          toResult(item, {
            textualScore: h.textualScore,
            personalBoost: personal.boost,
            contextualBoost: contextual.boost,
            finalScore: final,
            tier: h.tier,
            matchedField: h.matchedField,
            matchedRange: h.matchedRange,
            signal: personal.signal ?? contextual.signal,
          }),
        );
      }
    }

    pushWithBoosts(recIdx.search(q), recIdx.byId, reciterToResult);
    pushWithBoosts(surahIdx.search(q), surahIdx.byId, surahToResult);
    pushWithBoosts(rewIdx.search(q), rewIdx.byId, rewayatToResult);
    pushWithBoosts(adhkarIdx.search(q), adhkarIdx.byId, adhkarCategoryToResult);
    pushWithBoosts(namesIdx.search(q), namesIdx.byId, nameToResult);
    pushWithBoosts(playlistIdx.search(q), playlistIdx.byId, playlistToResult);

    const refs = parseRef(q);
    for (const ref of refs) {
      const features: RankingFeatures = {
        textualScore: 1.0,
        personalBoost: 0,
        contextualBoost: 0,
        finalScore: 1.0,
        tier: 'exact',
        matchedField: 'ref',
        matchedRange: null,
        signal: null,
      };
      const artworkLabel =
        ref.kind === 'verse'
          ? `${ref.surah}:${ref.ayah}`
          : ref.kind === 'page'
            ? String(ref.page)
            : ref.kind === 'juz'
              ? String(ref.juz)
              : String(ref.surah);
      const subtitle =
        ref.kind === 'verse'
          ? 'Open in mushaf'
          : ref.kind === 'page'
            ? 'Open page in mushaf'
            : ref.kind === 'juz'
              ? 'Open juz in mushaf'
              : 'Open surah in mushaf';
      accum.push({
        id: `ref:${JSON.stringify(ref)}`,
        type: 'numeric_ref',
        title: ref.label,
        subtitle,
        artwork: {kind: 'verse', label: artworkLabel},
        features,
        payload: {kind: 'numeric_ref', ref},
      });
    }

    accum.sort((a, b) => b.features.finalScore - a.features.finalScore);

    const counts = new Map<EntityType, number>();
    for (const r of accum) {
      counts.set(r.type, (counts.get(r.type) ?? 0) + 1);
    }

    type Tab = {type: EntityType | 'all'; label: string; count: number};
    const tabs: Tab[] = [];
    for (const t of TAB_ORDER) {
      if (t === 'all') {
        tabs.push({type: 'all', label: TAB_LABELS[t], count: accum.length});
      } else {
        const c = counts.get(t) ?? 0;
        if (c > 0) tabs.push({type: t, label: TAB_LABELS[t], count: c});
      }
    }

    return {query: q, results: accum, tabs};
  }

  return {search};
}
