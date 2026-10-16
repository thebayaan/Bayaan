import type {WidgetCommand} from 'bayaan-widgets';
import type {Reciter} from '@/data/reciterData';
import type {Track} from '@/types/audio';
import type {PlayerState} from '@/services/player/types/state';
import {createTrack} from '@/utils/track';
import {getReciterByIdSync, getSurahById} from '@/services/dataService';
import {useReciterStore} from '@/store/reciterStore';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {useRecentlyPlayedStore} from '@/services/player/store/recentlyPlayedStore';
import {timestampService} from '@/services/timestamps/TimestampService';
import {timingNumberingService} from '@/services/timestamps/TimingNumberingService';
import type {TimingNumbering} from '@/utils/timestampNumbering';
import {resolveRewayahFromName} from '@/services/rewayah/RewayahIdentity';
import {expoAudioService} from '@/services/audio/ExpoAudioService';
import {resumeRecent} from '@/services/player/utils/resumeRecent';
import {pendingRestoreLoad} from '@/services/player/utils/restoreSession';

const DEFAULT_SURAH_FOR_RECITER = 1;

export type ContentRunner = (
  command: Extract<WidgetCommand, {type: 'playPlaylist' | 'startBedtime'}>,
  playSurahFromStart: (reciter: Reciter, surahId: number) => Promise<boolean>,
) => Promise<void>;

// Registered by syncContentWidgets so this handler does not import the
// playlist database or the ambient store itself.
let contentRunner: ContentRunner | null = null;

export function setContentCommandRunner(runner: ContentRunner): void {
  contentRunner = runner;
}

export interface RecentMatch {
  reciterId: string;
  surahId: number;
  rewayatId: string | null;
  startPosition: number;
  // Index into recentlyPlayedStore.recentTracks.
  recentIndex: number;
}

export interface TrackKey {
  reciterId: string;
  surahId: number;
  rewayatId: string | null;
}

function trackMatches(t: Track, key: TrackKey): boolean {
  return (
    !t.isUserUpload &&
    t.reciterId === key.reciterId &&
    t.surahId === String(key.surahId) &&
    (t.rewayatId ?? null) === key.rewayatId
  );
}

export interface CommandDeps {
  getReciter: (id: string) => Reciter | undefined;
  getDefaultReciter: () => Reciter | null;
  playbackState: () => PlayerState;
  hasCurrentTrack: () => boolean;
  // False on a cold start until restoreSession has loaded the track.
  isAudioLoaded: () => boolean;
  // Loads the current queue item at the saved position and autoplays.
  loadAndPlayCurrent: () => Promise<void>;
  play: () => Promise<void>;
  pause: () => Promise<void>;
  playTracks: (tracks: Track[], startSec: number) => Promise<void>;
  // Starts a fresh recently-played chain, like every in-app surah play.
  startNewChain: (reciter: Reciter, surahId: number, rewayatId: string) => void;
  lastSurahForReciter: (reciterId: string) => number | null;
  // Index of a matching queued track after the current one.
  upNextIndexOf: (key: TrackKey) => number | null;
  playQueueIndex: (index: number, startSec?: number) => Promise<void>;
  findRecent: (key: TrackKey) => RecentMatch | null;
  resumeRecent: (match: RecentMatch) => Promise<void>;
  resumeChain: (recentIndex: number) => void;
  ayahStartSec: (
    rewayatId: string,
    surahId: number,
    ayah: number,
  ) => Promise<number | null>;
}

// The widget sends a Hafs ayah; a timing set's entry numbers are its own
// (rewayah) numbers, so translate through the surah's numbering.
export function ayahStartSecFromNumbering(
  numbering: TimingNumbering,
  ayah: number,
): number | null {
  if (numbering.mode === 'disabled') return null;
  const entry = numbering.startEntryForHafsAyah(ayah);
  return entry ? entry.timestampFrom / 1000 : null;
}

