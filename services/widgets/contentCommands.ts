// services/widgets/contentCommands.ts
// Handlers for the Phase 3 widget commands. syncContentWidgets registers
// runContentCommand with handleWidgetCommand, so the Phase 1 handler does not
// import the playlist database or the ambient store itself.
import type {Track} from '@/types/audio';
import type {Reciter} from '@/data/reciterData';
import type {PlaylistItem} from '@/services/database/DatabaseService';
import type {WidgetAmbientSound, WidgetCommand} from 'bayaan-widgets';
import {playlistService} from '@/services/playlist/PlaylistService';
import {useUploadsStore} from '@/store/uploadsStore';
import {createTrack, createUserUploadTrack} from '@/utils/track';
import {getReciterByIdSync, getSurahById} from '@/services/dataService';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {useReciterStore} from '@/store/reciterStore';
import {useAmbientStore} from '@/store/ambientStore';
import {widgetFeatures} from './enabledWidgets';

export type PlayPlaylistCommand = Extract<
  WidgetCommand,
  {type: 'playPlaylist'}
>;
export type StartBedtimeCommand = Extract<
  WidgetCommand,
  {type: 'startBedtime'}
>;
export type ContentCommand = PlayPlaylistCommand | StartBedtimeCommand;
export type PlaySurahFromStart = (
  reciter: Reciter,
  surahId: number,
) => Promise<boolean>;

export interface ContentCommandDeps {
  playlistItems: (playlistId: string) => Promise<PlaylistItem[]>;
  trackForItem: (item: PlaylistItem) => Promise<Track | null>;
  playTracks: (tracks: Track[], startIndex: number) => Promise<void>;
  getReciter: (id: string) => Reciter | undefined;
  getDefaultReciter: () => Reciter | null;
  playSurahFromStart: PlaySurahFromStart;
  setSleepTimer: (minutes: number) => void;
  startAmbient: (sound: WidgetAmbientSound) => void;
}

/** Puts the tapped item first and wraps the rest, like PlaylistDetail.handleSurahPress. */
export function rotateToItem<T>(
  entries: {itemId: string; value: T}[],
  itemId: string | null,
): T[] {
  const found =
    itemId === null ? -1 : entries.findIndex(e => e.itemId === itemId);
  const start = found < 0 ? 0 : found;
  return [...entries.slice(start), ...entries.slice(0, start)].map(
    e => e.value,
  );
}

export async function playPlaylist(
  cmd: PlayPlaylistCommand,
  deps: ContentCommandDeps,
): Promise<void> {
  const items = [...(await deps.playlistItems(cmd.playlistId))].sort(
    (a, b) => a.orderIndex - b.orderIndex,
  );
  const built: {itemId: string; value: Track}[] = [];
  for (const item of items) {
    const track = await deps.trackForItem(item);
    if (track) built.push({itemId: item.id, value: track});
  }
  if (built.length === 0) return;
  await deps.playTracks(rotateToItem(built, cmd.itemId), 0);
}

export async function startBedtime(
  cmd: StartBedtimeCommand,
  deps: ContentCommandDeps,
): Promise<void> {
  const chosen = cmd.reciterId ? deps.getReciter(cmd.reciterId) : undefined;
  const reciter = chosen ?? deps.getDefaultReciter();
  if (!reciter) return;
  if (!(await deps.playSurahFromStart(reciter, cmd.surahId))) return;
  deps.setSleepTimer(cmd.sleepMinutes);
  if (cmd.ambient) deps.startAmbient(cmd.ambient);
}

export function defaultContentDeps(
  playSurahFromStart: PlaySurahFromStart,
): ContentCommandDeps {
  return {
    playlistItems: id => playlistService.getPlaylistItems(id),
    trackForItem: async item => {
      if (item.userRecitationId) {
        const upload = useUploadsStore
          .getState()
          .recitations.find(r => r.id === item.userRecitationId);
        return upload ? createUserUploadTrack(upload) : null;
      }
      const reciter = getReciterByIdSync(item.reciterId);
      const surah = getSurahById(Number.parseInt(item.surahId, 10));
      if (!reciter || !surah) return null;
      return createTrack(reciter, surah, item.rewayatId);
    },
    playTracks: async (tracks, startIndex) => {
      const store = usePlayerStore.getState();
      await store.updateQueue(tracks, startIndex);
      await store.play();
    },
    getReciter: id => getReciterByIdSync(id),
    getDefaultReciter: () => {
      const r = useReciterStore.getState().defaultReciter;
      return r.id === '' ? null : r;
    },
    playSurahFromStart,
    setSleepTimer: minutes => usePlayerStore.getState().setSleepTimer(minutes),
    // setSound stops any current ambient, enables ambient and fades the new sound in.
    startAmbient: sound => {
      // A fork without ambient audio (RFC-021) ignores a stale widget's sound.
      if (!widgetFeatures.ambient) return;
      useAmbientStore.getState().setSound(sound);
    },
  };
}

export async function runContentCommand(
  cmd: ContentCommand,
  playSurahFromStart: PlaySurahFromStart,
  deps: ContentCommandDeps = defaultContentDeps(playSurahFromStart),
): Promise<void> {
  if (cmd.type === 'playPlaylist') {
    await playPlaylist(cmd, deps);
    return;
  }
  await startBedtime(cmd, deps);
}
