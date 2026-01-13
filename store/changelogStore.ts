import {create} from 'zustand';
import {createJSONStorage, persist} from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface ChangelogState {
  lastViewedVersion: string | null;
  lastViewedDate: string | null;
  hasUnreadChanges: boolean;
  setLastViewedVersion: (version: string) => void;
  checkForUnreadChanges: (currentVersion: string) => void;
  markChangelogAsRead: (version: string) => void;
}

export const useChangelogStore = create<ChangelogState>()(
  persist(
    (set, get) => ({
      lastViewedVersion: null,
      lastViewedDate: null,
      hasUnreadChanges: false,

      setLastViewedVersion: (version: string) =>
        set({
          lastViewedVersion: version,
          lastViewedDate: new Date().toISOString(),
        }),

      checkForUnreadChanges: (currentVersion: string) => {
        const {lastViewedVersion} = get();
        const hasUnread =
          !lastViewedVersion || lastViewedVersion !== currentVersion;
        set({hasUnreadChanges: hasUnread});
      },

      markChangelogAsRead: (version: string) =>
        set({
          lastViewedVersion: version,
          lastViewedDate: new Date().toISOString(),
          hasUnreadChanges: false,
        }),
    }),
    {
      name: 'changelog-storage',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
