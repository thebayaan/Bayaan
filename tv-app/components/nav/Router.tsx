import React, {useEffect, useRef, useSyncExternalStore} from 'react';
import {TVFocusGuideView, View, type NativeSyntheticEvent} from 'react-native';
import {useNavStore, type ScreenEntry, type TabKey} from '../../store/navStore';
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
import {
  Sidebar,
  SIDEBAR_COLLAPSED_WIDTH,
  focusSidebar,
  requestSidebarFocus,
} from './Sidebar';
import {NowPlayingPill} from './NowPlayingPill';
import {ScreenLayer} from './ScreenLayer';
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
  type BackStep,
} from '../../services/navShell';
import {
  noteAppBlur,
  noteAppFocus,
  setPlaceContentRestore,
} from '../../services/focusReturn';
import {
  createFocusMemory,
  focusInSteps,
  landedSince,
  requestFocus,
} from '../../services/layerFocus';
import {scale} from '../../theme/scale';

/** Bubbling focus and blur events; `target` is the focused host view. */
type FocusEvent = NativeSyntheticEvent<unknown> & {target?: unknown};

// Every focus in the app bubbles up to the Router's root view: whether a
// focus request went anywhere (see services/focusReturn).
const onAppFocus = (e: FocusEvent): void => noteAppFocus(e.target);
const onAppBlur = (e: FocusEvent): void => noteAppBlur(e.target);

function useBackState(): BackState {
  const stack = useNavStore(s => s.stack);
  const tab = useNavStore(s => s.currentTab);
  const sidebarFocused = useNavStore(s => s.sidebarFocused);
  const canReturn = useNavStore(s => s.returnTo !== null);
  const menuOpen = useContextMenuStore(s => s.target !== null);
  const panelOpen = useListeningStore(s => s.panel !== null);
  const trayOpen = useListeningStore(s => s.trayOpen);
  const pickerOpen = useSettingsStore(s => s.picker !== null);
  return {
    stack,
    tab,
    menuOpen,
    panelOpen,
    trayOpen,
    pickerOpen,
    sidebarFocused,
    canReturn,
  };
}

