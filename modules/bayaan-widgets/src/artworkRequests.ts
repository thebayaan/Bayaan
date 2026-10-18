import {isRecord} from './guards';

// Artwork a widget wanted but did not find in the shared cache.
export interface WidgetArtworkRequests {
  surahIds: number[];
  reciterIds: string[];
}

export const EMPTY_ARTWORK_REQUESTS: WidgetArtworkRequests = {
  surahIds: [],
  reciterIds: [],
};

function isSurahId(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 114
  );
}

function isReciterId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

export function parseArtworkRequests(json: string): WidgetArtworkRequests {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return EMPTY_ARTWORK_REQUESTS;
  }
  if (!isRecord(parsed)) return EMPTY_ARTWORK_REQUESTS;
  const surahs: unknown[] = Array.isArray(parsed.surahIds)
    ? parsed.surahIds
    : [];
  const reciters: unknown[] = Array.isArray(parsed.reciterIds)
    ? parsed.reciterIds
    : [];
  return {
    surahIds: [...new Set(surahs.filter(isSurahId))],
    reciterIds: [...new Set(reciters.filter(isReciterId))],
  };
}
