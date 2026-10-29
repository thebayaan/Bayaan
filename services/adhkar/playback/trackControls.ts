// services/adhkar/playback/trackControls.ts
// Next / previous for the adhkar session from outside the reader: the lock
// screen's track buttons and a car's. They move the session the way a swipe
// in the reader does, to the nearest dhikr with audio.
import {useAdhkarSessionStore} from '@/store/adhkarSessionStore';
import {nextPlayableIndex} from './sessionReducer';
import type {AdhkarSession, SessionEvent} from './types';

export type TrackDirection = 'next' | 'previous';

export interface AdhkarTrackControls {
  previous: boolean;
  next: boolean;
}

/** Index next / previous moves to, or -1 when there is none. */
export function adhkarTrackTarget(
  session: AdhkarSession,
  direction: TrackDirection,
): number {
  if (direction === 'next')
    return nextPlayableIndex(session.items, session.index + 1);
  for (let i = session.index - 1; i >= 0; i--) {
    if (session.items[i]?.playable) return i;
  }
  return -1;
}

/**
 * Which track buttons the lock screen shows enabled. Null in single mode:
 * one dhikr plays and there is no list to move through.
 */
export function adhkarTrackControls(
  session: AdhkarSession,
): AdhkarTrackControls | null {
  if (session.mode !== 'all') return null;
  return {
    previous: adhkarTrackTarget(session, 'previous') >= 0,
    next: adhkarTrackTarget(session, 'next') >= 0,
  };
}

/** The reducer event for next / previous, or null when it has nowhere to go. */
export function adhkarTrackEvent(
  session: AdhkarSession,
  direction: TrackDirection,
): SessionEvent | null {
  if (session.mode !== 'all') return null;
  const index = adhkarTrackTarget(session, direction);
  const item = session.items[index];
  if (!item) return null;
  return {type: 'swipedTo', listId: session.listId, dhikrId: item.dhikrId};
}

/** Moves the current session, if any. */
export function skipAdhkarTrack(direction: TrackDirection): void {
  const {session, dispatch} = useAdhkarSessionStore.getState();
  if (!session) return;
  const event = adhkarTrackEvent(session, direction);
  if (event) dispatch(event);
}
