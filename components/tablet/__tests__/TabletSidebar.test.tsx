// @ai-generated
/**
 * The iPad sidebar driving real navigation state: a tab navigator with
 * stacks inside, as in app/(tabs). The stacks pop to their first screen on
 * a tabPress like the native stack does.
 */
import React, {act, useEffect, useRef} from 'react';
import {View} from 'react-native';
import TestRenderer, {type ReactTestRenderer} from 'react-test-renderer';
import {
  BaseNavigationContainer,
  createNavigationContainerRef,
  createNavigatorFactory,
  useNavigationBuilder,
  type NavigationState,
  type ParamListBase,
} from 'expo-router/build/react-navigation/core';
import {
  StackActions,
  StackRouter,
  TabRouter,
} from 'expo-router/build/react-navigation/routers';
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

type NavigatorProps = {
  initialRouteName?: string;
  children: React.ReactNode;
};

function TestStack({initialRouteName, children}: NavigatorProps) {
  const {state, navigation, descriptors, NavigationContent} =
    useNavigationBuilder(StackRouter, {initialRouteName, children});
  const stateRef = useRef(state);
  stateRef.current = state;
  useEffect(
    () =>
      // As the native stack: a tabPress on the tab on show pops to the top.
      (
        navigation as unknown as {
          addListener: (
            type: 'tabPress',
            cb: (e: {defaultPrevented: boolean}) => void,
          ) => () => void;
        }
      ).addListener('tabPress', e => {
        const focused = navigation.isFocused();
        requestAnimationFrame(() => {
          const current = stateRef.current;
          if (current.index > 0 && focused && !e.defaultPrevented) {
            navigation.dispatch({
              ...StackActions.popToTop(),
              target: current.key,
            });
          }
        });
      }),
    [navigation],
  );
  return (
    <NavigationContent>
      {descriptors[state.routes[state.index].key].render()}
    </NavigationContent>
  );
}

function TestTabs({initialRouteName, children}: NavigatorProps) {
  const {state, navigation, descriptors, NavigationContent} =
    useNavigationBuilder(TabRouter, {initialRouteName, children});
  // Tabs mount on first visit, as with lazy tabs.
  const visited = useRef(new Set<string>());
  visited.current.add(state.routes[state.index].key);
  return (
    <NavigationContent>
      <TabletSidebar
        {...({
          state,
          navigation,
          descriptors,
        } as unknown as React.ComponentProps<typeof TabletSidebar>)}
      />
      {state.routes
        .filter(r => visited.current.has(r.key))
        .map(r => (
          <View key={r.key}>{descriptors[r.key].render()}</View>
        ))}
    </NavigationContent>
  );
}

const Stack = createNavigatorFactory(TestStack)();
const Tabs = createNavigatorFactory(TestTabs)();
const Blank = () => null;

const AdhkarStack = () => (
  <Stack.Navigator initialRouteName="index">
    <Stack.Screen name="index" component={Blank} />
    <Stack.Screen name="[superId]/index" component={Blank} />
  </Stack.Navigator>
);

const HomeStack = () => (
  <Stack.Navigator initialRouteName="index">
    <Stack.Screen name="index" component={Blank} />
    <Stack.Screen name="adhkar" component={AdhkarStack} />
    <Stack.Screen name="reciter/[id]" component={Blank} />
  </Stack.Navigator>
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

const CollectionStack = () => (
  <Stack.Navigator initialRouteName="index">
    {COLLECTION_SCREENS.map(name => (
      <Stack.Screen key={name} name={name} component={Blank} />
    ))}
  </Stack.Navigator>
);

const nav = createNavigationContainerRef<ParamListBase>();
let mounted: ReactTestRenderer | undefined;

function renderApp(): ReactTestRenderer {
  act(() => {
    mounted = TestRenderer.create(
      <BaseNavigationContainer ref={nav}>
        <Tabs.Navigator initialRouteName="(a.home)">
          <Tabs.Screen name="(a.home)" component={HomeStack} />
          <Tabs.Screen name="(b.surahs)" component={Blank} />
          <Tabs.Screen name="(b.search)" component={Blank} />
          <Tabs.Screen name="(c.collection)" component={CollectionStack} />
          <Tabs.Screen name="(d.settings)" component={Blank} />
        </Tabs.Navigator>
      </BaseNavigationContainer>,
    );
  });
  if (!mounted) throw new Error('not rendered');
  return mounted;
}

type AnyState = NavigationState | undefined;

function tabState(): NavigationState {
  return nav.getRootState() as NavigationState;
}

/** The screens of a tab's stack, bottom to top. */
function stackOf(tab: string): string[] {
  const route = tabState().routes.find(r => r.name === tab);
  return ((route?.state as AnyState)?.routes ?? []).map(r => r.name);
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
    act(() =>
      nav.dispatch({
        ...StackActions.push('playlist/[id]'),
        target: (tabState().routes[3].state as NavigationState).key,
      }),
    );
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
    act(() =>
      nav.dispatch({
        ...StackActions.push('playlist/[id]'),
        target: (tabState().routes[3].state as NavigationState).key,
      }),
    );
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

  it('takes Adhkar back to its first screen when pressed again', () => {
    const r = renderApp();
    press(r, 'Adhkar');
    const home = tabState().routes[0].state as NavigationState;
    const adhkar = home.routes[1].state as NavigationState;
    act(() =>
      nav.dispatch({
        ...StackActions.push('[superId]/index'),
        target: adhkar.key,
      }),
    );
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
    act(() =>
      nav.dispatch({
        ...StackActions.push('collection/loved'),
        target: (tabState().routes[3].state as NavigationState).key,
      }),
    );
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
    expect(onShow()).toEqual(['(b.surahs)']);
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
    expect(onShow()).toEqual(['(b.search)']);
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
