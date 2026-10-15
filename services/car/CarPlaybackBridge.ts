import {BayaanCar} from '@/modules/bayaan-car';
import {RECITERS} from '@/data/reciterData';
import {SURAHS} from '@/data/surahData';
import {getSystemPlaylists} from '@/data/systemPlaylists';
import {Track} from '@/types/audio';
import {
  addUploadToRecentlyPlayed,
  createTrack,
  createUserUploadTrack,
  shuffleTracks,
} from '@/utils/track';
import type {UploadedRecitation} from '@/types/uploads';
import {lockScreenService} from '@/services/audio/LockScreenService';
import {expoAudioService} from '@/services/audio/ExpoAudioService';
import {startCarAyahTracker} from '@/services/car/carAyah';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {
  RecentlyPlayedTrack,
  useRecentlyPlayedStore,
} from '@/services/player/store/recentlyPlayedStore';
import {useLovedStore} from '@/services/player/store/lovedStore';
import {useDownloadStore} from '@/services/player/store/downloadStore';
import {PlayerState, RepeatMode} from '@/services/player/types/state';
import {
  resolveCarRequest,
  CarPlanTrack,
  isUploadSpec,
} from '@/services/car/playback/resolveCarRequest';
import {
  getLastResolveContext,
  writeCarSnapshotNow,
} from '@/services/car/CarSnapshotService';
import {
  markCarReplacedQueue,
  waitForSessionRestored,
} from '@/services/car/sessionGate';
import {
  CarNowPlaying,
  CarPlayRequest,
  CarTransport,
} from '@/services/car/types';

const RATES = [1, 1.25, 1.5, 0.75];
// A hung session restore must not block car requests forever.
export const SESSION_RESTORE_TIMEOUT_MS = 5000;
/**
 * On iOS the player attaches when the phone layout renders, which can be
 * after boot (fonts); a request flushed before that would fail to load.
 */
export const PLAYER_READY_TIMEOUT_MS = 10_000;

export function nextRate(current: number): number {
  const index = RATES.indexOf(current);
  if (index === -1) return 1;
  return RATES[(index + 1) % RATES.length];
}

export function nextRepeat(current: RepeatMode): RepeatMode {
  if (current === 'none') return 'queue';
  if (current === 'queue') return 'track';
  return 'none';
}

interface QueueView {
  tracks: Track[];
  currentIndex: number;
}

interface PlaybackView {
  state: PlayerState;
  position: number;
  duration: number;
  rate: number;
}

