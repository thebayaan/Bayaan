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
import {Sidebar, SIDEBAR_COLLAPSED_WIDTH} from './Sidebar';
import {useTVBackHandler} from '../../hooks/useTVBackHandler';
import {scale} from '../../theme/scale';

export function Router(): React.ReactElement {
  const currentTab = useNavStore(s => s.currentTab);
  const stack = useNavStore(s => s.stack);
  const pop = useNavStore(s => s.pop);
  const switchTab = useNavStore(s => s.switchTab);
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
    // Back from any other place returns home before it leaves the app.
    if (currentTab !== 'home') {
      switchTab('home');
      return true;
    }
    return false;
  }, [stack.length, pop, currentTab, switchTab]);

  const contextMenuOpen = useContextMenuStore(s => s.reciterId !== null);
  const overlayOpen = useOverlayStore(s => Boolean(s.active));
  useTVBackHandler(
    handleBack,
    contextMenuOpen || overlayOpen || stack.length > 0 || currentTab !== 'home',
  );

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
  }

  // Root places share the sidebar; screens sit beside its folded width and it
  // opens over them, so focusing it never reflows the content.
  return (
    <View style={{flex: 1}}>
      <View style={{flex: 1, paddingLeft: scale(SIDEBAR_COLLAPSED_WIDTH)}}>
        {currentTab === 'home' && <HomeScreen />}
        {currentTab === 'search' && <SearchScreen />}
        {currentTab === 'reciters' && <CatalogGridScreen />}
        {currentTab === 'collection' && <CollectionScreen />}
        {currentTab === 'settings' && <SettingsScreen />}
      </View>
      <Sidebar />
      <ReciterContextMenu />
    </View>
  );
}
