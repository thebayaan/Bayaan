// services/widgets/live-activity/planAdhkarActivity.ts
// Pure adhkar session Live Activity policy (adhkar playback spec, section 7):
// session -> content state, what to ask ActivityKit for given what was last
// sent, and how each native result changes memory.
import type {
  ActivityStartResult,
  AdhkarSessionActivityState,
} from 'bayaan-widgets';
import type {AdhkarSession} from '@/services/adhkar/playback/types';

// A paused session's activity ends this long after the pause.
export const ADHKAR_PAUSED_END_MS = 15 * 60 * 1000;
// A playing activity goes stale this long after its last update (spec 8: the
// system shows it as stale if the app was killed).
export const ADHKAR_PLAYING_STALE_MS = 10 * 60 * 1000;

export interface AdhkarActivityMemory {
  live: boolean;
  // Last state sent to ActivityKit.
  last: AdhkarSessionActivityState | null;
  // adhkarSessionKey of the session the live activity shows.
  sessionKey: string | null;
  // Session whose activity was dismissed or refused; not started again until
  // the session changes or ends.
  suppressedSession: string | null;
}

export const INITIAL_ADHKAR_ACTIVITY_MEMORY: AdhkarActivityMemory = {
  live: false,
  last: null,
  sessionKey: null,
  suppressedSession: null,
};

export type AdhkarActivityPlan =
  | {
      kind: 'start' | 'update';
      key: string;
      state: AdhkarSessionActivityState;
      staleAt: number;
    }
  | {kind: 'end'}
  | {kind: 'reset'}
  | {kind: 'none'};

export function adhkarActivityState(
  session: AdhkarSession,
): AdhkarSessionActivityState | null {
  const item = session.items[session.index];
  if (!item) return null;
  return {
    listTitle: session.listTitle,
    preview: item.preview,
    position: session.index + 1,
    total: session.items.length,
    // Loading between tracks reads as playing, so the activity does not flash.
    isPlaying: session.status !== 'paused',
  };
}

/**
 * Identity of a session (the reducer has none). A single session also keys on
 * its dhikr: another card in the same list starts a new single session.
 */
export function adhkarSessionKey(session: AdhkarSession): string {
  const dhikrId =
    session.mode === 'single'
      ? (session.items[session.index]?.dhikrId ?? '')
      : '';
  return JSON.stringify([session.listId, session.mode, dhikrId]);
}

export function adhkarStaleAt(session: AdhkarSession, now: number): number {
  return session.status === 'paused'
    ? session.lastActiveAt + ADHKAR_PAUSED_END_MS
    : now + ADHKAR_PLAYING_STALE_MS;
}

function sameState(
  a: AdhkarSessionActivityState,
  b: AdhkarSessionActivityState,
): boolean {
  return (
    a.listTitle === b.listTitle &&
    a.preview === b.preview &&
    a.position === b.position &&
    a.total === b.total &&
    a.isPlaying === b.isPlaying
  );
}

export function planAdhkarActivity(
  memory: AdhkarActivityMemory,
  session: AdhkarSession | null,
  now: number,
  otherSourceActive: boolean,
): AdhkarActivityPlan {
  const state = session ? adhkarActivityState(session) : null;
  if (!session || !state) {
    if (memory.live) return {kind: 'end'};
    return memory.suppressedSession !== null ? {kind: 'reset'} : {kind: 'none'};
  }
  const key = adhkarSessionKey(session);
  if (memory.live) {
    const paused = session.status === 'paused';
    if (
      paused &&
      (otherSourceActive || now - session.lastActiveAt >= ADHKAR_PAUSED_END_MS)
    ) {
      return {kind: 'end'};
    }
    if (
      memory.sessionKey === key &&
      memory.last &&
      sameState(memory.last, state)
    ) {
      return {kind: 'none'};
    }
    return {kind: 'update', key, state, staleAt: adhkarStaleAt(session, now)};
  }
  if (session.status !== 'playing' || key === memory.suppressedSession) {
    return {kind: 'none'};
  }
  return {kind: 'start', key, state, staleAt: adhkarStaleAt(session, now)};
}

export function afterAdhkarStart(
  memory: AdhkarActivityMemory,
  key: string,
  state: AdhkarSessionActivityState,
  result: ActivityStartResult,
): AdhkarActivityMemory {
  switch (result) {
    case 'started':
    case 'updated':
      return {
        live: true,
        last: state,
        sessionKey: key,
        suppressedSession: null,
      };
    case 'deferred':
      // The app was not active; the sync retries on foreground.
      return {...memory, live: false, last: null, sessionKey: null};
    default:
      return {...INITIAL_ADHKAR_ACTIVITY_MEMORY, suppressedSession: key};
  }
}

export function afterAdhkarUpdate(
  memory: AdhkarActivityMemory,
  key: string,
  state: AdhkarSessionActivityState,
  ok: boolean,
): AdhkarActivityMemory {
  if (ok) return {...memory, live: true, last: state, sessionKey: key};
  return {...INITIAL_ADHKAR_ACTIVITY_MEMORY, suppressedSession: key};
}

export function afterAdhkarEnd(): AdhkarActivityMemory {
  return INITIAL_ADHKAR_ACTIVITY_MEMORY;
}
