import {AppState, type NativeEventSubscription} from 'react-native';
import type {SearchHint, WorkerOutbound} from '@tilawa/core';
import {
  RECITATION_TRACKING_IDLE,
  useRecitationTrackingStore,
} from '@/store/recitationTrackingStore';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {useMushafPlayerStore} from '@/store/mushafPlayerStore';
import {ensureRecitationAssets, getRecitationAssets} from './recitationAssets';
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

function handleEvent(msg: WorkerOutbound): void {
  if (msg.type !== 'word_progress') return;
  // stop() flushes the tail after the highlight is cleared; drop those.
  if (useRecitationTrackingStore.getState().status !== 'listening') return;
  setState({
    verseKey: `${msg.surah}:${msg.ayah}`,
    wordIndex: msg.word_index,
    totalWords: msg.total_words,
  });
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Whether the ~75 MB model still has to be downloaded before start(). */
export async function recitationModelNeedsDownload(): Promise<boolean> {
  return (await getRecitationAssets()) === null;
}

function pauseQuranAudio(): void {
  const player = usePlayerStore.getState();
  if (player.playback.state === 'playing') player.pause();
  const mushafPlayer = useMushafPlayerStore.getState();
  if (mushafPlayer.playbackState !== 'idle') mushafPlayer.stop();
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
      throw new Error('Microphone access is off for Bayaan');
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
    pauseQuranAudio();
    const active = engine;
    active.reset();
    active.setHint(hint);
    mic = await startMicStream(pcm => active.feed(pcm));
    if (run !== generation) {
      await mic.stop();
      mic = null;
      return;
    }
    appStateSub = AppState.addEventListener('change', next => {
      if (next !== 'active') void stopRecitationTracking();
    });
    setState({status: 'listening'});
  } catch (error) {
    if (run !== generation) return;
    setState({
      ...RECITATION_TRACKING_IDLE,
      status: 'error',
      error: messageOf(error),
    });
  }
}

/** Stops listening and clears the highlight. Safe to call when idle. */
export async function stopRecitationTracking(): Promise<void> {
  generation++;
  appStateSub?.remove();
  appStateSub = null;
  const stream = mic;
  mic = null;
  setState(RECITATION_TRACKING_IDLE);
  if (stream) await stream.stop();
  if (engine) await engine.stop();
}

/** Re-points the search bias, e.g. when the reader turns the page by hand. */
export function setRecitationHint(hint: SearchHint | null): void {
  engine?.setHint(hint);
}
