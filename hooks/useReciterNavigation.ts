import {useCallback} from 'react';
import {usePathname} from 'expo-router';
import {reciterProfilePathname} from '@/hooks/useTabReciterPath'; // @ai
import {usePlayerStore} from '@/services/player/store/playerStore';
// @ai-start
import {
  currentTabGroup,
  openFromTabs,
} from '@/services/navigation/openFromTabs';
// @ai-end

export const useReciterNavigation = () => {
  const pathname = usePathname();
  const setSheetMode = usePlayerStore(state => state.setSheetMode);

  const navigateToReciterProfile = useCallback(
    (reciterId: string) => {
      // Hide the player sheet first
      setSheetMode('hidden');

      // Skip navigation if already on this reciter's profile
      const alreadyOnReciter = pathname.endsWith(`/reciter/${reciterId}`);
      if (alreadyOnReciter) return;

      // Navigate after a short delay to allow the sheet to close
      setTimeout(() => {
        // @ai-start
        // Open it in the tab the user is on: the one under the Mushaf when
        // the player or a sheet is over it. openFromTabs closes the Mushaf
        // first; pushed from it, the profile would land in a second copy of
        // the tabs with no way back.
        openFromTabs({
          pathname: reciterProfilePathname(['(tabs)', currentTabGroup() ?? '']),
          params: {id: reciterId},
        });
        // @ai-end
      }, 300); // Delay for bottom sheet animation
    },
    [pathname, setSheetMode],
  );

  return {navigateToReciterProfile};
};
