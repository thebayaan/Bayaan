import {useCallback} from 'react';
import {useRouter} from 'expo-router';

export const useReciterNavigation = () => {
  const router = useRouter();

  const navigateToReciterProfile = useCallback(
    async (reciterId: string) => {
      await router.back(); // Dismiss player screen first
      router.push({
        pathname: '/(tabs)/(home)/reciter/[id]',
        params: {id: reciterId},
      });
    },
    [router],
  );

  return {navigateToReciterProfile};
};
