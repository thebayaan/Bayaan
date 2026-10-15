import {CarPlayRequest, CarTransport} from '@/services/car/types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function str(v: unknown): string | null {
  return typeof v === 'string' ? v : null;
}

function num(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

function index(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : undefined;
}

function safeJson(json: string): unknown {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function parseCarPlayRequest(json: string): CarPlayRequest | null {
  const v = safeJson(json);
  if (!isRecord(v)) return null;
  switch (v.kind) {
    case 'surah': {
      const reciterId = str(v.reciterId);
      const rewayatId = str(v.rewayatId);
      const surahId = num(v.surahId);
      if (!reciterId || !rewayatId || surahId === undefined) return null;
      return {
        kind: 'surah',
        reciterId,
        rewayatId,
        surahId,
        startAt: num(v.startAt),
      };
    }
    case 'playlist': {
      const playlistId = str(v.playlistId);
      if (!playlistId) return null;
      return {
        kind: 'playlist',
        playlistId,
        system: v.system === true,
        startIndex: index(v.startIndex),
      };
    }
    case 'loved':
      return {
        kind: 'loved',
        shuffle: v.shuffle === true,
        startIndex: index(v.startIndex),
      };
    case 'downloads':
      return {kind: 'downloads', startIndex: index(v.startIndex)};
    case 'uploads':
      return {kind: 'uploads', startIndex: index(v.startIndex)};
    case 'resume': {
      const recitationId = str(v.recitationId);
      return recitationId ? {kind: 'resume', recitationId} : {kind: 'resume'};
    }
    case 'random':
      return {kind: 'random'};
    default:
      return null;
  }
}

export function parseCarTransport(json: string): CarTransport | null {
  const v = safeJson(json);
  if (!isRecord(v)) return null;
  switch (v.kind) {
    case 'next':
    case 'previous':
    case 'play':
    case 'pause':
    case 'cycleRate':
    case 'cycleRepeat':
    case 'toggleLove':
      return {kind: v.kind};
    case 'seek': {
      const position = num(v.position);
      return position === undefined ? null : {kind: 'seek', position};
    }
    case 'rate': {
      const value = num(v.value);
      return value === undefined ? null : {kind: 'rate', value};
    }
    case 'jumpTo': {
      const at = index(v.index);
      return at === undefined ? null : {kind: 'jumpTo', index: at};
    }
    default:
      return null;
  }
}
