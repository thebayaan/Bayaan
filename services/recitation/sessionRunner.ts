import {AppState, type NativeEventSubscription} from 'react-native';
import type {
  ExpectedPassage,
  RecitationMode,
  SearchHint,
  WorkerOutbound,
} from '@tilawa/core';
import type {RecitationStopReason} from '@/services/analytics/events';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {useMushafPlayerStore} from '@/store/mushafPlayerStore';
import {useAdhkarSessionStore} from '@/store/adhkarSessionStore'; // @ai
import {deleteRecitationAssets} from './recitationAssets';
import {deleteV1Assets} from './v1/assets';
import {debugTakeAudio} from './debugTake';
import type {
  EngineMessage,
  RecitationEngine,
  RecitationStats,
} from './recitationEngine';
import {
  acquireEngine,
  EngineAcquireError,
  markEngineBusy,
  scheduleUnload,
  setEngineListener,
  unloadRecitationModel,
  type EngineChoice,
} from './engineHost';
import {
  requestMicPermission,
  startMicStream,
  type InterruptionPhase,
  type MicStream,
} from './micStream';
import {
  activeSessionPurpose,
  setActiveSessionPurpose,
  type SessionPurpose,
} from './activeSession';
import {recentAudio} from './secondLook/audioRing';
import {SECOND_LOOK_ENABLED} from './secondLook/config';

// The one listening session: microphone permission, pausing Bayaan's own
// audio, the mic stream, the watchdog, leaving the app, and the flush at the
// end. Purpose controllers (follow-along, identify) start it with their own
// handlers and turn its updates and engine events into their own state.

export {activeSessionPurpose};
export type {SessionPurpose};

export type SessionErrorStage =
  | 'permission'
  | 'download'
  | 'model_load'
  | 'mic'
  | 'engine';

export type SessionUpdate =
  | {status: 'downloading'; progress: number}
  | {status: 'loading'}
  | {status: 'listening'; modelWasLoaded: boolean}
  /** A call, Siri or another app took the audio; listening resumes after. */
  | {status: 'paused'}
  /** The interruption ended and the mic is back. */
  | {status: 'resumed'}
  | {
      status: 'off';
      reason: RecitationStopReason;
      /** The session reached listening before it stopped. */
      listened: boolean;
      stats: RecitationStats | null;
    }
  | {
      status: 'error';
      stage: SessionErrorStage;
      /** What failed (the error's message); controllers word it for the
       * reader. */
      message: string;
      /** For analytics. */
      detail: string;
      kind: 'permission' | 'other';
    };

export interface SessionFinish {
  /** What the engine emitted while flushing the take. */
  messages: WorkerOutbound[];
  reason: RecitationStopReason;
  listened: boolean;
}

export interface SessionHandlers {
  onUpdate: (update: SessionUpdate) => void;
  /** Live engine events, only while listening. */
  onEvent: (msg: EngineMessage) => void;
  /** After the stop: the mic is closed and the engine flushed. */
  onFinish: (finish: SessionFinish) => void;
  /**
   * Called once when a listening session is asked to stop, before anything is
   * released: the engine hears no more audio, but its events still arrive. A stop
   * waits for it, at most BEFORE_STOP_MS.
   */
  beforeStop?: (reason: RecitationStopReason) => Promise<void>;
}

export interface SessionOptions {
  purpose: SessionPurpose;
  /** Biases the first lock toward this ayah, e.g. the page on screen. */
  hint: SearchHint | null;
  /** 'correction' adds the word and ayah checks. Default 'tracking'. The
   *  engine defers each live flag, so listening goes on. */
  mode?: RecitationMode;
  /** Correction mode: the passage the reader is about to recite. */
  expected?: ExpectedPassage | null;
  /** Correction mode: skipped-ayah and look-alike rules at the end. */
  structural?: boolean;
  /** Which follower: 'v0' (Tilawa 0.4, the default) or 'v1' (the 1.0 preview). */
  engine?: EngineChoice;
}

/** What configureSession can change on the running session. */
export interface SessionCorrection {
  mode?: RecitationMode;
  expected?: ExpectedPassage | null;
  structural?: boolean;
}

// The model stays loaded this long after a session ends.
const IDLE_UNLOAD_MS = 5 * 60 * 1000;
// expo-audio deactivates the iOS audio session ~100 ms after a pause when
// nothing else plays; starting the mic inside that window kills it.
const AFTER_PAUSE_MS = 300;
// No chunk for this long while listening means the mic died (route change,
// media services reset).
const MIC_SILENT_MS = 3000;
// An interruption that has not ended after this long ends the session.
export const INTERRUPTION_GIVE_UP_MS = 60 * 1000;
// The longest a stop waits for the session's beforeStop.
export const BEFORE_STOP_MS = 5000;

