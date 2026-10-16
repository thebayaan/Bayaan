import {create} from 'zustand';

export type TabKey = 'home' | 'search' | 'reciters' | 'collection' | 'settings';

export type ScreenEntry =
  | {screen: 'nowPlaying'}
  | {screen: 'reciterDetail'; reciterId: string};

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
