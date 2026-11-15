// @ai-generated
// One restore state for a launch into the reader (RFC-023 step 5).
//
// A launch whose last screen was the reader pushes the reader over the home
// route. The root layout (app/_layout.tsx) owns the state with this reducer:
//
//   none     The last screen was not the reader. Nothing waits.
//   pushing  The layout pushes the reader when the boot and a share end, unless
//            a deep link opened the app. The push has no time limit.
//   waiting  The reader is pushed. The splash waits for the page it opens on.
//   late     That page had no content at the splash deadline, so the splash
//            goes and the user sees the reader's loading view.
//   shown    That page has its first content, so the splash goes.
//   ended    The wait is over, so the home route renders.
//
// The splash waits in `pushing` and `waiting`. The home route draws nothing
// from `pushing` to `shown`: nobody sees it under the reader, and its work
// competes with the reader's first page.
import {createContext, type Dispatch} from 'react';

export type ReaderRestorePhase =
  | 'none'
  | 'pushing'
  | 'waiting'
  | 'late'
  | 'shown'
  | 'ended';

// The layout sends 'pushed', or 'linkOpened' for a deep link. The reader sends
// 'content' and 'closed'. The timers of PHASE_TIMERS send the last three.
export type ReaderRestoreEvent =
  | 'pushed'
  | 'linkOpened'
  | 'content'
  | 'closed'
  | 'splashDeadline'
  | 'safetyLimit'
  | 'homeDelay';

/** The splash goes this long after the push, with or without content. */
export const SPLASH_DEADLINE_MS = 4000;
/** The home route renders this long after the first content. */
export const HOME_AFTER_SHOWN_MS = 1000;
/** The wait ends at the latest this long after the push. */
export const RESTORE_SAFETY_LIMIT_MS = 15000;

/** The one timer of each phase that has one, and the event that it sends. */
export const PHASE_TIMERS: Partial<
  Record<ReaderRestorePhase, {ms: number; event: ReaderRestoreEvent}>
> = {
  waiting: {ms: SPLASH_DEADLINE_MS, event: 'splashDeadline'},
  late: {
    ms: RESTORE_SAFETY_LIMIT_MS - SPLASH_DEADLINE_MS,
    event: 'safetyLimit',
  },
  shown: {ms: HOME_AFTER_SHOWN_MS, event: 'homeDelay'},
};

const NEXT: Record<
  ReaderRestorePhase,
  Partial<Record<ReaderRestoreEvent, ReaderRestorePhase>>
> = {
  none: {},
  pushing: {pushed: 'waiting', linkOpened: 'ended'},
  waiting: {content: 'shown', closed: 'ended', splashDeadline: 'late'},
  late: {content: 'shown', closed: 'ended', safetyLimit: 'ended'},
  shown: {closed: 'ended', homeDelay: 'ended'},
  ended: {},
};

/**
 * The next phase. An event that the phase does not take changes nothing, so a
 * second report or the timer of an earlier phase is safe.
 */
export function readerRestoreReducer(
  phase: ReaderRestorePhase,
  event: ReaderRestoreEvent,
): ReaderRestorePhase {
  return NEXT[phase][event] ?? phase;
}

export function holdsSplash(phase: ReaderRestorePhase): boolean {
  return phase === 'pushing' || phase === 'waiting';
}

export function holdsHome(phase: ReaderRestorePhase): boolean {
  return phase !== 'none' && phase !== 'ended';
}

/** True while the home route must draw nothing. */
export const HomeHeldContext = createContext(false);

/** The reader sends 'content' and 'closed' here. The value never changes. */
export const ReaderRestoreContext = createContext<Dispatch<ReaderRestoreEvent>>(
  () => undefined,
);
