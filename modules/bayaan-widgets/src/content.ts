import {isNullableString, isRecord} from './guards';

export const WIDGET_CONTENT_VERSION = 1;
export const SHELF_ITEM_LIMIT = 8;
export const PLAYLIST_LIMIT = 20;

export interface WidgetShelfItem {
  surahId: number; // 1 to 114
  surahName: string;
  reciterId: string;
  reciterName: string;
  rewayatId: string | null;
  itemId: string | null; // playlist item id; null for downloads
}

export interface WidgetPlaylist {
  id: string;
  name: string;
  itemCount: number; // every item, uploads included
  items: WidgetShelfItem[]; // first SHELF_ITEM_LIMIT non-upload items, in order
}

export interface WidgetSpotlightReciter {
  id: string;
  name: string;
  artworkFile: string; // reciter-{id}.jpg; may not be cached yet
  surahIds: number[]; // up to 3 popular surahs the reciter has
}

// Phase 3 side document (content.json). Written when its content changes.
export interface WidgetContent {
  version: typeof WIDGET_CONTENT_VERSION;
  generatedAt: number;
  downloads: WidgetShelfItem[]; // completed, newest first
  downloadCount: number;
  playlists: WidgetPlaylist[];
  spotlight: WidgetSpotlightReciter[];
  sleepTimerEndsAt: number | null; // epoch ms
}

function isShelfItem(value: unknown): value is WidgetShelfItem {
  return (
    isRecord(value) &&
    typeof value.surahId === 'number' &&
    typeof value.surahName === 'string' &&
    typeof value.reciterId === 'string' &&
    typeof value.reciterName === 'string' &&
    isNullableString(value.rewayatId) &&
    isNullableString(value.itemId)
  );
}

function isShelfList(value: unknown): value is WidgetShelfItem[] {
  return Array.isArray(value) && value.every(isShelfItem);
}

function isPlaylist(value: unknown): value is WidgetPlaylist {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.itemCount === 'number' &&
    isShelfList(value.items)
  );
}

function isSpotlight(value: unknown): value is WidgetSpotlightReciter {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.artworkFile === 'string' &&
    Array.isArray(value.surahIds) &&
    value.surahIds.every(n => typeof n === 'number')
  );
}

export function isWidgetContent(value: unknown): value is WidgetContent {
  return (
    isRecord(value) &&
    value.version === WIDGET_CONTENT_VERSION &&
    typeof value.generatedAt === 'number' &&
    isShelfList(value.downloads) &&
    typeof value.downloadCount === 'number' &&
    Array.isArray(value.playlists) &&
    value.playlists.every(isPlaylist) &&
    Array.isArray(value.spotlight) &&
    value.spotlight.every(isSpotlight) &&
    (value.sleepTimerEndsAt === null ||
      typeof value.sleepTimerEndsAt === 'number')
  );
}
