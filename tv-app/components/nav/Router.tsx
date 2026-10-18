import React, {useCallback} from 'react';
import {View} from 'react-native';
import {useNavStore} from '../../store/navStore';
import {useOverlayStore} from '../../store/overlayStore';
import {useContextMenuStore} from '../../store/contextMenuStore';
import {useListeningStore} from '../../store/listeningStore';
import {useSettingsStore} from '../../store/settingsStore';
import {useOnboarded} from '../../hooks/useOnboarded';
import {HomeScreen} from '../../screens/HomeScreen';
import {SearchScreen} from '../../screens/SearchScreen';
import {CollectionScreen} from '../../screens/CollectionScreen';
import {SettingsScreen} from '../../screens/SettingsScreen';
import {NowPlayingScreen} from '../../screens/NowPlayingScreen';
import {OnboardingScreen} from '../../screens/OnboardingScreen';
import {ReciterDetailScreen} from '../../screens/ReciterDetailScreen';
import {CatalogGridScreen} from '../../screens/CatalogGridScreen';
import {SurahsScreen} from '../../screens/SurahsScreen';
import {AdhkarScreen} from '../../screens/AdhkarScreen';
import {AdhkarReaderScreen} from '../../screens/AdhkarReaderScreen';
import {PlaylistScreen} from '../../screens/PlaylistScreen';
import {PlaylistEditScreen} from '../../screens/PlaylistEditScreen';
import {ReciterContextMenu} from '../overlays/ReciterContextMenu';
import {SurahContextMenu} from '../overlays/SurahContextMenu';
import {Toast} from '../overlays/Toast';
import {useGlobalRemoteKeys} from '../../hooks/useGlobalRemoteKeys';
import {usePlaybackAlerts} from '../../hooks/usePlaybackAlerts';
import {Sidebar, SIDEBAR_COLLAPSED_WIDTH} from './Sidebar';
import {useTVBackHandler} from '../../hooks/useTVBackHandler';
import {consumeScreenBack} from '../../services/screenBack';
import {scale} from '../../theme/scale';

export function Router(): React.ReactElement {
  const currentTab = useNavStore(s => s.currentTab);
  const stack = useNavStore(s => s.stack);
  const pop = useNavStore(s => s.pop);
  const switchTab = useNavStore(s => s.switchTab);
  const {onboarded} = useOnboarded();
  useGlobalRemoteKeys();
  usePlaybackAlerts();

  const handleBack = useCallback((): boolean => {
    // The welcome handles its own Back (also when opened from Settings,
    // where the tab below it would otherwise take the press).
    if (!onboarded) return false;
    // A screen's own open panel (e.g. Search's reciter picker) closes first.
    if (consumeScreenBack()) return true;
    if (useContextMenuStore.getState().target) {
      useContextMenuStore.getState().close();
      return true;
    }
    if (useOverlayStore.getState().active) {
      useOverlayStore.getState().close();
      return true;
    }
    if (useListeningStore.getState().panel) {
      useListeningStore.getState().setPanel(null);
      return true;
    }
    if (useSettingsStore.getState().picker) {
      useSettingsStore.getState().setPicker(null);
      return true;
    }
    if (useListeningStore.getState().trayOpen) {
      useListeningStore.getState().setTrayOpen(false);
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
  }, [onboarded, stack.length, pop, currentTab, switchTab]);

  const contextMenuOpen = useContextMenuStore(s => s.target !== null);
  const overlayOpen = useOverlayStore(s => Boolean(s.active));
  useTVBackHandler(
    handleBack,
    contextMenuOpen || overlayOpen || stack.length > 0 || currentTab !== 'home',
  );

  if (!onboarded) {
    return (
      <View style={{flex: 1}}>
        <OnboardingScreen />
        <Overlays />
      </View>
    );
  }

  const top = stack[stack.length - 1];

  if (top) {
    if (top.screen === 'nowPlaying')
      return (
        <View style={{flex: 1}}>
          <NowPlayingScreen />
          <Overlays />
        </View>
      );
    if (top.screen === 'reciterDetail')
      return (
        <View style={{flex: 1}}>
          <ReciterDetailScreen key={top.reciterId} reciterId={top.reciterId} />
          <Overlays />
        </View>
      );
    if (top.screen === 'playlist')
      return (
        <View style={{flex: 1}}>
          <PlaylistScreen key={top.playlistId} playlistId={top.playlistId} />
          <Overlays />
        </View>
      );
    if (top.screen === 'playlistEdit')
      return (
        <View style={{flex: 1}}>
          <PlaylistEditScreen
            key={`${top.playlistId ?? 'new'}:${top.seed?.surahNumber ?? ''}`}
            playlistId={top.playlistId}
            seed={top.seed}
          />
          <Toast />
        </View>
      );
    if (top.screen === 'adhkarReader')
      return (
        <View style={{flex: 1}}>
          <AdhkarReaderScreen
            key={top.listId}
            listId={top.listId}
            mode={top.mode}
          />
          <Toast />
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
        {currentTab === 'surahs' && <SurahsScreen />}
        {currentTab === 'reciters' && <CatalogGridScreen />}
        {currentTab === 'adhkar' && <AdhkarScreen />}
        {currentTab === 'collection' && <CollectionScreen />}
        {currentTab === 'settings' && <SettingsScreen />}
      </View>
      <Sidebar />
      <Overlays />
    </View>
  );
}

/** The menus and the toast, drawn over whichever screen is showing. */
function Overlays(): React.ReactElement {
  return (
    <>
      <ReciterContextMenu />
      <SurahContextMenu />
      <Toast />
    </>
  );
}
