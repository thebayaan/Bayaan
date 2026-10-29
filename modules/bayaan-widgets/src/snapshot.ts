import {isNullableString, isRecord} from './guards';

export const WIDGET_SNAPSHOT_VERSION = 1;

export type WidgetThemeMode = 'light' | 'dark' | 'system';

export interface WidgetTrack {
  surahId: number; // 0 for user uploads without a surah
  surahName: string;
  reciterId: string;
  reciterName: string;
  rewayatId: string | null;
  artworkFile: string | null; // file name inside shared artwork dir
  isUserUpload: boolean;
}

export interface WidgetReciter {
  id: string;
  name: string;
  artworkFile: string | null;
}

export interface WidgetNowPlaying {
  track: WidgetTrack;
  isPlaying: boolean;
  positionSec: number; // at generatedAt
  durationSec: number;
  rate: number; // playback speed, 1 is normal
}

export interface WidgetLastRead {
  page: number;
  surahId: number;
  surahName: string;
  juz: number;
  openingText: string;
}

export interface WidgetTasbeehEntry {
  count: number;
  target: number;
  day: string; // YYYY-MM-DD local
}

// @ai-start
// The adhkar player is separate from the main one, so it is never nowPlaying.
export interface WidgetAdhkarPlayback {
  superId: string; // the session's listId ('saved' for the Saved list)
  dhikrId: string;
  isPlaying: boolean;
}
// @ai-end

export interface WidgetSnapshot {
  version: typeof WIDGET_SNAPSHOT_VERSION;
  generatedAt: number;
  theme: WidgetThemeMode;
  nowPlaying: WidgetNowPlaying | null;
  upNext: WidgetTrack[];
  recent: WidgetTrack[];
  defaultReciter: WidgetReciter | null;
  reciterRecents: Record<string, WidgetTrack[]>;
  lastRead: WidgetLastRead | null;
  tasbeeh: Record<string, WidgetTasbeehEntry>;
  // Optional: older snapshots and fixtures have none. // @ai
  adhkar?: WidgetAdhkarPlayback | null; // @ai
}

export function isWidgetTrack(value: unknown): value is WidgetTrack {
  return (
    isRecord(value) &&
    typeof value.surahId === 'number' &&
    typeof value.surahName === 'string' &&
    typeof value.reciterId === 'string' &&
    typeof value.reciterName === 'string' &&
    isNullableString(value.rewayatId) &&
    isNullableString(value.artworkFile) &&
    typeof value.isUserUpload === 'boolean'
  );
}

function isTrackList(value: unknown): value is WidgetTrack[] {
  return Array.isArray(value) && value.every(isWidgetTrack);
}

function isReciter(value: unknown): value is WidgetReciter {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    isNullableString(value.artworkFile)
  );
}

function isNowPlaying(value: unknown): value is WidgetNowPlaying {
  return (
    isRecord(value) &&
    isWidgetTrack(value.track) &&
    typeof value.isPlaying === 'boolean' &&
    typeof value.positionSec === 'number' &&
    typeof value.durationSec === 'number' &&
    typeof value.rate === 'number'
  );
}

function isLastRead(value: unknown): value is WidgetLastRead {
  return (
    isRecord(value) &&
    typeof value.page === 'number' &&
    typeof value.surahId === 'number' &&
    typeof value.surahName === 'string' &&
    typeof value.juz === 'number' &&
    typeof value.openingText === 'string'
  );
}

function isTasbeehEntry(value: unknown): value is WidgetTasbeehEntry {
  return (
    isRecord(value) &&
    typeof value.count === 'number' &&
    typeof value.target === 'number' &&
    typeof value.day === 'string'
  );
}

// @ai-start
function isAdhkarPlayback(value: unknown): value is WidgetAdhkarPlayback {
  return (
    isRecord(value) &&
    typeof value.superId === 'string' &&
    typeof value.dhikrId === 'string' &&
    typeof value.isPlaying === 'boolean'
  );
}
// @ai-end

export function isWidgetSnapshot(value: unknown): value is WidgetSnapshot {
  if (!isRecord(value)) return false;
  if (value.version !== WIDGET_SNAPSHOT_VERSION) return false;
  if (typeof value.generatedAt !== 'number') return false;
  if (
    value.theme !== 'light' &&
    value.theme !== 'dark' &&
    value.theme !== 'system'
  ) {
    return false;
  }
  if (value.nowPlaying !== null && !isNowPlaying(value.nowPlaying))
    return false;
  if (!isTrackList(value.upNext) || !isTrackList(value.recent)) return false;
  if (value.defaultReciter !== null && !isReciter(value.defaultReciter))
    return false;
  if (!isRecord(value.reciterRecents)) return false;
  if (!Object.values(value.reciterRecents).every(isTrackList)) return false;
  if (value.lastRead !== null && !isLastRead(value.lastRead)) return false;
  if (!isRecord(value.tasbeeh)) return false;
  // Absent in snapshots written before adhkar playback was shared. // @ai
  if (value.adhkar != null && !isAdhkarPlayback(value.adhkar)) return false; // @ai
  return Object.values(value.tasbeeh).every(isTasbeehEntry);
}
