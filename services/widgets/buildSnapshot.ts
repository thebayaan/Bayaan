// services/widgets/buildSnapshot.ts
import type {Track} from '@/types/audio';
import type {Reciter} from '@/data/reciterData';
import type {RecentlyPlayedTrack} from '@/services/player/store/recentlyPlayedStore';
import {SURAHS} from '@/data/surahData';
import {getJuzForPage, getSurahForPage} from '@/utils/quranPages';
import {
  WIDGET_SNAPSHOT_VERSION,
  WidgetAdhkarPlayback,
  WidgetLastRead,
  WidgetReciter,
  WidgetSnapshot,
  WidgetTasbeehEntry,
  WidgetThemeMode,
  WidgetTrack,
} from 'bayaan-widgets';

export {surahArtworkFileName} from './artworkNames';
export {surahArtworkUrl} from './surahArtwork';

const UP_NEXT_LIMIT = 3;
const RECENT_LIMIT = 6;
const RECITER_RECENT_LIMIT = 3;

export interface SnapshotInput {
  now: number;
  theme: WidgetThemeMode;
  queueTracks: Track[];
  currentIndex: number;
  isPlaying: boolean;
  positionSec: number;
  durationSec: number;
  rate: number;
  recentTracks: RecentlyPlayedTrack[];
  defaultReciter: Reciter | null;
  lastReadPage: number | null;
  openingTextForPage: (page: number) => string;
  /** Surah the mushaf header shows for a page; null falls back to the first surah on the page. */
  surahIdForPage?: (page: number) => number | null;
  tasbeeh: Record<string, WidgetTasbeehEntry>;
  artworkFileFor: (reciterId: string) => string | null;
  surahArtworkFileFor: (surahId: number) => string | null;
  surahOfTheDayId: number;
  adhkar?: WidgetAdhkarPlayback | null; // @ai
}

export function artworkFileName(reciterId: string): string {
  return `reciter-${reciterId.replace(/[^a-zA-Z0-9_-]/g, '_')}.jpg`;
}

/** The surah a track shows a card for, or null for uploads and unknown ids. */
export function cardSurahId(
  surahId: number,
  isUserUpload: boolean,
): number | null {
  return !isUserUpload &&
    Number.isInteger(surahId) &&
    surahId >= 1 &&
    surahId <= 114
    ? surahId
    : null;
}

// Surah card when cached, else the reciter photo.
function trackArtwork(
  surahId: number,
  reciterId: string | undefined,
  isUserUpload: boolean,
  input: SnapshotInput,
): string | null {
  const cardId = cardSurahId(surahId, isUserUpload);
  const card = cardId === null ? null : input.surahArtworkFileFor(cardId);
  return card ?? (reciterId ? input.artworkFileFor(reciterId) : null);
}

function surahName(surahId: number): string {
  return SURAHS[surahId - 1]?.name ?? '';
}

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function fromQueueTrack(t: Track, input: SnapshotInput): WidgetTrack {
  const parsed = t.surahId ? parseInt(t.surahId, 10) : 0;
  const surahId = Number.isNaN(parsed) ? 0 : parsed;
  return {
    surahId,
    surahName:
      (surahId > 0 && !t.isUserUpload ? surahName(surahId) : '') || t.title,
    reciterId: t.reciterId,
    reciterName: t.reciterName,
    rewayatId: t.rewayatId ?? null,
    artworkFile: trackArtwork(
      surahId,
      t.reciterId,
      t.isUserUpload ?? false,
      input,
    ),
    isUserUpload: t.isUserUpload ?? false,
  };
}

function fromRecent(r: RecentlyPlayedTrack, input: SnapshotInput): WidgetTrack {
  return {
    surahId: r.surah.id,
    surahName: r.surah.name,
    reciterId: r.reciter.id,
    reciterName: r.reciter.name,
    rewayatId: r.rewayatId || null,
    artworkFile: trackArtwork(
      r.surah.id,
      r.reciter.id,
      r.isUserUpload ?? false,
      input,
    ),
    isUserUpload: r.isUserUpload ?? false,
  };
}

function toWidgetReciter(
  r: Reciter | null,
  input: SnapshotInput,
): WidgetReciter | null {
  if (!r || r.id === '') return null;
  return {id: r.id, name: r.name, artworkFile: input.artworkFileFor(r.id)};
}

function buildLastRead(input: SnapshotInput): WidgetLastRead | null {
  if (input.lastReadPage === null) return null;
  const headerSurahId = input.surahIdForPage?.(input.lastReadPage) ?? null;
  const surah =
    (headerSurahId === null
      ? undefined
      : SURAHS.find(s => s.id === headerSurahId)) ??
    getSurahForPage(input.lastReadPage);
  if (!surah) return null;
  return {
    page: input.lastReadPage,
    surahId: surah.id,
    surahName: surah.name,
    juz: getJuzForPage(input.lastReadPage),
    openingText: input.openingTextForPage(input.lastReadPage),
  };
}

function buildReciterRecents(
  recent: WidgetTrack[],
): Record<string, WidgetTrack[]> {
  const byReciter: Record<string, WidgetTrack[]> = {};
  for (const t of recent) {
    if (t.isUserUpload) continue;
    const list = byReciter[t.reciterId] ?? [];
    if (list.length < RECITER_RECENT_LIMIT) list.push(t);
    byReciter[t.reciterId] = list;
  }
  return byReciter;
}

export function buildSnapshot(input: SnapshotInput): WidgetSnapshot {
  const current = input.queueTracks[input.currentIndex];
  const defaultReciter = toWidgetReciter(input.defaultReciter, input);
  const allRecent = [...input.recentTracks]
    .sort((a, b) => b.timestamp - a.timestamp)
    .map(r => fromRecent(r, input));

  let upNext = input.queueTracks
    .slice(input.currentIndex + 1, input.currentIndex + 1 + UP_NEXT_LIMIT)
    .map(t => fromQueueTrack(t, input));

  // Empty state: nothing queued or played yet, suggest surah of the day.
  if (
    !current &&
    upNext.length === 0 &&
    allRecent.length === 0 &&
    defaultReciter
  ) {
    upNext = [
      {
        surahId: input.surahOfTheDayId,
        surahName: surahName(input.surahOfTheDayId),
        reciterId: defaultReciter.id,
        reciterName: defaultReciter.name,
        rewayatId: null,
        artworkFile: trackArtwork(
          input.surahOfTheDayId,
          defaultReciter.id,
          false,
          input,
        ),
        isUserUpload: false,
      },
    ];
  }

  return {
    version: WIDGET_SNAPSHOT_VERSION,
    generatedAt: input.now,
    theme: input.theme,
    nowPlaying: current
      ? {
          track: fromQueueTrack(current, input),
          isPlaying: input.isPlaying,
          positionSec: finiteOr(input.positionSec, 0),
          durationSec: finiteOr(input.durationSec, 0),
          rate: input.rate > 0 ? finiteOr(input.rate, 1) : 1,
        }
      : null,
    upNext,
    recent: allRecent.slice(0, RECENT_LIMIT),
    defaultReciter,
    reciterRecents: buildReciterRecents(allRecent),
    lastRead: buildLastRead(input),
    tasbeeh: input.tasbeeh,
    adhkar: input.adhkar ?? null, // @ai
  };
}
