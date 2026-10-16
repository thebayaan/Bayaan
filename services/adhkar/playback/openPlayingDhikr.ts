// services/adhkar/playback/openPlayingDhikr.ts
// Which adhkar screen is focused, and (Task 5) how to get to the playing dhikr.
import {useAdhkarSessionStore} from '@/store/adhkarSessionStore';
import type {AdhkarSession} from './types';

export type AdhkarFocus = {kind: 'list' | 'reader'; listId: string} | null;

let focus: AdhkarFocus = null;

export function setAdhkarFocus(next: AdhkarFocus): void {
  focus = next;
}

// Clears only when `expected` is still the current focus. Navigation can run
// the next screen's focus before the previous screen's blur cleanup.
export function clearAdhkarFocus(expected: AdhkarFocus): void {
  if (focus === expected) focus = null;
}

export function getAdhkarFocus(): AdhkarFocus {
  return focus;
}

// Routes of the adhkar stack (app/(tabs)/(a.home)/adhkar/_layout.tsx).
export type AdhkarStackRoute =
  | {name: 'index'; params: Record<string, never>}
  | {name: '[superId]/index'; params: {superId: string}}
  | {
      name: '[superId]/[dhikrId]';
      params: {
        superId: string;
        dhikrId: string;
        globalIndex: string;
        superCategoryTitle: string;
      };
    }
  | {name: 'saved/index'; params: Record<string, never>}
  | {name: 'saved/[dhikrId]'; params: {dhikrId: string; globalIndex: string}};

// `routes` is the path a person would take by hand: the Adhkar screen, the
// session's list, then its reader. Back retraces it, and the reader always
// has a back button (a screen opened first in the adhkar stack has none).
export type OpenPlan =
  | {kind: 'none'}
  | {kind: 'reveal'}
  | {
      kind: 'push';
      routes: [AdhkarStackRoute, AdhkarStackRoute, AdhkarStackRoute];
    };

export const ADHKAR_SCREEN: AdhkarStackRoute = {name: 'index', params: {}};

export function planOpenPlaying(
  session: AdhkarSession | null,
  current: AdhkarFocus,
): OpenPlan {
  if (!session) return {kind: 'none'};
  const item = session.items[session.index];
  if (!item) return {kind: 'none'};
  if (current && current.listId === session.listId) return {kind: 'reveal'};
  const globalIndex = String(session.index);
  if (session.listId === 'saved') {
    return {
      kind: 'push',
      routes: [
        ADHKAR_SCREEN,
        {name: 'saved/index', params: {}},
        {name: 'saved/[dhikrId]', params: {dhikrId: item.dhikrId, globalIndex}},
      ],
    };
  }
  return {
    kind: 'push',
    routes: [
      ADHKAR_SCREEN,
      {name: '[superId]/index', params: {superId: session.listId}},
      {
        name: '[superId]/[dhikrId]',
        params: {
          superId: session.listId,
          dhikrId: item.dhikrId,
          globalIndex,
          superCategoryTitle: session.listTitle,
        },
      },
    ],
  };
}

export type AdhkarNavigateAction = {
  type: 'NAVIGATE';
  payload: {
    name: '(tabs)';
    pop: true;
    params: {
      screen: '(a.home)';
      params: {
        screen: 'adhkar';
        params: {state: {routes: AdhkarStackRoute[]}};
      };
    };
  };
};

// One action that lays out the whole adhkar stack. Two pushes in a row do
// not work: expo-router resolves the second against the state from before
// the first landed. `pop` returns to the existing tabs when a root screen
// (the mushaf, a link route) is on top, instead of stacking a second copy.
export function adhkarStackAction(
  routes: AdhkarStackRoute[],
): AdhkarNavigateAction {
  return {
    type: 'NAVIGATE',
    payload: {
      name: '(tabs)',
      pop: true,
      params: {
        screen: '(a.home)',
        params: {screen: 'adhkar', params: {state: {routes}}},
      },
    },
  };
}

// `navigation` is the root navigation container (useNavigationContainerRef).
// `current` defaults to the focused adhkar screen. The bayaan://adhkar-playing
// route passes null: it must always navigate (a reveal would leave its empty
// screen showing).
export function openPlayingDhikr(
  navigation: {dispatch(action: AdhkarNavigateAction): void},
  current: AdhkarFocus = getAdhkarFocus(),
): boolean {
  const {session, requestReveal} = useAdhkarSessionStore.getState();
  const plan = planOpenPlaying(session, current);
  if (plan.kind === 'none') return false;
  if (plan.kind === 'reveal') {
    requestReveal();
    return true;
  }
  navigation.dispatch(adhkarStackAction(plan.routes));
  return true;
}
