// services/adhkar/playback/sessionReducer.ts
// Pure adhkar playback rules (spec section 3.3). The engine and the screens
// only dispatch events; every decision about what plays lives here.
import {hasAudio} from '@/utils/adhkarAudio';
import {adhkarCopyText} from '@/utils/adhkarText';
import type {Dhikr} from '@/types/adhkar';
import type {
  AdhkarSession,
  SessionEvent,
  SessionItem,
  SessionSource,
} from './types';

const PREVIEW_LENGTH = 60;

/** First index at or after `from` whose item has audio, or -1. */
export function nextPlayableIndex(
  items: readonly SessionItem[],
  from: number,
): number {
  for (let i = Math.max(0, from); i < items.length; i++) {
    if (items[i].playable) return i;
  }
  return -1;
}

export function toSessionItems(list: readonly Dhikr[]): SessionItem[] {
  return list.map(dhikr => ({
    dhikrId: dhikr.id,
    audioFile: dhikr.audioFile,
    playable: hasAudio(dhikr.audioFile),
    preview: adhkarCopyText(dhikr.arabic).slice(0, PREVIEW_LENGTH),
  }));
}

export function currentItem(session: AdhkarSession): SessionItem | null {
  return session.items[session.index] ?? null;
}

function startSession(
  source: SessionSource,
  index: number,
  mode: AdhkarSession['mode'],
  previousToken: number,
  now: number,
): AdhkarSession {
  return {
    listId: source.listId,
    listTitle: source.listTitle,
    items: source.items,
    index,
    mode,
    loop: false,
    status: 'loading',
    error: false,
    trackToken: previousToken + 1,
    positionSec: 0,
    lastActiveAt: now,
  };
}

function moveTo(
  session: AdhkarSession,
  index: number,
  keepPaused: boolean,
  now: number,
): AdhkarSession {
  const playable = session.items[index]?.playable ?? false;
  return {
    ...session,
    index,
    status: !playable || keepPaused ? 'paused' : 'loading',
    error: false,
    trackToken: session.trackToken + 1,
    positionSec: 0,
    lastActiveAt: now,
  };
}

// Play on a row without audio in all mode moves on to the next row that has
// audio, or ends the session when none is left.
function resumedOnSilentRow(
  session: AdhkarSession,
  now: number,
): AdhkarSession | null {
  const next = nextPlayableIndex(session.items, session.index);
  if (next < 0) return null;
  return moveTo(session, next, false, now);
}

function isSilentAllRow(session: AdhkarSession): boolean {
  return (
    session.mode === 'all' && !(session.items[session.index]?.playable ?? false)
  );
}

function toggled(session: AdhkarSession, now: number): AdhkarSession | null {
  if (session.status === 'paused') {
    if (isSilentAllRow(session)) return resumedOnSilentRow(session, now);
    return {...session, status: 'loading', error: false, lastActiveAt: now};
  }
  return {...session, status: 'paused', lastActiveAt: now};
}

export type PlayAllState = 'idle' | 'playing' | 'paused';

/** What a list's Play All button shows: only that list's all-mode session
 * counts, since Play All on a single-mode session starts all mode. */
export function playAllState(
  session: AdhkarSession | null,
  listId: string | undefined,
): PlayAllState {
  if (!session || session.mode !== 'all' || session.listId !== listId)
    return 'idle';
  return session.status === 'paused' ? 'paused' : 'playing';
}

export function reduceSession(
  state: AdhkarSession | null,
  event: SessionEvent,
  now: number,
): AdhkarSession | null {
  const token = state?.trackToken ?? 0;
  switch (event.type) {
    case 'pressCard': {
      const target = event.source.items[event.index];
      if (!target?.playable) return state;
      if (
        state &&
        state.listId === event.source.listId &&
        state.items[state.index]?.dhikrId === target.dhikrId
      ) {
        return toggled(state, now);
      }
      if (
        state &&
        state.mode === 'all' &&
        state.listId === event.source.listId
      ) {
        // The screen's list is the fresh one (Saved can lose rows).
        return moveTo(
          {...state, items: event.source.items},
          event.index,
          false,
          now,
        );
      }
      return startSession(event.source, event.index, 'single', token, now);
    }
    case 'pressPlayAll': {
      if (
        state &&
        state.mode === 'all' &&
        state.listId === event.source.listId
      ) {
        // Pause and Resume in the list header: it never ends the session.
        return toggled(state, now);
      }
      const first = nextPlayableIndex(event.source.items, 0);
      if (first < 0) return state;
      return startSession(event.source, first, 'all', token, now);
    }
    case 'swipedTo': {
      if (!state || state.mode !== 'all' || state.listId !== event.listId)
        return state;
      const index = state.items.findIndex(i => i.dhikrId === event.dhikrId);
      if (index < 0 || index === state.index) return state;
      return moveTo(state, index, state.status === 'paused', now);
    }
    case 'trackEnded': {
      if (!state || event.token !== state.trackToken) return state;
      if (state.mode === 'single') return null;
      const next = nextPlayableIndex(state.items, state.index + 1);
      if (next < 0) return null;
      return moveTo(state, next, false, now);
    }
    case 'toggle':
      return state ? toggled(state, now) : state;
    case 'stop':
      return null;
    case 'toggleLoop':
      if (!state || state.mode !== 'single') return state;
      return {...state, loop: !state.loop, lastActiveAt: now};
    case 'playStarted':
      if (
        !state ||
        event.token !== state.trackToken ||
        state.status !== 'loading'
      )
        return state;
      return {...state, status: 'playing', error: false};
    case 'playFailed':
      if (!state || event.token !== state.trackToken) return state;
      return {...state, status: 'paused', error: true};
    case 'playerPaused':
      if (!state || state.status !== 'playing') return state;
      return {...state, status: 'paused', lastActiveAt: now};
    case 'playerResumed':
      if (!state || state.status !== 'paused') return state;
      if (isSilentAllRow(state)) return resumedOnSilentRow(state, now);
      return {...state, status: 'playing', error: false, lastActiveAt: now};
    case 'otherAudioStarted':
      if (!state || state.status === 'paused') return state;
      return {...state, status: 'paused', lastActiveAt: now};
    case 'positionSaved':
      if (!state) return state;
      return {...state, positionSec: event.positionSec};
    case 'restored':
      return event.session;
  }
}
