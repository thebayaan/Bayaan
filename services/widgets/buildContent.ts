// services/widgets/buildContent.ts
import type {DownloadedSurah} from '@/services/player/store/downloadStore';
import type {
  PlaylistItem,
  UserPlaylist,
} from '@/services/database/DatabaseService';
import type {Reciter} from '@/data/reciterData';
import {
  PLAYLIST_LIMIT,
  SHELF_ITEM_LIMIT,
  WIDGET_CONTENT_VERSION,
  WidgetContent,
  WidgetPlaylist,
  WidgetShelfItem,
  WidgetSpotlightReciter,
} from 'bayaan-widgets';
import {artworkFileName} from './buildSnapshot';

/** Surahs a spotlight row may offer, in order; up to three that the reciter has. */
export const SPOTLIGHT_SURAH_CANDIDATES: readonly number[] = [
  1, 18, 36, 67, 55, 56,
];
const SPOTLIGHT_SURAH_LIMIT = 3;

export interface PlaylistWithItems {
  playlist: UserPlaylist;
  items: PlaylistItem[];
}

export interface ContentInput {
  now: number;
  downloads: DownloadedSurah[];
  playlists: PlaylistWithItems[];
  spotlight: Reciter[];
  sleepTimerEnd: number | null;
  surahName: (surahId: number) => string | null;
  reciterName: (reciterId: string) => string | null;
}

function shelfItem(
  rawSurahId: string,
  reciterId: string,
  rewayatId: string | null,
  itemId: string | null,
  input: ContentInput,
): WidgetShelfItem | null {
  const surahId = Number.parseInt(rawSurahId, 10);
  if (!Number.isInteger(surahId) || surahId < 1 || surahId > 114) return null;
  const surahName = input.surahName(surahId);
  if (!surahName) return null;
  return {
    surahId,
    surahName,
    reciterId,
    reciterName: input.reciterName(reciterId) ?? '',
    rewayatId,
    itemId,
  };
}

function isItem(value: WidgetShelfItem | null): value is WidgetShelfItem {
  return value !== null;
}

export function spotlightSurahIds(reciter: Reciter): number[] {
  const available = new Set<number>();
  for (const r of reciter.rewayat) {
    for (const n of r.surah_list) if (n !== null) available.add(n);
  }
  return SPOTLIGHT_SURAH_CANDIDATES.filter(id => available.has(id)).slice(
    0,
    SPOTLIGHT_SURAH_LIMIT,
  );
}

function buildPlaylist(
  p: PlaylistWithItems,
  input: ContentInput,
): WidgetPlaylist {
  return {
    id: p.playlist.id,
    name: p.playlist.name,
    itemCount: p.items.length,
    items: [...p.items]
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .filter(i => !i.userRecitationId)
      .map(i =>
        shelfItem(i.surahId, i.reciterId, i.rewayatId ?? null, i.id, input),
      )
      .filter(isItem)
      .slice(0, SHELF_ITEM_LIMIT),
  };
}

export function buildContent(input: ContentInput): WidgetContent {
  const completed = input.downloads
    .filter(d => d.status === 'completed')
    .sort((a, b) => b.downloadDate - a.downloadDate);
  const seen = new Set<string>();
  const spotlight: WidgetSpotlightReciter[] = [];
  for (const r of input.spotlight) {
    if (r.id === '' || seen.has(r.id)) continue;
    seen.add(r.id);
    spotlight.push({
      id: r.id,
      name: r.name,
      artworkFile: artworkFileName(r.id),
      surahIds: spotlightSurahIds(r),
    });
  }
  return {
    version: WIDGET_CONTENT_VERSION,
    generatedAt: input.now,
    downloads: completed
      .map(d =>
        shelfItem(d.surahId, d.reciterId, d.rewayatId || null, null, input),
      )
      .filter(isItem)
      .slice(0, SHELF_ITEM_LIMIT),
    downloadCount: completed.length,
    playlists: [...input.playlists]
      .sort((a, b) => b.playlist.updatedAt - a.playlist.updatedAt)
      .slice(0, PLAYLIST_LIMIT)
      .map(p => buildPlaylist(p, input)),
    spotlight,
    sleepTimerEndsAt:
      input.sleepTimerEnd !== null && input.sleepTimerEnd > input.now
        ? input.sleepTimerEnd
        : null,
  };
}
