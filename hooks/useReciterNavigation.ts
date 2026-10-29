import {useCallback} from 'react';
import {useRouter, usePathname, useSegments} from 'expo-router';
import {reciterProfilePathname} from '@/hooks/useTabReciterPath'; // @ai
import {usePlayerStore} from '@/services/player/store/playerStore';

export const useReciterNavigation = () => {
  const router = useRouter();
  const pathname = usePathname();
  const segments = useSegments(); // @ai
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
        router.push({
          // Stay in the tab the user is on. @ai
          pathname: reciterProfilePathname(segments),
          params: {id: reciterId},
        });
      }, 300); // Delay for bottom sheet animation
    },
    [router, pathname, segments, setSheetMode],
  );

  return {navigateToReciterProfile};
};
