import React, {
  useCallback,
  useContext, // @ai
  useLayoutEffect,
} from 'react';
import {View} from 'react-native'; // @ai
import {useRouter, useNavigation} from 'expo-router';
import RecitersView from '@/components/RecitersView';
import {Reciter} from '@/data/reciterData';
import {HomeHeldContext} from '@/hooks/readerRestoreState'; // @ai
// @ai-start
import {HomeView} from '@/components/home/HomeView';
import {useResponsive} from '@/hooks/useResponsive';
import {isFeatureEnabled} from '@/config/featureFlags';
// @ai-end

function HomeScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  // @ai-start
  // Under a reader that this launch restores, nobody sees this route, and its
  // work competes with the reader's first page. So it stays empty until the
  // restore of the root layout lets it render.
  const waitingForReader = useContext(HomeHeldContext);
  // Phones get the new Home behind its flag; iPad keeps its shelves for now.
  const {isTablet} = useResponsive();
  const newHome = isFeatureEnabled('homeRedesign') && !isTablet;
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

  if (newHome) return <HomeView />; // @ai
  return <RecitersView onReciterPress={handleReciterPress} />;
}

export default React.memo(HomeScreen);
