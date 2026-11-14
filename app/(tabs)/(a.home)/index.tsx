import React, {
  useCallback,
  useContext, // @ai
  useLayoutEffect,
} from 'react';
import {View} from 'react-native'; // @ai
import {useRouter, useNavigation} from 'expo-router';
import RecitersView from '@/components/RecitersView';
import {Reciter} from '@/data/reciterData';
import {HomeHeldContext} from '@/services/mushaf/readerRestoreState'; // @ai

function HomeScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  // @ai-start
  // Under a reader that this launch restores, nobody sees this route, and its
  // work competes with the reader's first page. So it stays empty until the
  // restore of the root layout lets it render.
  const waitingForReader = useContext(HomeHeldContext);
  // @ai-end

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

  if (waitingForReader) return <View style={{flex: 1}} />; // @ai

  return <RecitersView onReciterPress={handleReciterPress} />;
}

export default React.memo(HomeScreen);