function readBackState(): BackState {
  const nav = useNavStore.getState();
  const listening = useListeningStore.getState();
  return {
    stack: nav.stack,
    tab: nav.currentTab,
    sidebarFocused: nav.sidebarFocused,
    canReturn: nav.returnTo !== null,
    menuOpen: useContextMenuStore.getState().target !== null,
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
  // While a menu is open, only its own handlers (its picker page) come
  // before closing it: the screen underneath keeps its Back for later.
  const overlayOpen = useContextMenuStore.getState().target !== null;
  if (consumeScreenBack({overlayOpen})) return true;
  const state = readBackState();
  let step = backStep(state);
  // Nothing to hand focus to: carry on as if the sidebar had it.
  if (step === 'focusSidebar' && !focusSidebar()) {
    step = backStep({...state, sidebarFocused: true});
  }
  return applyBackStep(step);
}

function applyBackStep(step: BackStep): boolean {
  switch (step) {
    case 'closeMenu':
      useContextMenuStore.getState().close();
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
    case 'returnBack':
      useNavStore.getState().returnBack();
      return true;
    case 'goHome':
      // Home arrives without claiming a first focus of its own (arrival),
      // and focus follows onto Home's item once Home is drawn, so the open
      // sidebar shows where Back went (not the place just left, which OK
      // would reopen) and the next Back leaves from Home's sidebar. Checked
      // and asked again if it doesn't land (focusSidebar).
      useNavStore.getState().switchTab('home', {arrival: 'sidebar'});
      requestAnimationFrame(() => focusSidebar('home'));
      return true;
    case 'exit':
      return false;
  }
}

/**
 * Back while the welcome shows (first launch, or a rerun over Settings): its
 * own steps, or the player opened over it from the pill, never the places
 * hidden behind it.
 */
function handleOnboardingBack(): boolean {
  const overlayOpen = useContextMenuStore.getState().target !== null;
  if (consumeScreenBack({overlayOpen})) return true;
  const state = readBackState();
  if (!state.menuOpen && state.stack.length === 0) return false;
  return applyBackStep(backStep(state));
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
  // Onboarding has no sidebar: only its own steps, or the player over it.
  const canGoBack =
    screenBackHandlers > 0 ||
    (onboarding
      ? backState.menuOpen || backState.stack.length > 0
      : backStep(backState) !== 'exit');
  useTVBackHandler(onboarding ? handleOnboardingBack : handleBack, canGoBack);
  return null;
}

export function Router(): React.ReactElement {
  const currentTab = useNavStore(s => s.currentTab);
  const stack = useNavStore(s => s.stack);
  const {onboarded} = useOnboarded();
  useGlobalRemoteKeys();
  usePlaybackAlerts();

  // The welcome (first launch, or rerun from Settings) replaces the places;
  // its own steps take Back. A rerun while something is queued keeps the
  // pill, the way to the player (nothing is queued on a first launch).
  const onboarding = !onboarded;
  const layers = stackLayers(stack).map(layer => (
    <ScreenLayer key={layer.key} active={layer.active}>
      <StackScreen entry={layer.entry} />
    </ScreenLayer>
  ));
  if (onboarding) {
    return (
      <View style={{flex: 1}} onFocus={onAppFocus} onBlur={onAppBlur}>
        <BackRouting onboarding />
        <ScreenLayer active={stack.length === 0}>
          <OnboardingScreen />
          <NowPlayingPill />
        </ScreenLayer>
        {layers}
        <Overlays />
      </View>
    );
  }

  // The root place stays mounted under stacked screens (hidden), and so do
  // covered stacked screens, so Back lands on the exact row, card, filter,
  // query and scroll that was left. See ScreenLayer.
  return (
    <View style={{flex: 1}} onFocus={onAppFocus} onBlur={onAppBlur}>
      <BackRouting onboarding={false} />
      <ScreenLayer
        active={stack.length === 0}
        contentKey={currentTab}
        fallback={requestSidebarFocus}>
        <RootPlace tab={currentTab} />
      </ScreenLayer>
      {layers}
      <Overlays />
    </View>
  );
}

/**
 * A root place beside the folded sidebar, which opens over it, so focusing
 * the sidebar never reflows the content. The content is one autoFocus
 * guide: Right from the sidebar returns to the element last focused there,
 * and Up and Down never leave it for the sidebar (Up from a top row of chips
 * on Android, Down from a bottom row onto the now-playing tile). It also
 * notes that element itself, for OK on the current place in the sidebar.
 */
const RootPlace = React.memo(function RootPlace({
  tab,
}: {
  tab: TabKey;
}): React.ReactElement {
  const guide = useRef<unknown>(null);
  const memory = useRef(createFocusMemory()).current;
  useEffect(() => {
    let stop: (() => void) | null = null;
    const unregister = setPlaceContentRestore(() => {
      if (!memory.last() && !guide.current) return false;
      stop?.();
      stop = focusInSteps(
        [
          ...memory.recent().map(view => () => requestFocus(view)),
          () => requestFocus(guide.current),
        ],
        landedSince(memory),
      );
      return true;
    });
    return () => {
      stop?.();
      unregister();
    };
  }, [memory]);
  return (
    <>
      <TVFocusGuideView
        ref={node => {
          guide.current = node;
        }}
        autoFocus
        trapFocusUp
        trapFocusDown
        onFocus={(e: FocusEvent) => memory.focus(e.target)}
        onBlur={(e: FocusEvent) => memory.blur(e.target)}
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
        // The adhkar reader keeps its clock top right; the reciter page has
        // '‹ Back' top left.
        <NowPlayingPill
          align={entry.screen === 'adhkarReader' ? 'center' : 'right'}
          clearTopLeft={entry.screen === 'reciterDetail'}
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
      return (
        <ReciterDetailScreen
          reciterId={entry.reciterId}
          rewayahId={entry.rewayahId}
        />
      );
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