export function defaultDeps(): CommandDeps {
  return {
    getReciter: id => getReciterByIdSync(id),
    getDefaultReciter: () => {
      const r = useReciterStore.getState().defaultReciter;
      return r.id === '' ? null : r;
    },
    playbackState: () => usePlayerStore.getState().playback.state,
    hasCurrentTrack: () => {
      const {queue} = usePlayerStore.getState();
      return queue.tracks[queue.currentIndex] !== undefined;
    },
    isAudioLoaded: () => expoAudioService.getIsLoaded(),
    loadAndPlayCurrent: async () => {
      // Let restoreSession's background load settle first, so it cannot
      // replace the source after we start playing.
      await pendingRestoreLoad();
      const store = usePlayerStore.getState();
      if (expoAudioService.getIsLoaded()) {
        await store.play();
        return;
      }
      await store.updateQueue(
        store.queue.tracks,
        store.queue.currentIndex,
        store.playback.position,
      );
    },
    play: () => usePlayerStore.getState().play(),
    pause: () => usePlayerStore.getState().pause(),
    playTracks: async (tracks, startSec) => {
      const store = usePlayerStore.getState();
      await store.updateQueue(tracks, 0, startSec);
      await store.play();
    },
    startNewChain: (reciter, surahId, rewayatId) => {
      const surah = getSurahById(surahId);
      if (!surah) return;
      useRecentlyPlayedStore
        .getState()
        .startNewChain(reciter, surah, 0, 0, rewayatId);
    },
    lastSurahForReciter: reciterId => {
      const hit = useRecentlyPlayedStore
        .getState()
        .recentTracks.find(r => r.reciter.id === reciterId);
      return hit ? hit.surah.id : null;
    },
    upNextIndexOf: key => {
      const {queue} = usePlayerStore.getState();
      const i = queue.tracks.findIndex(
        (t, idx) => idx > queue.currentIndex && trackMatches(t, key),
      );
      return i === -1 ? null : i;
    },
    playQueueIndex: (index, startSec = 0) => {
      const store = usePlayerStore.getState();
      return store.updateQueue(store.queue.tracks, index, startSec);
    },
    resumeChain: recentIndex =>
      useRecentlyPlayedStore.getState().resumeChain(recentIndex),
    findRecent: key => {
      const recentTracks = useRecentlyPlayedStore.getState().recentTracks;
      const recentIndex = recentTracks.findIndex(
        r =>
          !r.isUserUpload &&
          r.reciter.id === key.reciterId &&
          r.surah.id === key.surahId &&
          (r.rewayatId || null) === key.rewayatId,
      );
      if (recentIndex === -1) return null;
      const entry = recentTracks[recentIndex];
      const {queue, playback} = usePlayerStore.getState();
      const current = queue.tracks[queue.currentIndex];
      // Same rule as RecentReciterCard: the live position wins for the
      // current track, otherwise the saved progress.
      const startPosition =
        current && trackMatches(current, key) && playback.position >= 0
          ? playback.position
          : entry.progress * entry.duration;
      return {...key, startPosition, recentIndex};
    },
    resumeRecent: match =>
      resumeRecent({
        reciterId: match.reciterId,
        surahId: match.surahId,
        rewayatId: match.rewayatId ?? undefined,
        startPosition: match.startPosition,
        recentIndex: match.recentIndex,
        updateQueue: (tracks, index, start) =>
          usePlayerStore.getState().updateQueue(tracks, index, start),
      }),
    ayahStartSec: async (rewayatId, surahId, ayah) => {
      const list = await timestampService.getTimestampsForSurah(
        rewayatId,
        surahId,
      );
      if (!list) return null;
      const numbering = await timingNumberingService.resolve(
        rewayatId,
        surahId,
        list,
      );
      return ayahStartSecFromNumbering(numbering, ayah);
    },
  };
}

