// @ai-generated
import {create} from 'zustand';
import {createMMKV} from 'react-native-mmkv';

// Read synchronously at launch, so a folded sidebar doesn't open for a
// frame first.
const mmkv = createMMKV({id: 'tablet-sidebar'});
const COLLAPSED_KEY = 'collapsed';

interface TabletSidebarState {
  /** The reader folded the iPad sidebar down to the icon rail. */
  collapsed: boolean;
  toggleCollapsed: () => void;
}

export const useTabletSidebarStore = create<TabletSidebarState>()(set => ({
  collapsed: mmkv.getBoolean(COLLAPSED_KEY) ?? false,
  toggleCollapsed: () =>
    set(state => {
      const collapsed = !state.collapsed;
      mmkv.set(COLLAPSED_KEY, collapsed);
      return {collapsed};
    }),
}));
