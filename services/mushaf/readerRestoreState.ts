// @ai-generated
// One restore state for a launch into the reader (RFC-023 step 5).
//
// A launch whose last screen was the reader pushes the reader over the home
// route (app/_layout.tsx). The root layout owns this state for that launch:
//
//   none               The last screen was not the reader. Nothing waits.
//   pushing            The launch pushes the reader, unless a deep link opened
//                      the app.
//   waitingForContent  The reader is pushed. No surface has reported content.
//   shown              A reader surface has reported its first content.
//   ended              The wait is over.
//
// The splash waits in `pushing` and `waitingForContent`, but it goes
// SPLASH_DEADLINE_MS after the push, for a surface that never reports (a failed
// data load, a font download that never ends). Then the user sees the reader's
// loading or failed view.
//
// The home route waits in every state but `none` and `ended`, because nobody
// sees it under the reader and its work competes with the reader's first page.
// It renders HOME_AFTER_SHOWN_MS after `shown`, when the reader closes, or
// RESTORE_SAFETY_LIMIT_MS after the launch.
import {mushafSessionStore} from './MushafSessionStore';

export type ReaderRestoreState =
  | 'none'
  | 'pushing'
  | 'waitingForContent'
  | 'shown'
  | 'ended';

/** The splash goes this long after the push, with or without content. */
export const SPLASH_DEADLINE_MS = 4000;
/** The home route renders this long after the reader's first content. */
export const HOME_AFTER_SHOWN_MS = 1000;
/** The wait ends at the latest this long after the launch. */
export const RESTORE_SAFETY_LIMIT_MS = 15000;

let state: ReaderRestoreState = 'none';
let splashDeadlinePassed = false;
let safetyTimer: ReturnType<typeof setTimeout> | null = null;
let deadlineTimer: ReturnType<typeof setTimeout> | null = null;
let homeTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of [...listeners]) listener();
}

function clearTimers(): void {
  if (safetyTimer) clearTimeout(safetyTimer);
  if (deadlineTimer) clearTimeout(deadlineTimer);
  if (homeTimer) clearTimeout(homeTimer);
  safetyTimer = null;
  deadlineTimer = null;
  homeTimer = null;
}

function readLastScreenWasReader(): boolean {
  try {
    return mushafSessionStore.getLastScreenWasMushaf();
  } catch {
    return false;
  }
}

/**
 * Starts the state of this launch. The root layout calls it once, before the
 * reader can mount: the reader writes the flag that this reads.
 */
export function beginReaderRestore(): void {
  clearTimers();
  splashDeadlinePassed = false;
  if (readLastScreenWasReader()) {
    state = 'pushing';
    safetyTimer = setTimeout(endReaderRestore, RESTORE_SAFETY_LIMIT_MS);
  } else {
    state = 'none';
  }
  notify();
}

export function getReaderRestoreState(): ReaderRestoreState {
  return state;
}

/**
 * True when the launch must push the reader now. A launch from a deep link
 * already routed to its target, so it does not restore.
 */
export function shouldPushReader(
  initialUrl: string | null | undefined,
): boolean {
  if (state !== 'pushing') return false;
  if (initialUrl) {
    endReaderRestore();
    return false;
  }
  return true;
}

/** The root layout pushed the reader. The splash deadline starts here. */
export function noteReaderPushed(): void {
  if (state !== 'pushing') return;
  state = 'waitingForContent';
  deadlineTimer = setTimeout(() => {
    deadlineTimer = null;
    splashDeadlinePassed = true;
    notify();
  }, SPLASH_DEADLINE_MS);
  notify();
}

/** A reader surface has its first content. Only the first report counts. */
export function noteReaderFirstContent(): void {
  if (state !== 'waitingForContent') return;
  state = 'shown';
  if (deadlineTimer) clearTimeout(deadlineTimer);
  deadlineTimer = null;
  homeTimer = setTimeout(endReaderRestore, HOME_AFTER_SHOWN_MS);
  notify();
}

/** Ends the wait at once: a deep link, the reader closed, the safety limit. */
export function endReaderRestore(): void {
  if (state === 'none' || state === 'ended') return;
  state = 'ended';
  clearTimers();
  notify();
}

/** True while the splash must stay. */
export function readerRestoreHoldsSplash(): boolean {
  return (
    (state === 'pushing' || state === 'waitingForContent') &&
    !splashDeadlinePassed
  );
}

/** True while the home route must draw nothing. */
export function readerRestoreHoldsHome(): boolean {
  return state !== 'none' && state !== 'ended';
}

export function subscribeReaderRestore(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
