import React, {useEffect, useRef, useSyncExternalStore} from 'react';
import {TVFocusGuideView, View} from 'react-native';
import {useNavStore, type ScreenEntry, type TabKey} from '../../store/navStore';
import {useOverlayStore} from '../../store/overlayStore';
import {useContextMenuStore} from '../../store/contextMenuStore';
import {useListeningStore} from '../../store/listeningStore';
import {useSettingsStore} from '../../store/settingsStore';
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
import {Sidebar, SIDEBAR_COLLAPSED_WIDTH, focusSidebar} from './Sidebar';
import {NowPlayingPill} from './NowPlayingPill';
import {ScreenLayer, restoreScreenFocus} from './ScreenLayer';
import {useTVBackHandler} from '../../hooks/useTVBackHandler';
import {
  consumeScreenBack,
  screenBackCount,
  subscribeScreenBack,
} from '../../services/screenBack';
import {
  backStep,
  showsNowPlayingPill,
  stackLayers,
  type BackState,
} from '../../services/navShell';
import {scale} from '../../theme/scale';

function useBackState(): BackState {
  const stack = useNavStore(s => s.stack);
  const tab = useNavStore(s => s.currentTab);
  const sidebarFocused = useNavStore(s => s.sidebarFocused);
  const menuOpen = useContextMenuStore(s => s.target !== null);
  const overlayOpen = useOverlayStore(s => Boolean(s.active));
  const panelOpen = useListeningStore(s => s.panel !== null);
  const trayOpen = useListeningStore(s => s.trayOpen);
  const pickerOpen = useSettingsStore(s => s.picker !== null);
  return {
    stack,
    tab,
    menuOpen,
    overlayOpen,
    panelOpen,
    trayOpen,
    pickerOpen,
    sidebarFocused,
  };
}

function readBackState(): BackState {
  const nav = useNavStore.getState();
  const listening = useListeningStore.getState();
  return {
    stack: nav.stack,
    tab: nav.currentTab,
    sidebarFocused: nav.sidebarFocused,
    menuOpen: useContextMenuStore.getState().target !== null,
    overlayOpen: Boolean(useOverlayStore.getState().active),
    panelOpen: listening.panel !== null,
    trayOpen: listening.trayOpen,
    pickerOpen: useSettingsStore.getState().picker !== null,
  };
}

/**
 * The remote's Back, one step at a time (see backStep): a screen's own open
 * panel first, then whatever is drawn on top, then the stacked screen, and on
 * a root place content -> sidebar -> Home -> out of the app.
 */
function handleBack(): boolean {
  if (consumeScreenBack()) return true;
  const state = readBackState();
  let step = backStep(state);
  // Nothing to hand focus to: carry on as if the sidebar had it.
  if (step === 'focusSidebar' && !focusSidebar()) {
    step = backStep({...state, sidebarFocused: true});
  }
  switch (step) {
    case 'closeMenu':
      useContextMenuStore.getState().close();
      return true;
    case 'closeOverlay':
      useOverlayStore.getState().close();
      return true;
    case 'closePanel':
      useListeningStore.getState().setPanel(null);
      return true;
    case 'lowerTray':
      useListeningStore.getState().setTrayOpen(false);
      return true;
    case 'closePicker':
      useSettingsStore.getState().setPicker(null);
      return true;
    case 'pop':
      useNavStore.getState().pop();
      return true;
    case 'focusSidebar':
      return true;
    case 'goHome':
      useNavStore.getState().switchTab('home');
      return true;
    case 'exit':
      return false;
  }
}

/**
 * Puts focus back on the opener when a context menu closes over the same
 * screen (one that pushed a screen leaves focus to it). The menu's rows go
 * away with it, and neither focus engine would otherwise find the way back.
 */
function useMenuFocusReturn(): void {
  const menuOpen = useContextMenuStore(s => s.target !== null);
  const openedOver = useRef<ScreenEntry[] | null>(null);
  useEffect(() => {
    if (menuOpen) {
      openedOver.current = useNavStore.getState().stack;
      return;
    }
    const over = openedOver.current;
    openedOver.current = null;
    if (!over || useNavStore.getState().stack !== over) return;
    const frame = requestAnimationFrame(() => {
      if (useNavStore.getState().stack === over) restoreScreenFocus();
    });
    return () => cancelAnimationFrame(frame);
  }, [menuOpen]);
}

