// @ai-generated
/**
 * The iPad sidebar driving real navigation state: Expo Router's tab
 * navigator with stacks inside, laid out as in app/(tabs).
 */
import 'react-native-gesture-handler/jestSetup';
import React, {act} from 'react';
import {View} from 'react-native';
import TestRenderer, {type ReactTestRenderer} from 'react-test-renderer';
import {router, type NavigationState} from 'expo-router';
import {Tabs} from 'expo-router/js-tabs';
import Stack from 'expo-router/build/layouts/JSStack';
import {ExpoRoot} from 'expo-router/build/ExpoRoot';
import {navigationRef} from 'expo-router/build/global-state/navigationRef';
import {getMockContext} from 'expo-router/build/testing-library/mock-config';
import {TabletSidebar} from '../TabletSidebar';
import {useTabletSidebarStore} from '@/store/tabletSidebarStore';
import {
  pressKeyForTests,
  resetKeyCommandsForTests,
} from '@/services/keyboard/keyCommands';
import {takeSearchFocusRequest} from '@/services/keyboard/searchFocus';
import {BayaanKeyboard} from '@/modules/bayaan-keyboard';

let mockWidth = 1032;

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({width: mockWidth}),
}));
jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: {colors: {text: '#111111', background: '#ffffff'}},
    isDarkMode: false,
  }),
}));
jest.mock('@/components/Icons', () => {
  const Icon = () => null;
  return new Proxy({}, {get: () => Icon});
});
jest.mock('@expo/vector-icons', () => ({Feather: () => null}));
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({top: 0, bottom: 0, left: 0, right: 0}),
}));
jest.mock('@/services/player/store/playerStore', () => ({
  usePlayerStore: (select: (s: unknown) => unknown) =>
    select({queue: {tracks: [], currentIndex: 0}}),
}));
jest.mock('@/components/tablet/TabletDockedPlayer', () => ({
  TabletDockedPlayer: () => null,
}));
jest.mock('@/modules/bayaan-keyboard', () => ({
  BayaanKeyboard: {
    isAvailable: true,
    setCommands: jest.fn(),
    addKeyCommandListener: jest.fn(() => () => undefined),
  },
}));
jest.mock('@/config/branding', () => ({
  __esModule: true,
  default: {appName: 'Bayaan'},
}));

const Blank = () => null;

const StackLayout = () => <Stack screenOptions={{headerShown: false}} />;

// The tab stacks anchor on their first screen, as their layouts in app/(tabs)
// do.
const TabStackLayout = {
  default: StackLayout,
  unstable_settings: {initialRouteName: 'index'},
};

const TAB_ROUTES = [
  '(a.home)',
  '(b.surahs)',
  '(b.search)',
  '(c.collection)',
  '(d.settings)',
];

const TabsLayout = () => (
  <Tabs
    screenOptions={{headerShown: false}}
    tabBar={props => <TabletSidebar {...props} />}>
    {TAB_ROUTES.map(name => (
      <Tabs.Screen key={name} name={name} />
    ))}
  </Tabs>
);

const COLLECTION_SCREENS = [
  'index',
  'collection/loved',
  'collection/favorite-reciters',
  'collection/playlists',
  'collection/downloads',
  'collection/uploads',
  'collection/bookmarks',
  'collection/notes',
  'playlist/[id]',
];

const APP = {
  _layout: StackLayout,
  '(tabs)/_layout': TabsLayout,
  '(tabs)/(a.home)/_layout': TabStackLayout,
  '(tabs)/(a.home)/index': Blank,
  '(tabs)/(a.home)/adhkar/_layout': StackLayout,
  '(tabs)/(a.home)/adhkar/index': Blank,
  '(tabs)/(a.home)/adhkar/[superId]/index': Blank,
  '(tabs)/(a.home)/reciter/[id]': Blank,
  '(tabs)/(b.surahs)/_layout': TabStackLayout,
  '(tabs)/(b.surahs)/index': Blank,
  '(tabs)/(b.search)/_layout': TabStackLayout,
  '(tabs)/(b.search)/index': Blank,
  '(tabs)/(c.collection)/_layout': TabStackLayout,
  ...Object.fromEntries(
    COLLECTION_SCREENS.map(name => [`(tabs)/(c.collection)/${name}`, Blank]),
  ),
  '(tabs)/(d.settings)/_layout': TabStackLayout,
  '(tabs)/(d.settings)/index': Blank,
};