interface ActiveSession {
  purpose: SessionPurpose;
  handlers: SessionHandlers;
  run: number;
  engine: RecitationEngine | null;
  mic: MicStream | null;
  listening: boolean;
  paused: boolean;
  /** Held by the reader (holdSession): the mic stays open, unheard. */
  held: boolean;
  /** A stop has begun: a second one waits for it. */
  stopping: boolean;
  lastChunkAt: number;
  appStateSub: NativeEventSubscription | null;
  watchdog: ReturnType<typeof setInterval> | null;
  giveUp: ReturnType<typeof setTimeout> | null;
}

let active: ActiveSession | null = null;
// Bumped by every start and stop so a start still loading knows it was
// cancelled or superseded.
let generation = 0;
// The stop in progress (mic closing, engine flushing). A new session waits
// for it, so the old take's tail never reaches the new one.
let stopping: Promise<void> | null = null;

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// @ai The main player's states in which it is playing or about to.
const MAIN_ACTIVE_STATES = ['playing', 'buffering', 'loading'];

/** What pauseQuranAudio paused that can play on again. */
interface PausedAudio {
  /** The main player. */
  main: boolean;
  /** The adhkar clip, by its track token. */
  adhkarToken: number | null;
}

/** Pauses Bayaan's own audio; null when nothing was playing. */
function pauseQuranAudio(): PausedAudio | null {
  let paused = false;
  const resumable: PausedAudio = {main: false, adhkarToken: null};
  const player = usePlayerStore.getState();
  // @ai-start
  // Also while it is still loading or waiting for data: left alone, it
  // started playing into the microphone a moment after the session began.
  // (Its ambient sound follows its state, so that stops with it.)
  if (MAIN_ACTIVE_STATES.includes(player.playback.state)) {
    // @ai-end
    player.pause();
    paused = true;
    resumable.main = true;
  }
  const mushafPlayer = useMushafPlayerStore.getState();
  if (mushafPlayer.playbackState !== 'idle') {
    mushafPlayer.stop();
    paused = true;
  }
  // @ai-start
  // Adhkar too. On iOS a playing list kept going while the mic listened,
  // and the recogniser heard it instead of the reciter.
  const adhkar = useAdhkarSessionStore.getState();
  if (adhkar.session && adhkar.session.status !== 'paused') {
    resumable.adhkarToken = adhkar.session.trackToken;
    adhkar.dispatch({type: 'otherAudioStarted'});
    paused = true;
  }
  // @ai-end
  return paused ? resumable : null;
}

/**
 * A start that failed before the mic opened plays again what it paused,
 * when that is still paused where it was left: the main player and the
 * adhkar clip. Verse audio was stopped, not paused, and stays stopped.
 */
function resumeQuranAudio(paused: PausedAudio | null): void {
  if (!paused) return;
  const player = usePlayerStore.getState();
  if (paused.main && player.playback.state === 'paused') void player.play();
  const {session, dispatch} = useAdhkarSessionStore.getState();
  if (
    paused.adhkarToken !== null &&
    session?.status === 'paused' &&
    session.trackToken === paused.adhkarToken
  ) {
    dispatch({type: 'toggle'});
  }
}

function startWatchdog(session: ActiveSession): void {
  session.watchdog = setInterval(() => {
    if (Date.now() - session.lastChunkAt > MIC_SILENT_MS) {
      if (active === session) void stopSession('mic_silent');
    }
  }, 1000);
}

function stopTimers(session: ActiveSession): void {
  if (session.watchdog) clearInterval(session.watchdog);
  session.watchdog = null;
  if (session.giveUp) clearTimeout(session.giveUp);
  session.giveUp = null;
}

function release(session: ActiveSession): void {
  if (active === session) {
    active = null;
    setActiveSessionPurpose(null);
    setEngineListener(null);
  }
  session.appStateSub?.remove();
  session.appStateSub = null;
  stopTimers(session);
}

function onInterruption(
  session: ActiveSession,
  phase: InterruptionPhase,
): void {
  if (active !== session || !session.listening) return;
  if (phase === 'began') {
    if (session.paused) return;
    session.paused = true;
    stopTimers(session);
    session.giveUp = setTimeout(() => {
      if (active === session) void stopSession('interruption');
    }, INTERRUPTION_GIVE_UP_MS);
    session.handlers.onUpdate({status: 'paused'});
    return;
  }
  if (session.paused) void resume(session);
}

