// The one adhkar playback session. Screens dispatch SessionEvents; the
// engine (services/adhkar/playback/adhkarPlaybackEngine.ts) follows it.
import {create} from 'zustand';
import {reduceSession} from '@/services/adhkar/playback/sessionReducer';
import type {
  AdhkarSession,
  SessionEvent,
} from '@/services/adhkar/playback/types';

interface AdhkarSessionState {
  session: AdhkarSession | null;
  // Increments when a surface asks the screen showing the session's list to
  // scroll to the current dhikr.
  revealToken: number;
  dispatch: (event: SessionEvent) => void;
  requestReveal: () => void;
}

export const useAdhkarSessionStore = create<AdhkarSessionState>(set => ({
  session: null,
  revealToken: 0,
  dispatch: event =>
    set(state => {
      const next = reduceSession(state.session, event, Date.now());
      return next === state.session ? state : {session: next};
    }),
  requestReveal: () => set(state => ({revealToken: state.revealToken + 1})),
}));
