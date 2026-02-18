import {create} from 'zustand';
import {createJSONStorage, persist} from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface DevSettingsState {
  showFloatingDevMenu: boolean;
  setShowFloatingDevMenu: (show: boolean) => void;
  toggleFloatingDevMenu: () => void;
}

export const useDevSettingsStore = create<DevSettingsState>()(
  persist(
    set => ({
      showFloatingDevMenu: false,
      setShowFloatingDevMenu: (show: boolean) =>
        set({showFloatingDevMenu: show}),
      toggleFloatingDevMenu: () =>
        set(state => ({showFloatingDevMenu: !state.showFloatingDevMenu})),
    }),
    {
      name: 'dev-settings-store',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