let mounted: ReactTestRenderer | undefined;

function renderApp(location = '/'): ReactTestRenderer {
  process.env.EXPO_ROUTER_IMPORT_MODE = 'sync';
  act(() => {
    mounted = TestRenderer.create(
      <ExpoRoot context={getMockContext(APP)} location={location} />,
    );
  });
  act(() => jest.runOnlyPendingTimers());
  if (!mounted) throw new Error('not rendered');
  return mounted;
}

type AnyState = NavigationState | undefined;

/** The tab navigator's state. */
function tabState(): NavigationState {
  let state = navigationRef.getRootState() as AnyState;
  while (state && state.type !== 'tab') {
    state = state.routes[state.index].state as AnyState;
  }
  if (!state) throw new Error('no tab state');
  return state;
}

/** The screens of a tab's stack, bottom to top. */
function stackOf(tab: string): string[] {
  const route = tabState().routes.find(r => r.name === tab);
  const stack = route?.state as AnyState;
  return (stack?.routes ?? []).map(r => r.name);
}

/** The route names on show, from the tab down. */
function onShow(): string[] {
  const names: string[] = [];
  let state: AnyState = tabState();
  while (state) {
    const route = state.routes[state.index];
    names.push(route.name);
    state = route.state as AnyState;
  }
  return names;
}

function push(href: string) {
  act(() => router.push(href as never));
  act(() => jest.runOnlyPendingTimers());
}

function items(r: ReactTestRenderer) {
  return r.root.findAll(
    n =>
      n.props.accessibilityRole === 'tab' &&
      typeof n.props.onPress === 'function',
  );
}

function press(r: ReactTestRenderer, label: string) {
  const item = items(r).find(n => n.props.accessibilityLabel === label);
  if (!item) throw new Error(`no item ${label}`);
  act(() => item.props.onPress());
  // Let the stacks' tabPress pops run.
  act(() => jest.runOnlyPendingTimers());
}

function selected(r: ReactTestRenderer): string[] {
  return items(r)
    .filter(n => n.props.accessibilityState?.selected)
    .map(n => n.props.accessibilityLabel);
}

beforeEach(() => {
  jest.useFakeTimers();
  mockWidth = 1032;
  useTabletSidebarStore.setState({collapsed: false});
});

afterEach(() => {
  act(() => mounted?.unmount());
  mounted = undefined;
  jest.useRealTimers();
});

