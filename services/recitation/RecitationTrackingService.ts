import {AppState, type NativeEventSubscription} from 'react-native';
import type {SearchHint, WorkerOutbound} from '@tilawa/core';
import {
  RECITATION_TRACKING_IDLE,
  useRecitationTrackingStore,
} from '@/store/recitationTrackingStore';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {analyticsService} from '@/services/analytics/AnalyticsService';
import type {RecitationStopReason} from '@/services/analytics/events';
import {useMushafPlayerStore} from '@/store/mushafPlayerStore';
import {
  deleteRecitationAssets,
  ensureRecitationAssets,
  getRecitationAssets,
  type RecitationAssetPaths,
} from './recitationAssets';
import {
  createRecitationEngine,
  type RecitationEngine,
} from './recitationEngine';
import {nextRevealed} from './reveal';
import {
  requestMicPermission,
  startMicStream,
  type MicStream,
} from './micStream';

// Follows a live recitation and publishes the ayah and word being recited to
// useRecitationTrackingStore. The model stays loaded between takes.

let engine: RecitationEngine | null = null;
let unloadTimer: ReturnType<typeof setTimeout> | null = null;
let memoryWarningSub: NativeEventSubscription | null = null;

// The model holds ~100 to 150 MB once loaded. Keep it between takes, drop it
// once the reader has been idle this long.
const IDLE_UNLOAD_MS = 5 * 60 * 1000;
let mic: MicStream | null = null;
let appStateSub: NativeEventSubscription | null = null;
// Bumped by stop() so a start() still loading knows it was cancelled.
let generation = 0;

// The current take, for analytics.
let takeStartedAt = 0;
let takeLockedAt: number | null = null;
let takeHint: SearchHint | null = null;

function setState(
  patch: Partial<ReturnType<typeof useRecitationTrackingStore.getState>>,
): void {
  useRecitationTrackingStore.setState(patch);
}

// Engine events (sent as debug messages) that move between searching for
// the reader's place and following it.
const LOCK_EVENTS = new Set(['located', 'relocated']);
const UNLOCK_EVENTS = new Set(['lost', 'idle', 'locateFailed', 'completed']);

