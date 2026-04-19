import React, {useCallback} from 'react';
import {View} from 'react-native';
import {useNavStore} from '../../store/navStore';
import {useOverlayStore} from '../../store/overlayStore';
import {HomeScreen} from '../../screens/HomeScreen';
import {SearchScreen} from '../../screens/SearchScreen';
import {CollectionScreen} from '../../screens/CollectionScreen';
import {SettingsScreen} from '../../screens/SettingsScreen';
import {NowPlayingScreen} from '../../screens/NowPlayingScreen';
import {ReciterDetailScreen} from '../../screens/ReciterDetailScreen';
import {CatalogGridScreen} from '../../screens/CatalogGridScreen';
import {useTVBackHandler} from '../../hooks/useTVBackHandler';

export function Router(): React.ReactElement {
  const currentTab = useNavStore(s => s.currentTab);
  const stack = useNavStore(s => s.stack);
  const pop = useNavStore(s => s.pop);

  const handleBack = useCallback((): boolean => {
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

  const top = stack[stack.length - 1];

  if (top) {
    if (top.screen === 'nowPlaying') return <NowPlayingScreen />;
    if (top.screen === 'reciterDetail')
      return <ReciterDetailScreen reciterId={top.reciterId} />;
    if (top.screen === 'catalogGrid') return <CatalogGridScreen />;
  }

  return (
    <View style={{flex: 1}}>
      {currentTab === 'home' && <HomeScreen />}
      {currentTab === 'search' && <SearchScreen />}
      {currentTab === 'collection' && <CollectionScreen />}
      {currentTab === 'settings' && <SettingsScreen />}
    </View>
  );
}