describe('labelled sidebar', () => {
  it('lists Collection’s sections in place of Collection', () => {
    const r = renderApp();
    expect(items(r).map(n => n.props.accessibilityLabel)).toEqual([
      'Home',
      'Surahs',
      'Search',
      'Adhkar',
      'Loved',
      'Downloads',
      'Bookmarks',
      'Notes',
      'Playlists',
      'Reciters',
      'Uploads',
      'Settings',
    ]);
    const header = r.root.findAll(
      n => n.props.accessibilityRole === 'header' && n.props.children,
    );
    expect(header[0].props.children).toBe('Collection');
    expect(selected(r)).toEqual(['Home']);
  });

  it('opens a section as the first Collection screen', () => {
    const r = renderApp();
    press(r, 'Loved');
    expect(onShow()).toEqual(['(c.collection)', 'collection/loved']);
    expect(stackOf('(c.collection)')).toEqual(['collection/loved']);
    expect(selected(r)).toEqual(['Loved']);

    // A playlist opened from a section keeps the section marked.
    push('/playlist/1');
    expect(selected(r)).toEqual(['Loved']);

    press(r, 'Downloads');
    expect(stackOf('(c.collection)')).toEqual(['collection/downloads']);
    expect(selected(r)).toEqual(['Downloads']);

    // From another tab too.
    press(r, 'Search');
    press(r, 'Notes');
    expect(onShow()).toEqual(['(c.collection)', 'collection/notes']);
    expect(stackOf('(c.collection)')).toEqual(['collection/notes']);
  });

  it('returns a section to its first screen when pressed again', () => {
    const r = renderApp();
    press(r, 'Playlists');
    push('/playlist/1');
    expect(stackOf('(c.collection)')).toEqual([
      'collection/playlists',
      'playlist/[id]',
    ]);
    press(r, 'Playlists');
    expect(stackOf('(c.collection)')).toEqual(['collection/playlists']);
  });

  it('opens Adhkar above Home, and Home leaves it', () => {
    const r = renderApp();
    press(r, 'Adhkar');
    expect(onShow()).toEqual(['(a.home)', 'adhkar', 'index']);
    expect(stackOf('(a.home)')).toEqual(['index', 'adhkar']);
    expect(selected(r)).toEqual(['Adhkar']);

    press(r, 'Home');
    expect(stackOf('(a.home)')).toEqual(['index']);
    expect(selected(r)).toEqual(['Home']);

    // From another tab, Home also leaves Adhkar.
    press(r, 'Adhkar');
    press(r, 'Search');
    press(r, 'Home');
    expect(onShow()).toEqual(['(a.home)', 'index']);
  });

  it('opens Adhkar above Home before Home has opened', () => {
    const r = renderApp('/collection/loved');
    expect(stackOf('(a.home)')).toEqual([]);
    press(r, 'Adhkar');
    expect(onShow()).toEqual(['(a.home)', 'adhkar', 'index']);
    expect(stackOf('(a.home)')).toEqual(['index', 'adhkar']);
    expect(selected(r)).toEqual(['Adhkar']);
  });

  it('takes Adhkar back to its first screen when pressed again', () => {
    const r = renderApp();
    press(r, 'Adhkar');
    push('/adhkar/1');
    expect(onShow()).toEqual(['(a.home)', 'adhkar', '[superId]/index']);

    // From another tab it comes back where it was.
    press(r, 'Search');
    press(r, 'Adhkar');
    expect(onShow()).toEqual(['(a.home)', 'adhkar', '[superId]/index']);

    press(r, 'Adhkar');
    expect(onShow()).toEqual(['(a.home)', 'adhkar', 'index']);
  });

  it('folds to the rail and back', () => {
    mockWidth = 1376;
    const r = renderApp();
    const width = () =>
      r.root.findAll(
        n =>
          (n.type as unknown) === View &&
          [n.props.style].flat(3).some(s => s?.width !== undefined),
      )[0];
    const flatWidth = () =>
      Object.assign({}, ...[width().props.style].flat(3)).width;
    expect(flatWidth()).toBe(280);

    const hide = r.root.findByProps({accessibilityLabel: 'Hide sidebar'});
    act(() => hide.props.onPress());
    expect(useTabletSidebarStore.getState().collapsed).toBe(true);
    expect(flatWidth()).toBe(88);
    expect(items(r).map(n => n.props.accessibilityLabel)).toContain(
      'Collection',
    );

    const show = r.root.findByProps({accessibilityLabel: 'Show sidebar'});
    act(() => show.props.onPress());
    expect(flatWidth()).toBe(280);
  });

  it('flashes the scroll indicator once when the sections overflow', () => {
    const r = renderApp();
    // The ScrollView, outermost of the nodes that get its props.
    const scroll = r.root.findAll(
      n => typeof n.props.onContentSizeChange === 'function',
    )[0];
    const flash = scroll.instance.flashScrollIndicators as jest.Mock;
    flash.mockClear();
    const layout = (height: number) =>
      act(() => scroll.props.onLayout({nativeEvent: {layout: {height}}}));
    const content = (height: number) =>
      act(() => scroll.props.onContentSizeChange(240, height));

    layout(500);
    content(480);
    expect(flash).not.toHaveBeenCalled();

    // The iPad mini in landscape: the list no longer fits.
    layout(420);
    expect(flash).toHaveBeenCalledTimes(1);
    content(484);
    expect(flash).toHaveBeenCalledTimes(1);

    // Fits again, then overflows again.
    layout(700);
    layout(420);
    expect(flash).toHaveBeenCalledTimes(2);
  });
});

