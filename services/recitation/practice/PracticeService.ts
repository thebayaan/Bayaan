import type {WorkerOutbound} from '@tilawa/core';
import {
  PRACTICE_IDLE,
  usePracticeStore,
  type PracticeErrorCode,
  type PracticeState,
} from '@/store/practiceStore';
import {recitationLogDatabase} from '../RecitationLogDatabase';
import {
  activeSessionPurpose,
  startSession,
  stopSession,
  type SessionErrorStage,
  type SessionFinish,
  type SessionHandlers,
  type SessionUpdate,
} from '../sessionRunner';
import {finishTake, startTake, takeEvent, type TakeBuilder} from '../take';
import {judgePractice} from './judge';
import type {PracticeTarget} from './types';

// Short targeted takes: retry an ayah after a memorisation take, answer a
// quiz question, drill a look-alike pair. Correction targets check a
// passage; tracking targets only place what was recited. Every practice
// take is logged, so revision planning counts it.

/** Nothing placed for this long ends the take as "nothing". */
export const PRACTICE_TIMEOUT_MS = 25_000;
/** No practice take runs longer than this. */
export const PRACTICE_MAX_MS = 3 * 60 * 1000;
/** After the last expected ayah, let the engine settle before stopping. */
export const COMPLETE_GRACE_MS = 1_200;

const START_ERRORS: Record<SessionErrorStage, PracticeErrorCode> = {
  permission: 'permission',
  download: 'download',
  model_load: 'other',
  mic: 'other',
  engine: 'other',
};

interface PracticeRun {
  target: PracticeTarget;
  builder: TakeBuilder | null;
  dismissed: ReadonlySet<string>;
  placed: boolean;
  timeout: ReturnType<typeof setTimeout> | null;
  cap: ReturnType<typeof setTimeout> | null;
  grace: ReturnType<typeof setTimeout> | null;
}

/** The run whose updates own the store; null once the reader stopped it. */
let current: PracticeRun | null = null;

function setState(patch: Partial<PracticeState>): void {
  usePracticeStore.setState(patch);
}

function clearTimers(run: PracticeRun): void {
  for (const timer of [run.timeout, run.cap, run.grace]) {
    if (timer) clearTimeout(timer);
  }
  run.timeout = null;
  run.cap = null;
  run.grace = null;
}

function stopIfOurs(run: PracticeRun, reason: 'not_found' | 'completed') {
  if (current === run && activeSessionPurpose() === 'practice') {
    void stopSession(reason);
  }
}

function armTimeout(run: PracticeRun): void {
  if (run.timeout) clearTimeout(run.timeout);
  run.timeout = setTimeout(
    () => stopIfOurs(run, 'not_found'),
    run.target.timeoutMs ?? PRACTICE_TIMEOUT_MS,
  );
}

/** The ayah that ends the target: the passage's last, or any accepted one. */
function endsTarget(
  target: PracticeTarget,
  ayah: {surah: number; ayah: number},
) {
  if (target.accept)
    return target.accept.includes(`${ayah.surah}:${ayah.ayah}`);
  const passage = target.expected;
  if (!passage) return false;
  return (
    ayah.surah === passage.surah &&
    ayah.ayah === (passage.ayahEnd ?? passage.ayah)
  );
}

function handlersFor(run: PracticeRun): SessionHandlers {
  const owns = () => current === run;

  function onUpdate(update: SessionUpdate): void {
    switch (update.status) {
      case 'listening':
        run.builder = startTake({
          id: Date.now().toString(36) + Math.random().toString(36).slice(2),
          purpose: 'practice',
          startedAt: Date.now(),
          hidden: true,
          expected: run.target.expected,
        });
        armTimeout(run);
        run.cap = setTimeout(
          () => stopIfOurs(run, 'completed'),
          PRACTICE_MAX_MS,
        );
        break;
      case 'paused':
        if (run.timeout) clearTimeout(run.timeout);
        run.timeout = null;
        break;
      case 'resumed':
        if (!run.placed) armTimeout(run);
        break;
      case 'off':
        clearTimers(run);
        break;
      default:
        break;
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
      case 'resumed':
        setState({status: 'listening'});
        return;
      case 'paused':
        setState({status: 'paused'});
        return;
      case 'error':
        setState({
          ...PRACTICE_IDLE,
          target: run.target,
          status: 'error',
          error: {code: START_ERRORS[update.stage], detail: update.detail},
        });
        return;
      default:
        return;
    }
  }

  function onEvent(msg: WorkerOutbound): void {
    if (run.builder) run.builder = takeEvent(run.builder, msg, Date.now());
    const placed =
      msg.type === 'word_progress' || msg.type === 'verse_match'
        ? {surah: msg.surah, ayah: msg.ayah}
        : null;
    if (!placed) return;
    if (!run.placed) {
      run.placed = true;
      if (run.timeout) clearTimeout(run.timeout);
      run.timeout = null;
    }
    if (owns()) setState({current: placed});
    if (
      msg.type === 'verse_match' &&
      endsTarget(run.target, msg) &&
      !run.grace
    ) {
      run.grace = setTimeout(
        () => stopIfOurs(run, 'completed'),
        COMPLETE_GRACE_MS,
      );
    }
  }

  function onFinish({messages, reason, listened}: SessionFinish): void {
    clearTimers(run);
    const builder = run.builder;
    run.builder = null;
    if (!listened || !builder) {
      if (owns()) setState({...PRACTICE_IDLE, target: run.target});
      return;
    }
    const record = finishTake(builder, messages, reason, Date.now());
    recitationLogDatabase.recordTake(record).catch(error => {
      console.warn('[recitation] could not save the practice take', error);
    });
    if (!owns()) return;
    setState({
      status: 'done',
      verdict: judgePractice(run.target, record, run.dismissed),
    });
  }

  return {onUpdate, onEvent, onFinish};
}

/** Listens for `target`, downloading and loading the model first if needed. */
export async function startPractice(target: PracticeTarget): Promise<void> {
  const run: PracticeRun = {
    target,
    builder: null,
    dismissed: new Set(),
    placed: false,
    timeout: null,
    cap: null,
    grace: null,
  };
  current = run;
  setState({...PRACTICE_IDLE, status: 'loading', target});
  recitationLogDatabase
    .dismissedKeys()
    .then(keys => {
      run.dismissed = keys;
    })
    .catch(error => {
      console.warn('[recitation] could not read dismissed flags', error);
    });
  const correction = target.mode === 'correction';
  await startSession(
    {
      purpose: 'practice',
      hint: target.expected
        ? {surah: target.expected.surah, ayah: target.expected.ayah}
        : null,
      mode: target.mode,
      expected: correction ? target.expected : null,
      structural: correction,
    },
    handlersFor(run),
  );
}

/** Stops listening and clears the result. Safe to call when idle. */
export async function stopPractice(): Promise<void> {
  const run = current;
  current = null;
  if (run) clearTimers(run);
  if (activeSessionPurpose() === 'practice') await stopSession('user');
  if (current === null) setState(PRACTICE_IDLE);
}
