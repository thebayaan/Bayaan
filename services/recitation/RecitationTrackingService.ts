import {AppState, type NativeEventSubscription} from 'react-native';
import type {SearchHint, WorkerOutbound} from '@tilawa/core';
import {
  RECITATION_TRACKING_IDLE,
  useRecitationTrackingStore,
} from '@/store/recitationTrackingStore';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {useMushafPlayerStore} from '@/store/mushafPlayerStore';
import {
  deleteRecitationAssets,
  ensureRecitationAssets,
  getRecitationAssets,
} from './recitationAssets';
import {
  createRecitationEngine,
  type RecitationEngine,
} from './recitationEngine';
import {
  requestMicPermission,
  startMicStream,
  type MicStream,
} from './micStream';

// Follows a live recitation and publishes the ayah and word being recited to
// useRecitationTrackingStore. The model stays loaded between takes.

let engine: RecitationEngine | null = null;
let mic: MicStream | null = null;
let appStateSub: NativeEventSubscription | null = null;
// Bumped by stop() so a start() still loading knows it was cancelled.
let generation = 0;

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
    setState({
      locked: true,
      verseKey: `${msg.surah}:${msg.ayah}`,
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

function fail(message: string, kind: 'permission' | 'other'): void {
  void stopRecitationTracking().then(() =>
    setState({status: 'error', error: message, errorKind: kind}),
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
  try {
    if (!(await requestMicPermission())) {
      setState({
        ...RECITATION_TRACKING_IDLE,
        status: 'error',
        error: 'Allow microphone access for Bayaan in Settings to recite.',
        errorKind: 'permission',
      });
      return;
    }
    if (!engine) {
      let assets = await getRecitationAssets();
      if (!assets) {
        setState({status: 'downloading'});
        assets = await ensureRecitationAssets(progress =>
          setState({downloadProgress: progress}),
        );
        setState({status: 'loading'});
      }
      engine = await createRecitationEngine(assets, handleEvent);
    }
    if (run !== generation) return;
    if (pauseQuranAudio()) {
      await new Promise(resolve => setTimeout(resolve, AFTER_PAUSE_MS));
      if (run !== generation) return;
    }
    const active = engine;
    active.reset();
    active.setHint(hint);
    lastChunkAt = Date.now();
    mic = await startMicStream(
      pcm => {
        lastChunkAt = Date.now();
        active.feed(pcm);
      },
      () => fail('Recitation stopped because another app used audio.', 'other'),
    );
    if (run !== generation) {
      await mic.stop();
      mic = null;
      return;
    }
    appStateSub = AppState.addEventListener('change', next => {
      if (next !== 'active') void stopRecitationTracking();
    });
    watchdog = setInterval(() => {
      if (Date.now() - lastChunkAt > MIC_SILENT_MS) {
        fail('The microphone stopped. Tap the mic to start again.', 'other');
      }
    }, 1000);
    setState({status: 'listening'});
  } catch (error) {
    if (run !== generation) return;
    setState({
      ...RECITATION_TRACKING_IDLE,
      status: 'error',
      error: messageOf(error),
      errorKind: 'other',
    });
  }
}

/** Stops listening and clears the highlight. Safe to call when idle. */
export async function stopRecitationTracking(): Promise<void> {
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
}

/** Stops listening, unloads the model and deletes the downloaded files. */
export async function removeRecitationModel(): Promise<void> {
  await stopRecitationTracking();
  const loaded = engine;
  engine = null;
  if (loaded) await loaded.dispose();
  await deleteRecitationAssets();
}

/** Re-points the search bias, e.g. when the reader turns the page by hand. */
export function setRecitationHint(hint: SearchHint | null): void {
  engine?.setHint(hint);
}
