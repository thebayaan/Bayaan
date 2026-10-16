import {create} from 'zustand';

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
  | {screen: 'adhkarReader'; listId: string; mode?: AdhkarStartMode};

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
  push: entry => set(s => ({stack: [...s.stack, entry]})),
  pop: () => set(s => ({stack: s.stack.slice(0, -1)})),
  reset: () => set({currentTab: 'home', stack: []}),
}));