async function resume(session: ActiveSession): Promise<void> {
  stopTimers(session);
  try {
    await session.mic?.resume();
  } catch {
    if (active === session) void stopSession('interruption');
    return;
  }
  if (active !== session) return;
  session.paused = false;
  session.lastChunkAt = Date.now();
  startWatchdog(session);
  session.handlers.onUpdate({status: 'resumed'});
}

/**
 * Holds the listening session, e.g. while the reader looks at a mistake: the
 * mic stays open (no audio-session churn, no watchdog) but nothing reaches
 * the engine, so the take carries on where it was once released.
 * @returns true when a listening session is now held
 */
export function holdSession(): boolean {
  const session = active;
  if (!session || !session.listening || session.paused) return false;
  if (!session.held) {
    session.held = true;
    session.handlers.onUpdate({status: 'paused'});
  }
  return true;
}

/** Ends a hold: the session hears the mic again. */
export function releaseSession(): void {
  const session = active;
  if (!session?.held) return;
  session.held = false;
  session.lastChunkAt = Date.now();
  if (!session.paused) session.handlers.onUpdate({status: 'resumed'});
}

/** The model is free again unless another session has already started. */
function releaseEngine(): void {
  if (active === null) markEngineBusy(false);
}

/** Waits out a stop in progress and stops whatever runs, until neither. */
async function settle(): Promise<void> {
  for (;;) {
    if (stopping) {
      await stopping;
    } else if (active) {
      await stopSession('superseded');
    } else {
      return;
    }
  }
}

/** A cancelled start that already loaded the model lets it go in a while. */
function abandon(): false {
  scheduleUnload(IDLE_UNLOAD_MS);
  return false;
}

/**
 * Starts listening for `options.purpose`, stopping any other session first.
 * Resolves true once listening; false when it failed (handlers.onUpdate got
 * the error) or was stopped while starting.
 */
export async function startSession(
  options: SessionOptions,
  handlers: SessionHandlers,
): Promise<boolean> {
  await settle();
  const run = ++generation;
  const session: ActiveSession = {
    purpose: options.purpose,
    handlers,
    run,
    engine: null,
    mic: null,
    listening: false,
    paused: false,
    held: false,
    stopping: false,
    lastChunkAt: 0,
    appStateSub: null,
    watchdog: null,
    giveUp: null,
  };
  active = session;
  setActiveSessionPurpose(options.purpose);
  markEngineBusy(true);
  // Live flags arrive here too; the engine has already deferred each one
  // with the chunk that raised it (recitationEngine).
  setEngineListener(msg => {
    if (active !== session || !session.listening) return;
    handlers.onEvent(msg);
  });
  // Only the background stops: 'inactive' (Control Center, the call screen,
  // Siri) passes, and an interruption pauses instead. Listening from the
  // start, so leaving during a long download never opens the mic later.
  session.appStateSub = AppState.addEventListener('change', next => {
    if (next === 'background' && active === session) {
      void stopSession('background');
    }
  });
  handlers.onUpdate({status: 'loading'});

  const current = () => run === generation;
  let stage: SessionErrorStage = 'model_load';
  // What the start paused, played again if it fails before the mic opens.
  let pausedAudio: PausedAudio | null = null;
  try {
    // @ai-start
    // Bayaan's own audio stops first, before the permission prompt and the
    // model load, which can take a while. Left playing until the mic opened,
    // an adhkar list reached its next clip in that time, and a clip that
    // starts ends any listening session: the mic never opened and the adhkar
    // played on. (A surah moving on to the next one did the same.)
    pausedAudio = pauseQuranAudio();
    if (pausedAudio) {
      await new Promise(resolve => setTimeout(resolve, AFTER_PAUSE_MS));
      if (!current()) return false;
    }
    // @ai-end
    if (!(await requestMicPermission())) {
      if (!current()) return false;
      release(session);
      releaseEngine();
      resumeQuranAudio(pausedAudio);
      handlers.onUpdate({
        status: 'error',
        stage: 'permission',
        message: 'Microphone permission denied',
        detail: 'denied',
        kind: 'permission',
      });
      return false;
    }
    if (!current()) return false;
    const {engine, wasLoaded} = await acquireEngine(
      {
        onDownload: progress => {
          if (current()) handlers.onUpdate({status: 'downloading', progress});
        },
        onLoad: () => {
          if (current()) handlers.onUpdate({status: 'loading'});
        },
      },
      options.engine ?? 'v0',
    );
    if (!current()) return abandon();
    session.engine = engine;
    if (pauseQuranAudio()) {
      await new Promise(resolve => setTimeout(resolve, AFTER_PAUSE_MS));
      if (!current()) return abandon();
    }
    stage = 'mic';
    engine.reset();
    recentAudio.reset();
    // Every session sets all of these: the engine keeps them across takes.
    engine.setMode(options.mode ?? 'tracking');
    engine.setExpected(options.expected ?? null);
    engine.setStructural(options.structural ?? false);
    engine.setHint(options.hint);
    session.lastChunkAt = Date.now();
    const mic = await startMicStream(
      pcm => {
        session.lastChunkAt = Date.now();
        if (session.held) return;
        engine.feed(pcm);
        if (session.purpose === 'follow') {
          debugTakeAudio(pcm);
          if (SECOND_LOOK_ENABLED) recentAudio.push(pcm);
        }
      },
      phase => onInterruption(session, phase),
    );
    if (!current()) {
      await mic.stop();
      return abandon();
    }
    session.mic = mic;
    startWatchdog(session);
    session.listening = true;
    handlers.onUpdate({status: 'listening', modelWasLoaded: wasLoaded});
    return true;
  } catch (error) {
    if (!current()) return false;
    release(session);
    releaseEngine();
    // A mic that failed to open leaves it paused, as it always did.
    if (stage !== 'mic') resumeQuranAudio(pausedAudio);
    const failedStage =
      error instanceof EngineAcquireError ? error.stage : stage;
    handlers.onUpdate({
      status: 'error',
      stage: failedStage,
      message: messageOf(error),
      detail: messageOf(error),
      kind: 'other',
    });
    return false;
  }
}