function surahNumber(track: Track): number | null {
  const n = Number(track.surahId);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export function toNowPlaying(
  queue: QueueView,
  playback: PlaybackView,
  repeatMode: RepeatMode,
  isLoved: boolean,
  ayahLabel: string | null = null,
): CarNowPlaying | null {
  const track = queue.tracks[queue.currentIndex];
  if (!track) return null;
  const surahId = surahNumber(track);
  return {
    title: track.title,
    subtitle: ayahLabel ? `${track.artist} · ${ayahLabel}` : track.artist,
    reciterId: track.reciterId || null,
    surahId,
    isPlaying: playback.state === 'playing',
    position: playback.position,
    duration: playback.duration,
    rate: playback.rate,
    repeatMode,
    isLoved,
    artwork: surahId !== null ? {kind: 'surah', surahId} : null,
    queue: queue.tracks.map(t => ({
      title: t.title,
      subtitle: t.artist,
      surahId: surahNumber(t),
    })),
    currentIndex: queue.currentIndex,
  };
}

export interface ChainProgress {
  progress: number;
  duration: number;
}

/**
 * Progress for a new recent entry. A request that resumes mid-surah (a Jump
 * back in row) keeps the recent entry's progress, so the car's progress bar
 * does not reset to empty until the next playback tick rebuilds the snapshot.
 */
export function carriedProgress(
  recentTracks: RecentlyPlayedTrack[],
  reciterId: string,
  surahId: number,
  startPosition: number,
): ChainProgress {
  if (!(startPosition > 0)) return {progress: 0, duration: 0};
  const recent = recentTracks.find(
    t =>
      !t.isUserUpload &&
      t.reciter.id === reciterId &&
      t.surah.id === surahId &&
      t.duration > 0,
  );
  if (!recent) return {progress: 0, duration: 0};
  return {
    progress: Math.min(1, startPosition / recent.duration),
    duration: recent.duration,
  };
}

async function specToTrack(
  spec: CarPlanTrack,
  uploads: UploadedRecitation[],
): Promise<Track | null> {
  if (isUploadSpec(spec)) {
    const upload = uploads.find(u => u.id === spec.uploadId);
    return upload ? createUserUploadTrack(upload) : null;
  }
  const reciter = RECITERS.find(r => r.id === spec.reciterId);
  const surah = SURAHS.find(s => s.id === spec.surahId);
  if (!reciter || !surah) return null;
  return createTrack(reciter, surah, spec.rewayatId);
}

export async function executeCarRequest(
  request: CarPlayRequest,
): Promise<void> {
  // Resolve against the data the last snapshot was built from, so startIndex
  // stays aligned with the list the car is showing.
  let ctx = getLastResolveContext();
  if (!ctx) {
    await writeCarSnapshotNow();
    ctx = getLastResolveContext();
  }
  if (!ctx) return;
  const plan = resolveCarRequest(request, ctx);
  if (!plan) return;

  const uploads = ctx.uploads;
  const built = await Promise.all(
    plan.tracks.map(spec => specToTrack(spec, uploads)),
  );
  const tracks = built.filter((t): t is Track => t !== null);
  if (tracks.length === 0) return;

  // Dropped specs shift indices, so recompute the start within survivors.
  const droppedBeforeStart = built
    .slice(0, plan.startIndex)
    .filter(t => t === null).length;
  const alignedStart = Math.min(
    plan.startIndex - droppedBeforeStart,
    tracks.length - 1,
  );

  const ordered = plan.shuffle ? shuffleTracks(tracks) : tracks;
  const startIndex = plan.shuffle ? 0 : alignedStart;

  // The track that will actually play first.
  const first = ordered[startIndex];
  const reciter = RECITERS.find(r => r.id === first?.reciterId);
  const surah = SURAHS.find(s => String(s.id) === first?.surahId);
  const firstUpload = first?.isUserUpload
    ? uploads.find(u => u.id === first.userRecitationId)
    : undefined;
  if (
    plan.chain === 'new' &&
    !first?.isUserUpload &&
    first?.rewayatId &&
    reciter &&
    surah
  ) {
    const carried = carriedProgress(
      ctx.recentTracks,
      reciter.id,
      surah.id,
      plan.startPosition,
    );
    useRecentlyPlayedStore
      .getState()
      .startNewChain(
        reciter,
        surah,
        carried.progress,
        carried.duration,
        first.rewayatId,
      );
  }
  if (plan.chain === 'resume') {
    useRecentlyPlayedStore.getState().resumeChain(plan.recentIndex ?? 0);
  }

  // Tell restoreSession the car owns the queue now, so a late restore does
  // not overwrite it or swap the audio under it.
  markCarReplacedQueue();
  const player = usePlayerStore.getState();
  await player.updateQueue(ordered, startIndex, plan.startPosition);
  await player.play();
  // The phone's Uploads screen records the upload after it starts playing.
  if (plan.chain === 'new' && firstUpload) {
    addUploadToRecentlyPlayed(firstUpload);
  }
}

// "Ayah 12 of 110" while a car is connected and the reciter has timestamps.
let currentAyahLabel: string | null = null;

function pushNowPlaying(): void {
  const player = usePlayerStore.getState();
  const track = player.queue.tracks[player.queue.currentIndex];
  const isLoved =
    track?.surahId && track.rewayatId
      ? useLovedStore
          .getState()
          .isLovedWithRewayat(track.reciterId, track.surahId, track.rewayatId)
      : false;
  BayaanCar.setNowPlaying(
    toNowPlaying(
      player.queue,
      player.playback,
      player.settings.repeatMode,
      isLoved,
      currentAyahLabel,
    ),
  );
}

async function handleTransport(transport: CarTransport): Promise<void> {
  const player = usePlayerStore.getState();
  switch (transport.kind) {
    case 'next':
      return player.skipToNext();
    case 'previous':
      return player.skipToPrevious();
    case 'play':
      return player.play();
    case 'pause':
      return player.pause();
    case 'seek':
      await player.seekTo(transport.position);
      // Position is extrapolated natively; resync after a seek.
      pushNowPlaying();
      return;
    case 'rate':
      return player.setRate(transport.value);
    case 'cycleRate':
      return player.setRate(nextRate(player.playback.rate));
    case 'cycleRepeat':
      player.setRepeatMode(nextRepeat(player.settings.repeatMode));
      return;
    case 'jumpTo':
      if (transport.index >= player.queue.tracks.length) return;
      return player.updateQueue(player.queue.tracks, transport.index);
    case 'toggleLove': {
      const track = player.queue.tracks[player.queue.currentIndex];
      if (!track?.surahId || !track.rewayatId) return;
      useLovedStore
        .getState()
        .toggleLoved(track.reciterId, track.surahId, track.rewayatId);
      return;
    }
  }
}

export function startCarPlaybackBridge(
  snapshotReady: Promise<void>,
): () => void {
  if (!BayaanCar.isAvailable) return () => {};
  let lastKey = '';
  let lastTracks: Track[] | null = null;
  let stopAyahTracker: (() => void) | null = null;
  let tracksKey = '';
  const unsubscribers = [
    BayaanCar.addPlayRequestListener(request => {
      executeCarRequest(request).catch(error => {
        if (__DEV__)
          console.warn('[CarPlaybackBridge] play request failed', error);
      });
    }),
    BayaanCar.addTransportListener(transport => {
      handleTransport(transport).catch(error => {
        if (__DEV__)
          console.warn('[CarPlaybackBridge] transport failed', error);
      });
    }),
    usePlayerStore.subscribe(state => {
      // Position ticks are extrapolated natively; only push on meaningful changes.
      if (state.queue.tracks !== lastTracks) {
        lastTracks = state.queue.tracks;
        tracksKey = state.queue.tracks.map(t => t.id).join(',');
      }
      const key = [
        state.queue.currentIndex,
        tracksKey,
        state.playback.state,
        state.playback.rate,
        state.settings.repeatMode,
        Math.round(state.playback.duration),
      ].join('|');
      if (key === lastKey) return;
      lastKey = key;
      pushNowPlaying();
    }),
    useLovedStore.subscribe(pushNowPlaying),
    BayaanCar.addConnectionListener(connected => {
      lockScreenService.setCarMode(connected);
      stopAyahTracker?.();
      stopAyahTracker = connected
        ? startCarAyahTracker(label => {
            currentAyahLabel = label;
            lockScreenService.setCarAyahLabel(label);
            pushNowPlaying();
          })
        : null;
    }),
    () => stopAyahTracker?.(),
  ];
  pushNowPlaying();
  // Listeners are attached; only now let native flush queued cold-start
  // requests, and only after the first snapshot exists to resolve against,
  // the last session has been restored and a player is attached (or those
  // timed out).
  let disposed = false;
  const markReady = (): void => {
    if (!disposed) BayaanCar.markJsReady();
  };
  Promise.all([
    snapshotReady.catch(() => undefined),
    waitForSessionRestored(SESSION_RESTORE_TIMEOUT_MS),
    expoAudioService.waitForPlayer(PLAYER_READY_TIMEOUT_MS),
  ]).then(markReady, markReady);
  return () => {
    disposed = true;
    unsubscribers.forEach(unsubscribe => unsubscribe());
    lockScreenService.setCarMode(false);
  };
}
