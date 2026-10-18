import {create} from 'zustand';
import type {PlaylistItem} from '../services/playlistsStore';

export type TabKey =
  | 'home'
  | 'search'
  | 'surahs'
  | 'reciters'
  | 'adhkar'
  | 'collection'
  | 'settings';

/**
 * How an adhkar list opens: read at your own pace (default), listen through
 * with each recitation playing and advancing on its own, or have each dhikr
 * counted out for you (recitation repeated to its count).
 */
export type AdhkarStartMode = 'read' | 'listen' | 'count';

export type ScreenEntry =
  | {screen: 'nowPlaying'}
  | {screen: 'reciterDetail'; reciterId: string; rewayahId?: string}
  | {screen: 'adhkarReader'; listId: string; mode?: AdhkarStartMode}
  | {screen: 'playlist'; playlistId: string}
  /** No id creates a playlist, seeded with `seed` when one is given. */
  | {screen: 'playlistEdit'; playlistId?: string; seed?: PlaylistItem};

/** Where a jump from inside content left (see jumpTo). */
export type ReturnPlace = {tab: TabKey; stack: ScreenEntry[]};

type NavState = {
  currentTab: TabKey;
  stack: ScreenEntry[];
  /**
   * Focus is on the sidebar (a root place's navigation) rather than in the
   * place's content. Back on a root place steps content -> sidebar -> Home ->
   * out of the app, so it never leaves from deep in the content.
   */
  sidebarFocused: boolean;
  setSidebarFocused: (focused: boolean) => void;
  /**
   * Where the place showing was jumped to from (a button inside content,
   * such as an empty playlist's "Browse surahs"): Back from that place's
   * sidebar goes back there, before Home. Null after any other switch.
   */
  returnTo: ReturnPlace | null;
  /**
   * One-shot: the place was entered by Back, onto its sidebar item (Back
   * from another place's sidebar goes Home). Its screen claims no first
   * focus of its own, so focus stays on the sidebar; the screen clears it.
   */
  arrival: 'sidebar' | null;
  /** Switches place from the sidebar (or Back): no way back but Home. */
  switchTab: (tab: TabKey, options?: {arrival?: 'sidebar'}) => void;
  /** Switches place from inside content, remembering where it came from. */
  jumpTo: (tab: TabKey) => void;
  /** Goes back to where the last jump came from (see returnTo). */
  returnBack: () => void;
  clearArrival: () => void;
  push: (entry: ScreenEntry) => void;
  pop: () => void;
  reset: () => void;
};

export const useNavStore = create<NavState>(set => ({
  currentTab: 'home',
  stack: [],
  sidebarFocused: false,
  setSidebarFocused: focused => set({sidebarFocused: focused}),
  returnTo: null,
  arrival: null,
  switchTab: (tab, options) =>
    set({
      currentTab: tab,
      stack: [],
      returnTo: null,
      arrival: options?.arrival ?? null,
    }),
  jumpTo: tab =>
    set(s => ({
      currentTab: tab,
      stack: [],
      returnTo: {tab: s.currentTab, stack: s.stack},
      arrival: null,
    })),
  returnBack: () =>
    set(s =>
      s.returnTo
        ? {
            currentTab: s.returnTo.tab,
            stack: s.returnTo.stack,
            returnTo: null,
            arrival: null,
          }
        : s,
    ),
  clearArrival: () => set(s => (s.arrival === null ? s : {arrival: null})),
  push: entry => set(s => ({stack: pushed(s.stack, entry)})),
  pop: () => set(s => ({stack: s.stack.slice(0, -1)})),
  reset: () =>
    set({
      currentTab: 'home',
      stack: [],
      sidebarFocused: false,
      returnTo: null,
      arrival: null,
    }),
}));

function sameEntry(a: ScreenEntry, b: ScreenEntry): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * The stack after a push. Pushing the screen already on top does nothing (a
 * double press), and there is only ever one player: pushing it while it sits
 * deeper in the stack goes back to it instead of stacking a second one.
 */
export function pushed(
  stack: ScreenEntry[],
  entry: ScreenEntry,
): ScreenEntry[] {
  const top = stack[stack.length - 1];
  if (top && sameEntry(top, entry)) return stack;
  if (entry.screen === 'nowPlaying') {
    const at = stack.findIndex(e => e.screen === 'nowPlaying');
    if (at >= 0) return stack.slice(0, at + 1);
  }
  return [...stack, entry];
}
