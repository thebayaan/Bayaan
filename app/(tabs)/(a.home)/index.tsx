import React, {
  useCallback,
  useLayoutEffect,
  useSyncExternalStore, // @ai
} from 'react';
import {View} from 'react-native'; // @ai
import {useRouter, useNavigation} from 'expo-router';
import RecitersView from '@/components/RecitersView';
import {Reciter} from '@/data/reciterData';
// @ai-start
import {
  readerRestoreHoldsHome,
  subscribeReaderRestore,
} from '@/services/mushaf/readerRestoreState';
// @ai-end

function HomeScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  // @ai-start
  // Under a reader that this launch restores, nobody sees this route, and its
  // work competes with the reader's first page. So it stays empty until the
  // restore state lets it render.
  const waitingForReader = useSyncExternalStore(
    subscribeReaderRestore,
    readerRestoreHoldsHome,
  );
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
