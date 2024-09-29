import {useRouter} from 'expo-router';

export const usePlayerNavigation = () => {
  const router = useRouter();

  const navigateToPlayer = (
    artwork: string | undefined,
    useReplace = false,
  ) => {
    const navigationFunction = useReplace ? router.replace : router.push;
    navigationFunction({
      pathname: 'player',
      params: {artwork},
    });
  };

  return {navigateToPlayer};
};