describe('icon rail', () => {
  beforeEach(() => {
    mockWidth = 744;
  });

  it('shows Collection with no way to widen it', () => {
    const r = renderApp();
    expect(items(r).map(n => n.props.accessibilityLabel)).toEqual([
      'Home',
      'Surahs',
      'Search',
      'Adhkar',
      'Collection',
      'Settings',
    ]);
    expect(
      r.root.findAll(n => n.props.accessibilityLabel === 'Show sidebar'),
    ).toHaveLength(0);
  });

  it('opens the Collection home and marks Collection on its screens', () => {
    const r = renderApp();
    press(r, 'Collection');
    expect(onShow()).toEqual(['(c.collection)', 'index']);
    push('/collection/loved');
    expect(selected(r)).toEqual(['Collection']);
    press(r, 'Collection');
    expect(stackOf('(c.collection)')).toEqual(['index']);
  });

  it('puts the Collection home under a section opened in the sidebar', () => {
    mockWidth = 1133;
    const r = renderApp();
    press(r, 'Downloads');
    // The iPad turns to portrait.
    mockWidth = 744;
    press(r, 'Home');
    press(r, 'Collection');
    expect(stackOf('(c.collection)')).toEqual([
      'index',
      'collection/downloads',
    ]);
    expect(onShow()).toEqual(['(c.collection)', 'collection/downloads']);

    press(r, 'Collection');
    expect(stackOf('(c.collection)')).toEqual(['index']);
  });
});

describe('keyboard', () => {
  beforeEach(() => {
    resetKeyCommandsForTests();
    (BayaanKeyboard.setCommands as jest.Mock).mockClear();
  });

  afterAll(() => resetKeyCommandsForTests(false));

  function key(k: Parameters<typeof pressKeyForTests>[0]) {
    act(() => pressKeyForTests(k));
    act(() => jest.runOnlyPendingTimers());
  }

  it('lists ⌘1–⌘5 under Go, named as the items, then ⌘F', () => {
    renderApp();
    const [menus, commands] = (
      BayaanKeyboard.setCommands as jest.Mock
    ).mock.calls.at(-1);
    expect(menus).toEqual([{id: 'go', title: 'Go'}]);
    expect(
      commands.map((c: {id: string; title: string}) => [c.id, c.title]),
    ).toEqual([
      ['cmd-1', 'Home'],
      ['cmd-2', 'Surahs'],
      ['cmd-3', 'Search'],
      ['cmd-4', 'Adhkar'],
      ['cmd-5', 'Collection'],
      ['cmd-f', 'Find a Surah or Reciter'],
    ]);
  });

  it('presses the items with ⌘1–⌘5', () => {
    renderApp();
    key('cmd-2');
    expect(onShow()).toEqual(['(b.surahs)', 'index']);
    key('cmd-4');
    expect(onShow()).toEqual(['(a.home)', 'adhkar', 'index']);
    key('cmd-5');
    expect(onShow()).toEqual(['(c.collection)', 'index']);
    key('cmd-1');
    expect(onShow()).toEqual(['(a.home)', 'index']);
  });

  it('opens Search with its field focused on ⌘F', () => {
    renderApp();
    key('cmd-f');
    expect(onShow()).toEqual(['(b.search)', 'index']);
    expect(takeSearchFocusRequest()).toBe(true);
  });

  it('takes the keys away when the sidebar unmounts', () => {
    renderApp();
    act(() => mounted?.unmount());
    mounted = undefined;
    const [menus, commands] = (
      BayaanKeyboard.setCommands as jest.Mock
    ).mock.calls.at(-1);
    expect(menus).toEqual([]);
    expect(commands).toEqual([]);
  });
});