/**
 * Stops the session, closes the mic and flushes the engine. Safe to call
 * when nothing runs; then it waits for a stop already in progress.
 */
export async function stopSession(reason: RecitationStopReason): Promise<void> {
  generation++;
  const session = active;
  if (!session || session.stopping) {
    if (stopping) await stopping;
    return;
  }
  session.stopping = true;
  const run = stopRun(session, reason);
  stopping = run;
  try {
    await run;
  } finally {
    if (stopping === run) stopping = null;
  }
}

async function stopRun(
  session: ActiveSession,
  reason: RecitationStopReason,
): Promise<void> {
  const before = session.handlers.beforeStop;
  if (session.listening && before) {
    // No more audio for the engine; its events still reach the handlers.
    session.held = true;
    await new Promise<void>(resolve => {
      const timer = setTimeout(resolve, BEFORE_STOP_MS);
      before(reason)
        .catch(error => {
          console.warn('[recitation] before the stop', error);
        })
        .finally(() => {
          clearTimeout(timer);
          resolve();
        });
    });
  }
  const stats = session.listening ? (session.engine?.getStats() ?? null) : null;
  release(session);
  session.handlers.onUpdate({
    status: 'off',
    reason,
    listened: session.listening,
    stats,
  });
  await finish(session, reason);
}

async function finish(
  session: ActiveSession,
  reason: RecitationStopReason,
): Promise<void> {
  let messages: WorkerOutbound[] = [];
  try {
    if (session.mic) await session.mic.stop();
    // The mic is closed, so this take's audio can go.
    recentAudio.reset();
    if (session.engine) messages = await session.engine.stop();
  } finally {
    releaseEngine();
    scheduleUnload(IDLE_UNLOAD_MS);
  }
  session.handlers.onFinish({
    messages,
    reason,
    listened: session.listening,
  });
}

/** The running session's engine, or null when none runs. */
export function sessionEngine(): RecitationEngine | null {
  return active?.engine ?? null;
}

/** Re-points the search bias, e.g. when the reader turns the page by hand. */
export function setSessionHint(hint: SearchHint | null): void {
  active?.engine?.setHint(hint);
}

/** Changes the running session's mode, passage or structural rules. */
export function configureSession(patch: SessionCorrection): void {
  const engine = active?.engine;
  if (!engine) return;
  if (patch.mode !== undefined) engine.setMode(patch.mode);
  if (patch.expected !== undefined) engine.setExpected(patch.expected);
  if (patch.structural !== undefined) engine.setStructural(patch.structural);
}

/** Stops any session, unloads the model and deletes the downloaded files. */
export async function removeRecitationModel(): Promise<void> {
  await stopSession('model_removed');
  await unloadRecitationModel();
  await deleteRecitationAssets();
  await deleteV1Assets();
}
