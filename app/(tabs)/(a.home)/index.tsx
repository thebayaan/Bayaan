import React, {useCallback, useLayoutEffect} from 'react';
import {useRouter, useNavigation} from 'expo-router';
import RecitersView from '@/components/RecitersView';
import {Reciter} from '@/data/reciterData';

function HomeScreen() {
  const router = useRouter();
  const navigation = useNavigation();

  useLayoutEffect(() => {
    navigation.setOptions({headerShown: false});
  }, [navigation]);

  const handleReciterPress = useCallback(
    (reciter: Reciter) => {
      router.push({
        pathname: '/(tabs)/(a.home)/reciter/[id]',
        params: {id: reciter.id},
      });
    },
    [router],
  );

  return <RecitersView onReciterPress={handleReciterPress} />;
}

export default React.memo(HomeScreen);
