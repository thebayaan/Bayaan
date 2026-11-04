import type {WorkerOutbound} from '@tilawa/core';
import type {EngineMessage} from '../recitationEngine';
import {analyticsService} from '@/services/analytics/AnalyticsService';
import type {RecitationStopReason} from '@/services/analytics/events';
import {
  AYAH_IDENTIFY_IDLE,
  useAyahIdentifyStore,
  type AyahIdentifyState,
  type IdentifiedAyah,
  type IdentifyErrorCode,
} from '@/store/ayahIdentifyStore';
import {
  activeSessionPurpose,
  startSession,
  stopSession,
  type SessionErrorStage,
  type SessionFinish,
  type SessionHandlers,
  type SessionUpdate,
} from '../sessionRunner';
import {identicalAyatOf} from './identicalAyat';

// Which ayah?: listens to a recitation (the reader's own, an imam, a
// recording), names the ayah once the engine places it, then keeps
// following until the sheet closes. Publishes to useAyahIdentifyStore.

/** Listening this long without placing anything ends in "not found". */
export const IDENTIFY_TIMEOUT_MS = 20_000;

/**
 * One start of Which ayah?, with its own timer and timings, so a stop that
 * finishes late never touches the state of a newer start.
 */
interface IdentifyRun {
  timer: ReturnType<typeof setTimeout> | null;
  listenedAt: number | null;
  matchedAt: number | null;
  match: IdentifiedAyah | null;
}

/** The run whose updates own the store; null once the reader stopped it. */
let current: IdentifyRun | null = null;

function setState(patch: Partial<AyahIdentifyState>): void {
  useAyahIdentifyStore.setState(patch);
}

function clearTimer(run: IdentifyRun): void {
  if (run.timer) clearTimeout(run.timer);
  run.timer = null;
}

function armTimer(run: IdentifyRun): void {
  clearTimer(run);
  run.timer = setTimeout(() => {
    run.timer = null;
    const ours = current === run && activeSessionPurpose() === 'identify';
    if (ours && run.match === null) void stopSession('not_found');
  }, IDENTIFY_TIMEOUT_MS);
}

function keyOf(ayah: IdentifiedAyah): string {
  return `${ayah.surah}:${ayah.ayah}`;
}

/** The ayah an engine event places the recitation in, if any. */
function placedAyah(msg: WorkerOutbound): IdentifiedAyah | null {
  if (msg.type === 'verse_candidate') {
    const best = msg.candidates[0];
    return best ? {surah: best.surah, ayah: best.ayah} : null;
  }
  if (msg.type === 'word_progress') return {surah: msg.surah, ayah: msg.ayah};
  return null;
}

const START_ERRORS: Record<SessionErrorStage, IdentifyErrorCode> = {
  permission: 'permission',
  download: 'download',
  model_load: 'other',
  mic: 'other',
  engine: 'other',
};

// Stops nobody asked for; with nothing placed yet they are errors.
const STOP_ERRORS: Partial<Record<RecitationStopReason, IdentifyErrorCode>> = {
  mic_silent: 'mic',
  interruption: 'interrupted',
};

function reportEnded(run: IdentifyRun, reason: RecitationStopReason): void {
  analyticsService.trackRecitationIdentifyEnded({
    outcome: run.match
      ? 'found'
      : reason === 'not_found'
        ? 'not_found'
        : STOP_ERRORS[reason]
          ? 'error'
          : 'cancelled',
    time_to_match_ms:
      run.matchedAt !== null && run.listenedAt !== null
        ? run.matchedAt - run.listenedAt
        : null,
    surah_id: run.match?.surah ?? null,
    listened_ms: run.listenedAt === null ? 0 : Date.now() - run.listenedAt,
  });
}

/** What the sheet shows once a run's listening has ended. */
function finishState(run: IdentifyRun, reason: RecitationStopReason): void {
  if (run.match) {
    // The mic is off, the result stays on screen.
    setState({status: 'found', micOn: false});
    return;
  }
  if (reason === 'not_found') {
    setState({status: 'notFound', micOn: false});
    return;
  }
  const errorCode = STOP_ERRORS[reason];
  if (errorCode) {
    setState({
      ...AYAH_IDENTIFY_IDLE,
      status: 'error',
      error: {code: errorCode, detail: reason},
    });
    return;
  }
  // The app left the foreground, or other audio or another recitation
  // feature took over.
  setState({...AYAH_IDENTIFY_IDLE, status: 'stopped'});
}

function handlersFor(run: IdentifyRun): SessionHandlers {
  const owns = () => current === run;

  function onUpdate(update: SessionUpdate): void {
    if (update.status === 'paused' || update.status === 'off') {
      clearTimer(run);
    }
    if (update.status === 'listening') {
      run.listenedAt = Date.now();
      analyticsService.trackRecitationIdentifyStarted({
        model_loaded: update.modelWasLoaded,
      });
    }
    if (!owns()) return;
    switch (update.status) {
      case 'downloading':
        setState({status: 'downloading', downloadProgress: update.progress});
        return;
      case 'loading':
        setState({status: 'loading'});
        return;
      case 'listening':
        setState({status: 'listening', micOn: true});
        armTimer(run);
        return;
      case 'paused':
        setState({status: 'paused'});
        return;
      case 'resumed':
        setState({status: run.match ? 'found' : 'listening'});
        if (!run.match) armTimer(run);
        return;
      case 'off':
        setState({micOn: false});
        return;
      case 'error':
        setState({
          ...AYAH_IDENTIFY_IDLE,
          status: 'error',
          error: {code: START_ERRORS[update.stage], detail: update.detail},
        });
        return;
    }
  }

  function onEvent(msg: EngineMessage): void {
    if (!owns() || msg.type === 'word_verdicts') return;
    const ayah = placedAyah(msg);
    if (!ayah) return;
    if (!run.match) {
      run.match = ayah;
      run.matchedAt = Date.now();
      clearTimer(run);
      setState({
        status: 'found',
        match: ayah,
        current: ayah,
        twins: identicalAyatOf(keyOf(ayah)),
      });
      return;
    }
    const shown = useAyahIdentifyStore.getState().current;
    if (shown && keyOf(shown) === keyOf(ayah)) return;
    setState({current: ayah, twins: identicalAyatOf(keyOf(ayah))});
  }

  function onFinish({reason, listened}: SessionFinish): void {
    clearTimer(run);
    if (listened) reportEnded(run, reason);
    if (owns()) finishState(run, reason);
  }

  return {onUpdate, onEvent, onFinish};
}

/** Starts listening, downloading and loading the model first if needed. */
export async function startAyahIdentify(): Promise<void> {
  if (activeSessionPurpose() === 'identify') return;
  const run: IdentifyRun = {
    timer: null,
    listenedAt: null,
    matchedAt: null,
    match: null,
  };
  current = run;
  setState({...AYAH_IDENTIFY_IDLE, status: 'loading'});
  await startSession({purpose: 'identify', hint: null}, handlersFor(run));
}

/** Stops listening and clears the result. Safe to call when idle. */
export async function stopAyahIdentify(): Promise<void> {
  const run = current;
  current = null;
  if (run) clearTimer(run);
  if (activeSessionPurpose() === 'identify') await stopSession('user');
  // A start made while this stop was flushing owns the store now.
  if (current === null) setState(AYAH_IDENTIFY_IDLE);
}
