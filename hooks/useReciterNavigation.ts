import {useCallback} from 'react';
import {useRouter} from 'expo-router';
import {usePlayerStore} from '@/services/player/store/playerStore';

export const useReciterNavigation = () => {
  const router = useRouter();
  const setSheetMode = usePlayerStore(state => state.setSheetMode);

  const navigateToReciterProfile = useCallback(
    (reciterId: string) => {
      // Hide the player sheet first
      setSheetMode('hidden');

      // Navigate after a short delay to allow the sheet to close
      setTimeout(() => {
        router.push({
          pathname: '/(tabs)/(a.home)/reciter/[id]',
          params: {id: reciterId},
        });
      }, 300); // Delay for bottom sheet animation
    },
    [router, setSheetMode],
  );

  return {navigateToReciterProfile};
};