// Widgets send rewayatId null for the default reciter. rewayat[0] may not have
// the surah (Mishary's first rewayah has 6), so pick the fullest one that does.
// A command with an ayah carries a Hafs verse number, so prefer a Hafs set.
function rewayatForSurah(
  reciter: Reciter,
  surahId: number,
  hafsAyah: boolean,
): string | undefined {
  const withSurah = reciter.rewayat.filter(r => r.surah_list.includes(surahId));
  if (withSurah.length === 0) return undefined;
  const hafs = hafsAyah
    ? withSurah.filter(r => resolveRewayahFromName(r.name) === 'hafs')
    : [];
  const pool = hafs.length > 0 ? hafs : withSurah;
  return pool.reduce((best, r) => (r.surah_total > best.surah_total ? r : best))
    .id;
}

export async function playSurah(
  reciter: Reciter,
  surahId: number,
  rewayatId: string | null,
  ayah: number | null,
  deps: CommandDeps,
): Promise<boolean> {
  const surah = getSurahById(surahId);
  if (!surah) return false;
  const track = await createTrack(
    reciter,
    surah,
    rewayatId ?? rewayatForSurah(reciter, surahId, ayah !== null),
  );
  const resolvedRewayat = track.rewayatId ?? reciter.rewayat[0]?.id;
  // Ayah 1 means the start of the surah (a widget's "from the beginning").
  const startSec =
    ayah !== null && ayah > 1 && resolvedRewayat
      ? (await deps.ayahStartSec(resolvedRewayat, surahId, ayah)) ?? 0
      : 0;
  await deps.playTracks([track], startSec);
  if (resolvedRewayat) deps.startNewChain(reciter, surahId, resolvedRewayat);
  return true;
}

// States where audio is playing or about to: a play request is a no-op.
function isStarting(state: PlayerState): boolean {
  return state === 'playing' || state === 'loading' || state === 'buffering';
}

async function setPlayback(playing: boolean, deps: CommandDeps): Promise<void> {
  if (!deps.hasCurrentTrack()) return;
  if (!playing) {
    // Pause regardless of state: after updateQueue the store sits at 'ready'
    // until the next status tick even though audio is playing.
    await deps.pause();
    return;
  }
  if (isStarting(deps.playbackState())) return;
  if (!deps.isAudioLoaded()) {
    await deps.loadAndPlayCurrent();
    return;
  }
  await deps.play();
}

export async function handleWidgetCommand(
  command: WidgetCommand,
  deps: CommandDeps = defaultDeps(),
): Promise<void> {
  switch (command.type) {
    case 'setPlayback':
      await setPlayback(command.playing, deps);
      return;
    case 'playTrack': {
      const reciter = command.reciterId
        ? deps.getReciter(command.reciterId)
        : deps.getDefaultReciter();
      if (!reciter) return;
      // A row tap continues instead of restarting: jump within the queue,
      // or resume a recently played entry at its saved position.
      if (command.ayah === null) {
        const key: TrackKey = {
          reciterId: reciter.id,
          surahId: command.surahId,
          rewayatId: command.rewayatId,
        };
        const queued = deps.upNextIndexOf(key);
        const recent = deps.findRecent(key);
        if (queued !== null && recent) {
          // Keep the queue but resume at the saved position.
          await deps.playQueueIndex(queued, recent.startPosition);
          deps.resumeChain(recent.recentIndex);
          return;
        }
        if (queued !== null) {
          await deps.playQueueIndex(queued);
          return;
        }
        if (recent) {
          await deps.resumeRecent(recent);
          return;
        }
      }
      await playSurah(
        reciter,
        command.surahId,
        command.rewayatId,
        command.ayah,
        deps,
      );
      return;
    }
    case 'playReciter': {
      const reciter = deps.getReciter(command.reciterId);
      if (!reciter) return;
      const surahId =
        deps.lastSurahForReciter(reciter.id) ?? DEFAULT_SURAH_FOR_RECITER;
      await playSurah(reciter, surahId, null, null, deps);
      return;
    }
    case 'playPlaylist':
    case 'startBedtime': {
      if (!contentRunner) {
        console.error(
          '[WidgetCommand] No content command runner registered; dropped',
          command.type,
        );
        return;
      }
      await contentRunner(command, (reciter, surahId) =>
        playSurah(reciter, surahId, null, null, deps),
      );
      return;
    }
  }
}
