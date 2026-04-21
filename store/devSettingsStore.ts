import {create} from 'zustand';
import {createJSONStorage, persist} from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface DevSettingsState {
  showFloatingDevMenu: boolean;
  setShowFloatingDevMenu: (show: boolean) => void;
  toggleFloatingDevMenu: () => void;
  forceNetworkBanner: boolean;
  toggleForceNetworkBanner: () => void;
  // Random card design override (-1 = auto/session seed)
  randomCardVariantIndex: number;
  setRandomCardVariantIndex: (index: number) => void;
  cycleRandomCardVariant: (totalVariants: number) => void;
}

export const useDevSettingsStore = create<DevSettingsState>()(
  persist(
    set => ({
      showFloatingDevMenu: false,
      setShowFloatingDevMenu: (show: boolean) =>
        set({showFloatingDevMenu: show}),
      toggleFloatingDevMenu: () =>
        set(state => ({showFloatingDevMenu: !state.showFloatingDevMenu})),
      forceNetworkBanner: false,
      toggleForceNetworkBanner: () =>
        set(state => ({forceNetworkBanner: !state.forceNetworkBanner})),
      randomCardVariantIndex: -1,
      setRandomCardVariantIndex: (index: number) =>
        set({randomCardVariantIndex: index}),
      cycleRandomCardVariant: (totalVariants: number) =>
        set(state => {
          const next = state.randomCardVariantIndex + 1;
          return {randomCardVariantIndex: next >= totalVariants ? -1 : next};
        }),
    }),
    {
      name: 'dev-settings-store',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
