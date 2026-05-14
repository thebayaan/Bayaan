import type {Signal} from './types';

export interface PersonalContext {
  lovedReciterIds: Set<string>; // string ids (Reciter.id is string)
  lovedTrackIds: Set<string>; // `${reciterId}:${surahId}` (used in Phase 3)
  downloadedTrackIds: Set<string>; // `${reciterId}:${surahId}` (used in Phase 3)
  defaultReciterId: string | null;
  defaultRewayatId: string | null;
  recentResultIds: Set<string>; // full result ids, e.g. `surah:36`
}

const WEIGHTS = {
  loved: 0.2,
  downloaded: 0.2,
  recent: 0.3,
  default: 0.2,
} as const;

export interface PersonalBoost {
  boost: number;
  signal: Signal | null;
}

export function computePersonalBoost(
  resultId: string,
  ctx: PersonalContext,
): PersonalBoost {
  let boost = 0;
  let signal: Signal | null = null;

  if (ctx.recentResultIds.has(resultId)) {
    boost += WEIGHTS.recent;
    signal = 'recent';
  }

  if (resultId.startsWith('reciter:')) {
    const id = resultId.slice('reciter:'.length);
    if (ctx.lovedReciterIds.has(id)) {
      boost += WEIGHTS.loved;
      signal = 'loved';
    }
    if (ctx.defaultReciterId === id) {
      boost += WEIGHTS.default;
      if (!signal) signal = 'default';
    }
  }

  if (
    resultId.startsWith('rewayat:') &&
    ctx.defaultRewayatId === resultId.slice('rewayat:'.length)
  ) {
    boost += WEIGHTS.default;
    if (!signal) signal = 'default';
  }

  return {boost: Math.min(1.0, boost), signal};
}