/**
 * Wires the remote's Back (see handleBack). Its own component, so the state
 * it follows (sidebar focus, panels, pickers) never redraws the screens.
 *
 * tvOS: Menu reaches Back only while it is enabled, and while it is it can't
 * leave the app, so it is released exactly when Back would exit.
 */
function BackRouting({onboarding}: {onboarding: boolean}): null {
  const backState = useBackState();
  const screenBackHandlers = useSyncExternalStore(
    subscribeScreenBack,
    screenBackCount,
  );
  // Onboarding has no sidebar or stack: only its own steps take Back.
  const canGoBack =
    screenBackHandlers > 0 || (!onboarding && backStep(backState) !== 'exit');
  useTVBackHandler(handleBack, canGoBack);
  return null;
}

export function Router(): React.ReactElement {
  const currentTab = useNavStore(s => s.currentTab);
  const stack = useNavStore(s => s.stack);
  const {onboarded} = useOnboarded();
  const {reciters} = useReciters();
  useGlobalRemoteKeys();
  usePlaybackAlerts();
  useMenuFocusReturn();

  const onboarding = !onboarded && reciters.length > 0;
  if (onboarding) {
    return (
      <View style={{flex: 1}}>
        <BackRouting onboarding />
        <OnboardingScreen />
        <Overlays />
      </View>
    );
  }

  // The root place stays mounted under stacked screens (hidden), and so do
  // covered stacked screens, so Back lands on the exact row, card, filter,
  // query and scroll that was left. See ScreenLayer.
  return (
    <View style={{flex: 1}}>
      <BackRouting onboarding={false} />
      <ScreenLayer active={stack.length === 0} contentKey={currentTab}>
        <RootPlace tab={currentTab} />
      </ScreenLayer>
      {stackLayers(stack).map(layer => (
        <ScreenLayer key={layer.key} active={layer.active}>
          <StackScreen entry={layer.entry} />
        </ScreenLayer>
      ))}
      <Overlays />
    </View>
  );
}

/**
 * A root place beside the folded sidebar, which opens over it, so focusing
 * the sidebar never reflows the content. The content is one autoFocus
 * guide: Right from the sidebar returns to the element last focused there,
 * and Up and Down never leave it for the sidebar (Up from a top row of chips
 * on Android, Down from a bottom row onto the now-playing tile).
 */
const RootPlace = React.memo(function RootPlace({
  tab,
}: {
  tab: TabKey;
}): React.ReactElement {
  return (
    <>
      <TVFocusGuideView
        autoFocus
        trapFocusUp
        trapFocusDown
        style={{flex: 1, marginLeft: scale(SIDEBAR_COLLAPSED_WIDTH)}}>
        {tab === 'home' && <HomeScreen />}
        {tab === 'search' && <SearchScreen />}
        {tab === 'surahs' && <SurahsScreen />}
        {tab === 'reciters' && <CatalogGridScreen />}
        {tab === 'adhkar' && <AdhkarScreen />}
        {tab === 'collection' && <CollectionScreen />}
        {tab === 'settings' && <SettingsScreen />}
      </TVFocusGuideView>
      <Sidebar />
    </>
  );
});

/** A stacked screen, with the way back to the player where it has no sidebar. */
const StackScreen = React.memo(function StackScreen({
  entry,
}: {
  entry: ScreenEntry;
}): React.ReactElement {
  return (
    <>
      <StackScreenBody entry={entry} />
      {showsNowPlayingPill(entry) ? (
        // The adhkar reader keeps its clock top right.
        <NowPlayingPill
          align={entry.screen === 'adhkarReader' ? 'center' : 'right'}
        />
      ) : null}
    </>
  );
});

function StackScreenBody({entry}: {entry: ScreenEntry}): React.ReactElement {
  switch (entry.screen) {
    case 'nowPlaying':
      return <NowPlayingScreen />;
    case 'reciterDetail':
      return <ReciterDetailScreen reciterId={entry.reciterId} />;
    case 'playlist':
      return <PlaylistScreen playlistId={entry.playlistId} />;
    case 'playlistEdit':
      return (
        <PlaylistEditScreen playlistId={entry.playlistId} seed={entry.seed} />
      );
    case 'adhkarReader':
      return <AdhkarReaderScreen listId={entry.listId} mode={entry.mode} />;
  }
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
