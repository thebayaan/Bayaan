import {Platform} from 'react-native';
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
import {
  skipAdhkarTrack,
  type TrackDirection,
} from '@/services/adhkar/playback/trackControls';
import {expoAudioService} from '@/services/audio/ExpoAudioService';
import {startCarAyahTracker} from '@/services/car/carAyah';
import {getTrackArtistDisplay, getTrackDisplayTitle} from '@/i18n/format'; // @ai
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
  // @ai-start
  // The names as the app shows them (Arabic when the app is in Arabic):
  // tracks are queued with the English surah and reciter names.
  const artist = getTrackArtistDisplay(track);
  // @ai-end
  return {
    title: getTrackDisplayTitle(track), // @ai
    subtitle: ayahLabel ? `${artist} · ${ayahLabel}` : artist, // @ai
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
      title: getTrackDisplayTitle(t), // @ai
      subtitle: getTrackArtistDisplay(t), // @ai
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

// @ai-start
/** The same recitation: the same upload, or reciter, rewayah and surah. */
function sameRecitation(a: Track, b: Track): boolean {
  if (a.isUserUpload || b.isUserUpload) {
    return (
      a.isUserUpload === true &&
      b.isUserUpload === true &&
      !!a.userRecitationId &&
      a.userRecitationId === b.userRecitationId
    );
  }
  return (
    a.reciterId === b.reciterId &&
    a.surahId === b.surahId &&
    (a.rewayatId || null) === (b.rewayatId || null)
  );
}

export interface LivePlayback {
  /** The player's current track. */
  current: Track | undefined;
  /** The player's position in it, in seconds. */
  position: number;
  /** The recent cards as they are now. */
  recentTracks: RecentlyPlayedTrack[];
}

/**
 * Where a resume really starts, in seconds.
 *
 * The plan's position comes from the snapshot the car is showing, which is
 * only rebuilt when a recent card's progress moves by a tenth of the surah.
 * Resuming from it jumped back by up to a tenth of the surah: several
 * minutes, on a long one. The player's own position wins when it already
 * holds this recitation (the rule the phone's recent cards and the widget
 * use), then the recent card as it is now, and the plan only when neither
 * knows it.
 */
export function liveResumePosition(
  first: Track,
  planPosition: number,
  live: LivePlayback,
): number {
  if (
    live.current &&
    sameRecitation(live.current, first) &&
    Number.isFinite(live.position) &&
    live.position >= 0
  ) {
    return live.position;
  }
  const recent = live.recentTracks.find(t =>
    first.isUserUpload
      ? t.isUserUpload === true &&
        !!first.userRecitationId &&
        t.userRecitationId === first.userRecitationId
      : !t.isUserUpload &&
        t.reciter.id === first.reciterId &&
        String(t.surah.id) === first.surahId &&
        (t.rewayatId || null) === (first.rewayatId || null),
  );
  return recent && recent.duration > 0
    ? recent.progress * recent.duration
    : planPosition;
}
// @ai-end

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
  // @ai-start
  // A resume (the Resume card, a Jump back in row) starts where the
  // listener really is, not where the snapshot last saw them.
  const resumes =
    request.kind === 'resume' ||
    (request.kind === 'surah' && request.startAt !== undefined);
  let startPosition = plan.startPosition;
  if (resumes && first) {
    const {queue, playback} = usePlayerStore.getState();
    startPosition = liveResumePosition(first, plan.startPosition, {
      current: queue.tracks[queue.currentIndex],
      position: playback.position,
      recentTracks: useRecentlyPlayedStore.getState().recentTracks,
    });
  }
  // @ai-end
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
      startPosition, // @ai
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
  await player.updateQueue(ordered, startIndex, startPosition); // @ai
  await player.play();
  // The phone's Uploads screen records the upload after it starts playing.
  if (plan.chain === 'new' && firstUpload) {
    addUploadToRecentlyPlayed(firstUpload);
  }
}

// "Ayah 12 of 110" while a car is connected and the reciter has timestamps.
let currentAyahLabel: string | null = null;

/** What the loved store is asked about one recitation. */
type LovedArgs = [
  reciterId: string,
  surahId: string,
  rewayatId: string,
  userRecitationId?: string,
];

/**
 * The car's heart asks about a track the way the player's heart does: an
 * upload by its own id (it is saved without a rewayah), anything else by
 * reciter, surah and rewayah. Asked by reciter, surah and rewayah, a loved
 * upload showed as not loved and the love button loved the catalogue
 * recording of that surah instead. Null when the track cannot be loved.
 */
function lovedArgs(track: Track | undefined): LovedArgs | null {
  if (!track?.surahId) return null;
  if (track.userRecitationId) {
    return track.reciterId
      ? [track.reciterId, track.surahId, '', track.userRecitationId]
      : null;
  }
  return track.rewayatId
    ? [track.reciterId, track.surahId, track.rewayatId]
    : null;
}

function pushNowPlaying(): void {
  const player = usePlayerStore.getState();
  const track = player.queue.tracks[player.queue.currentIndex];
  const loved = lovedArgs(track);
  const isLoved = loved
    ? useLovedStore.getState().isLovedWithRewayat(...loved)
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

/**
 * Car next / previous while the adhkar session holds the lock screen move the
 * session, not the Quran queue. True when handled. On iOS the remote command
 * center is shared: when the adhkar entry shows its own next / previous, the
 * same press already reached it, so it is not applied twice.
 */
function adhkarTookTrackTransport(direction: TrackDirection): boolean {
  if (!lockScreenService.isAdhkarHeld()) return false;
  if (Platform.OS === 'ios' && lockScreenService.hasAdhkarTrackControls())
    return true;
  skipAdhkarTrack(direction);
  return true;
}

async function handleTransport(transport: CarTransport): Promise<void> {
  const player = usePlayerStore.getState();
  switch (transport.kind) {
    case 'next':
      if (adhkarTookTrackTransport('next')) return;
      // @ai Verse audio from the Mushaf holds Now Playing: move by verse.
      if (lockScreenService.skipMushafVerseIfHeld(true)) return; // @ai
      return player.skipToNext();
    case 'previous':
      if (adhkarTookTrackTransport('previous')) return;
      if (lockScreenService.skipMushafVerseIfHeld(false)) return; // @ai
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
      const loved = lovedArgs(player.queue.tracks[player.queue.currentIndex]);
      if (loved) useLovedStore.getState().toggleLoved(...loved);
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
      // CarPlay re-enables next / previous on a now playing push, after car
      // mode took them off the adhkar entry.
      pushNowPlaying();
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
