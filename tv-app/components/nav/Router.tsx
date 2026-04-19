import React, {useCallback} from 'react';
import {View} from 'react-native';
import {useNavStore} from '../../store/navStore';
import {useOverlayStore} from '../../store/overlayStore';
import {useContextMenuStore} from '../../store/contextMenuStore';
import {useOnboarded} from '../../hooks/useOnboarded';
import {useReciters} from '../../hooks/useReciters';
import {HomeScreen} from '../../screens/HomeScreen';
import {SearchScreen} from '../../screens/SearchScreen';
import {CollectionScreen} from '../../screens/CollectionScreen';
import {SettingsScreen} from '../../screens/SettingsScreen';
import {NowPlayingScreen} from '../../screens/NowPlayingScreen';
import {OnboardingScreen} from '../../screens/OnboardingScreen';
import {ReciterDetailScreen} from '../../screens/ReciterDetailScreen';
import {CatalogGridScreen} from '../../screens/CatalogGridScreen';
import {ReciterContextMenu} from '../overlays/ReciterContextMenu';
import {useTVBackHandler} from '../../hooks/useTVBackHandler';

export function Router(): React.ReactElement {
  const currentTab = useNavStore(s => s.currentTab);
  const stack = useNavStore(s => s.stack);
  const pop = useNavStore(s => s.pop);
  const {onboarded} = useOnboarded();
  const {reciters} = useReciters();

  const handleBack = useCallback((): boolean => {
    if (useContextMenuStore.getState().reciterId) {
      useContextMenuStore.getState().close();
      return true;
    }
    if (useOverlayStore.getState().active) {
      useOverlayStore.getState().close();
      return true;
    }
    if (stack.length > 0) {
      pop();
      return true;
    }
    return false;
  }, [stack.length, pop]);

  useTVBackHandler(handleBack);

  if (!onboarded && reciters.length > 0) {
    return (
      <View style={{flex: 1}}>
        <OnboardingScreen />
        <ReciterContextMenu />
      </View>
    );
  }

  const top = stack[stack.length - 1];

  if (top) {
    if (top.screen === 'nowPlaying')
      return (
        <View style={{flex: 1}}>
          <NowPlayingScreen />
          <ReciterContextMenu />
        </View>
      );
    if (top.screen === 'reciterDetail')
      return (
        <View style={{flex: 1}}>
          <ReciterDetailScreen key={top.reciterId} reciterId={top.reciterId} />
          <ReciterContextMenu />
        </View>
      );
    if (top.screen === 'catalogGrid')
      return (
        <View style={{flex: 1}}>
          <CatalogGridScreen />
          <ReciterContextMenu />
        </View>
      );
  }

  return (
    <View style={{flex: 1}}>
      {currentTab === 'home' && <HomeScreen />}
      {currentTab === 'search' && <SearchScreen />}
      {currentTab === 'collection' && <CollectionScreen />}
      {currentTab === 'settings' && <SettingsScreen />}
      <ReciterContextMenu />
    </View>
  );
}
