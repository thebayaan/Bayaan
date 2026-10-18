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
  | {screen: 'reciterDetail'; reciterId: string}
  | {screen: 'adhkarReader'; listId: string; mode?: AdhkarStartMode}
  | {screen: 'playlist'; playlistId: string}
  /** No id creates a playlist, seeded with `seed` when one is given. */
  | {screen: 'playlistEdit'; playlistId?: string; seed?: PlaylistItem};

type NavState = {
  currentTab: TabKey;
  stack: ScreenEntry[];
  switchTab: (tab: TabKey) => void;
  push: (entry: ScreenEntry) => void;
  pop: () => void;
  reset: () => void;
};

export const useNavStore = create<NavState>(set => ({
  currentTab: 'home',
  stack: [],
  switchTab: tab => set({currentTab: tab, stack: []}),
  push: entry => set(s => ({stack: pushed(s.stack, entry)})),
  pop: () => set(s => ({stack: s.stack.slice(0, -1)})),
  reset: () => set({currentTab: 'home', stack: []}),
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