function handleEvent(msg: WorkerOutbound): void {
  const state = useRecitationTrackingStore.getState();
  // stop() flushes the tail after the highlight is cleared; drop those.
  if (state.status !== 'listening') return;
  if (msg.type === 'word_progress') {
    if (takeLockedAt === null) {
      takeLockedAt = Date.now();
      analyticsService.trackRecitationTrackingLocked({
        time_to_lock_ms: takeLockedAt - takeStartedAt,
        surah_id: msg.surah,
        ayah: msg.ayah,
        page_hint_matched: takeHint?.surah === msg.surah,
      });
    }
    const key = `${msg.surah}:${msg.ayah}`;
    setState({
      locked: true,
      revealed: nextRevealed(
        state.revealed,
        state.verseKey,
        key,
        msg.word_index,
        msg.total_words,
      ),
      verseKey: key,
      wordIndex: msg.word_index,
      totalWords: msg.total_words,
    });
    return;
  }
  if (msg.type === 'verse_match') {
    const key = `${msg.surah}:${msg.ayah}`;
    if (!state.recitedVerseKeys.includes(key)) {
      setState({recitedVerseKeys: [...state.recitedVerseKeys, key]});
    }
    return;
  }
  if (msg.type !== 'debug') return;
  if (LOCK_EVENTS.has(msg.event)) setState({locked: true});
  if (UNLOCK_EVENTS.has(msg.event)) setState({locked: false});
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Whether the ~75 MB model still has to be downloaded before start(). */
export async function recitationModelNeedsDownload(): Promise<boolean> {
  return (await getRecitationAssets()) === null;
}

/** Pauses Bayaan's own Quran audio; true when something was playing. */
function pauseQuranAudio(): boolean {
  let paused = false;
  const player = usePlayerStore.getState();
  if (player.playback.state === 'playing') {
    player.pause();
    paused = true;
  }
  const mushafPlayer = useMushafPlayerStore.getState();
  if (mushafPlayer.playbackState !== 'idle') {
    mushafPlayer.stop();
    paused = true;
  }
  return paused;
}

// expo-audio deactivates the iOS audio session ~100 ms after a pause when
// nothing else plays; starting the mic inside that window kills it.
const AFTER_PAUSE_MS = 300;
// No chunk for this long while listening means the mic died (interruption,
// route change, media services reset).
const MIC_SILENT_MS = 3000;

let lastChunkAt = 0;
let watchdog: ReturnType<typeof setInterval> | null = null;

function fail(message: string, reason: RecitationStopReason): void {
  void stopRecitationTracking(reason).then(() =>
    setState({status: 'error', error: message, errorKind: 'other'}),
  );
}

/**
 * Starts listening, downloading and loading the model first if needed.
 * @param hint - The ayah on screen, so the first lock favours this page
 */
export async function startRecitationTracking(
  hint: SearchHint | null,
): Promise<void> {
  const {status} = useRecitationTrackingStore.getState();
  if (status !== 'off' && status !== 'error') return;
  const run = ++generation;
  setState({...RECITATION_TRACKING_IDLE, status: 'loading'});
  let stage: 'download' | 'model_load' | 'mic' = 'model_load';
  try {
    if (!(await requestMicPermission())) {
      analyticsService.trackRecitationTrackingError({
        stage: 'permission',
        error_message: 'denied',
      });
      setState({
        ...RECITATION_TRACKING_IDLE,
        status: 'error',
        error: 'Allow microphone access for Bayaan in Settings to recite.',
        errorKind: 'permission',
      });
      return;
    }
    cancelUnload();
    const modelLoaded = engine !== null;
    if (!engine) {
      let assets = await getRecitationAssets();
      if (!assets) {
        stage = 'download';
        setState({status: 'downloading'});
        assets = await downloadModel();
        setState({status: 'loading'});
        stage = 'model_load';
      }
      engine = await createRecitationEngine(assets, handleEvent);
      memoryWarningSub ??= AppState.addEventListener('memoryWarning', () => {
        if (useRecitationTrackingStore.getState().status !== 'listening') {
          void unloadRecitationModel();
        }
      });
    }
    if (run !== generation) return;
    if (pauseQuranAudio()) {
      await new Promise(resolve => setTimeout(resolve, AFTER_PAUSE_MS));
      if (run !== generation) return;
    }
    stage = 'mic';
    const active = engine;
    active.reset();
    active.setHint(hint);
    lastChunkAt = Date.now();
    mic = await startMicStream(
      pcm => {
        lastChunkAt = Date.now();
        active.feed(pcm);
      },
      () =>
        fail(
          'Recitation stopped because another app used audio.',
          'interruption',
        ),
    );
    if (run !== generation) {
      await mic.stop();
      mic = null;
      return;
    }
    appStateSub = AppState.addEventListener('change', next => {
      if (next !== 'active') void stopRecitationTracking('background');
    });
    watchdog = setInterval(() => {
      if (Date.now() - lastChunkAt > MIC_SILENT_MS) {
        fail(
          'The microphone stopped. Tap the mic to start again.',
          'mic_silent',
        );
      }
    }, 1000);
    takeStartedAt = Date.now();
    takeLockedAt = null;
    takeHint = hint;
    analyticsService.trackRecitationTrackingStarted({
      hint_surah_id: hint?.surah ?? null,
      model_loaded: modelLoaded,
    });
    setState({status: 'listening'});
  } catch (error) {
    if (run !== generation) return;
    analyticsService.trackRecitationTrackingError({
      stage,
      error_message: messageOf(error),
    });
    setState({
      ...RECITATION_TRACKING_IDLE,
      status: 'error',
      error: messageOf(error),
      errorKind: 'other',
    });
  }
}

async function downloadModel(): Promise<RecitationAssetPaths> {
  const startedAt = Date.now();
  try {
    const assets = await ensureRecitationAssets(progress =>
      setState({downloadProgress: progress}),
    );
    analyticsService.trackRecitationModelDownloaded({
      outcome: 'completed',
      duration_ms: Date.now() - startedAt,
      error_message: null,
    });
    return assets;
  } catch (error) {
    analyticsService.trackRecitationModelDownloaded({
      outcome: 'failed',
      duration_ms: Date.now() - startedAt,
      error_message: messageOf(error),
    });
    throw error;
  }
}

function trackTakeStopped(reason: RecitationStopReason): void {
  const stats = engine?.getStats();
  analyticsService.trackRecitationTrackingStopped({
    duration_ms: Date.now() - takeStartedAt,
    locked: takeLockedAt !== null,
    ayat_recited: useRecitationTrackingStore.getState().recitedVerseKeys.length,
    stop_reason: reason,
    rtf:
      stats && stats.audioSeconds > 0
        ? Math.round((stats.busyMs / 1000 / stats.audioSeconds) * 1000) / 1000
        : 0,
    max_feed_ms: stats ? Math.round(stats.maxFeedMs) : 0,
    load_ms: stats ? Math.round(stats.loadMs) : 0,
  });
}

/** Stops listening and clears the highlight. Safe to call when idle. */
export async function stopRecitationTracking(
  reason: RecitationStopReason = 'user',
): Promise<void> {
  if (useRecitationTrackingStore.getState().status === 'listening') {
    trackTakeStopped(reason);
  }
  generation++;
  appStateSub?.remove();
  appStateSub = null;
  if (watchdog) clearInterval(watchdog);
  watchdog = null;
  const stream = mic;
  mic = null;
  setState(RECITATION_TRACKING_IDLE);
  if (stream) await stream.stop();
  if (engine) await engine.stop();
  scheduleUnload(IDLE_UNLOAD_MS);
}

function cancelUnload(): void {
  if (unloadTimer) clearTimeout(unloadTimer);
  unloadTimer = null;
}

/** Unloads the model after `delayMs` unless a take starts first. */
export function scheduleUnload(delayMs: number): void {
  cancelUnload();
  if (!engine) return;
  unloadTimer = setTimeout(() => {
    unloadTimer = null;
    void unloadRecitationModel();
  }, delayMs);
}

/** Releases the loaded model; the next take loads it again (~1 to 2 s). */
export async function unloadRecitationModel(): Promise<void> {
  cancelUnload();
  if (useRecitationTrackingStore.getState().status !== 'off') return;
  const loaded = engine;
  engine = null;
  memoryWarningSub?.remove();
  memoryWarningSub = null;
  if (loaded) await loaded.dispose();
}

/** Stops listening, unloads the model and deletes the downloaded files. */
export async function removeRecitationModel(): Promise<void> {
  await stopRecitationTracking('model_removed');
  await unloadRecitationModel();
  await deleteRecitationAssets();
}

/** Re-points the search bias, e.g. when the reader turns the page by hand. */
export function setRecitationHint(hint: SearchHint | null): void {
  engine?.setHint(hint);
}
