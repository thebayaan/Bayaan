import {useCallback} from 'react';
import {useRouter} from 'expo-router';
import {usePlayerStore} from '@/store/playerStore';

export const useReciterNavigation = () => {
  const router = useRouter();
  const setPlayerSheetVisible = usePlayerStore(
    state => state.setPlayerSheetVisible,
  );

  const navigateToReciterProfile = useCallback(
    (reciterId: string) => {
      // Hide the player sheet first
      setPlayerSheetVisible(false);

      // Navigate after a short delay to allow the sheet to close
      setTimeout(() => {
        router.push({
          pathname: '/(tabs)/(home)/reciter/[id]',
          params: {id: reciterId},
        });
      }, 300); // Delay for bottom sheet animation
    },
    [router, setPlayerSheetVisible],
  );

  return {navigateToReciterProfile};
};
