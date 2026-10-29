// @ai-generated
import {
  CommonActions,
  type NavigationAction,
} from 'expo-router/build/react-navigation/routers';

/**
 * What the iPad sidebar shows and which item is selected (ipad-standards §6,
 * navigation-and-shell "Tab shell", mockups N1 and N2).
 *
 * - Below 900pt the sidebar is the 88pt icon rail: Home, Surahs, Search,
 *   Adhkar and Collection, with Settings at the bottom.
 * - From 900pt it is a labelled sidebar, 240pt wide (280pt from 1280pt).
 *   Collection's sections are listed in it directly, as in Apple Music, and
 *   each one opens as the first screen of the Collection tab.
 * - The reader can collapse the labelled sidebar to the rail.
 */

export const RAIL_WIDTH = 88;
const SIDEBAR_MIN_WINDOW = 900;
const LARGE_MIN_WINDOW = 1280;

export type SidebarMode = 'rail' | 'sidebar';

/** True when the window is wide enough for the labelled sidebar. */
export function canShowSidebar(windowWidth: number): boolean {
  return windowWidth >= SIDEBAR_MIN_WINDOW;
}

export function sidebarMode(
  windowWidth: number,
  collapsed: boolean,
): SidebarMode {
  return canShowSidebar(windowWidth) && !collapsed ? 'sidebar' : 'rail';
}

export function sidebarWidth(windowWidth: number, mode: SidebarMode): number {
  if (mode === 'rail') return RAIL_WIDTH;
  return windowWidth >= LARGE_MIN_WINDOW ? 280 : 240;
}

export type TabItemId = 'home' | 'quran' | 'search' | 'library' | 'settings';
export type LibrarySectionId =
  | 'loved'
  | 'downloads'
  | 'bookmarks'
  | 'notes'
  | 'playlists'
  | 'reciters'
  | 'uploads';
export type SidebarItemId = TabItemId | 'adhkar' | LibrarySectionId;

/** The tab route behind each tab item. */
export const TAB_ROUTES: Record<TabItemId, string> = {
  home: '(a.home)',
  quran: '(b.surahs)',
  search: '(b.search)',
  library: '(c.collection)',
  settings: '(d.settings)',
};

/** Adhkar lives in the Home stack. */
export const ADHKAR_ROUTE = 'adhkar';

/** Collection's sections, in sidebar order, and their screens. */
export const LIBRARY_SECTIONS: readonly {
  id: LibrarySectionId;
  route: string;
}[] = [
  {id: 'loved', route: 'collection/loved'},
  {id: 'downloads', route: 'collection/downloads'},
  {id: 'bookmarks', route: 'collection/bookmarks'},
  {id: 'notes', route: 'collection/notes'},
  {id: 'playlists', route: 'collection/playlists'},
  {id: 'reciters', route: 'collection/favorite-reciters'},
  {id: 'uploads', route: 'collection/uploads'},
];

/** The items above the Collection group, in order. Settings sits at the bottom. */
export const TOP_ITEMS: readonly (TabItemId | 'adhkar')[] = [
  'home',
  'quran',
  'search',
  'adhkar',
];

interface RouteLike {
  name: string;
  key?: string;
  state?: StackStateLike;
}

interface StackStateLike {
  index?: number;
  routes: readonly RouteLike[];
}

interface TabRouteLike {
  name: string;
  key: string;
  params?: object;
  state?: StackStateLike;
}

interface TabStateLike {
  index: number;
  routes: readonly TabRouteLike[];
}

/** The first screen of the Home and Collection stacks. */
const STACK_ROOT = 'index';

/**
 * The screens of a tab's stack. A stack's state reaches the tab bar only
 * once it changes after mounting, so until then it is read from the params
 * the tab was opened with, or the stack is on its first screen.
 */
export function tabStack(route: TabRouteLike): StackStateLike {
  if (route.state) return route.state;
  const params = route.params as
    | {state?: StackStateLike; screen?: unknown; initial?: boolean}
    | undefined;
  if (params?.state) return params.state;
  if (typeof params?.screen === 'string') {
    return {
      routes:
        params.initial === false
          ? [{name: STACK_ROOT}, {name: params.screen}]
          : [{name: params.screen}],
    };
  }
  return {routes: [{name: STACK_ROOT}]};
}

/** A stack's routes from its first screen up to the one on show. */
function shownRoutes(stack: StackStateLike): RouteLike[] {
  const top = stack.index ?? stack.routes.length - 1;
  return stack.routes.slice(0, top + 1);
}

/**
 * The Collection section a stack is showing: the nearest section screen at
 * or below the one on show, so a playlist opened from Playlists keeps
 * Playlists selected. Null on the Collection home.
 */
export function librarySectionOf(
  stack: StackStateLike,
): LibrarySectionId | null {
  const routes = shownRoutes(stack);
  for (let i = routes.length - 1; i >= 0; i--) {
    const section = LIBRARY_SECTIONS.find(s => s.route === routes[i].name);
    if (section) return section.id;
  }
  return null;
}

/** The item to mark as selected, or null when none matches. */
export function selectedSidebarItem(
  state: TabStateLike,
  mode: SidebarMode,
): SidebarItemId | null {
  const route = state.routes[state.index];
  if (!route) return null;
  switch (route.name) {
    case TAB_ROUTES.home:
      return shownRoutes(tabStack(route)).some(r => r.name === ADHKAR_ROUTE)
        ? 'adhkar'
        : 'home';
    case TAB_ROUTES.quran:
      return 'quran';
    case TAB_ROUTES.search:
      return 'search';
    case TAB_ROUTES.settings:
      return 'settings';
    case TAB_ROUTES.library:
      return mode === 'rail' ? 'library' : librarySectionOf(tabStack(route));
    default:
      return null;
  }
}

/** What a press does: an optional tabPress event, then actions in order. */
export interface SidebarPress {
  /**
   * The tab route to emit tabPress on first, as a tab bar does. On the tab
   * on show it pops the stack to its first screen and scrolls that to the
   * top. A listener that prevents it cancels the actions.
   */
  tabPress?: string;
  actions: NavigationAction[];
}

function tabOfItem(item: SidebarItemId): TabItemId {
  if (item === 'adhkar') return 'home';
  if (LIBRARY_SECTIONS.some(s => s.id === item)) return 'library';
  return item as TabItemId;
}

/**
 * Opens a tab with its stack set to these screens. A stack that is mounted
 * resets to them; one that isn't starts with them. Routes passed with their
 * key keep their screen.
 */
function openWithStack(
  tab: string,
  index: number,
  routes: readonly RouteLike[],
): NavigationAction {
  return CommonActions.navigate({name: tab, params: {state: {index, routes}}});
}

/**
 * What pressing an item does. The tab items act as tab bar buttons. Adhkar
 * and Collection's sections are screens inside the Home and Collection tabs,
 * so they also set those stacks:
 * - Adhkar opens above Home, so back returns to Home, and pressing Home
 *   leaves Adhkar.
 * - A section opens as the first screen of the Collection stack, in place
 *   of the Collection home.
 * - In the rail, Collection keeps its home at the bottom of the stack.
 * Pressing an item that is on show returns it to its first screen.
 */
export function sidebarPress(
  state: TabStateLike,
  item: SidebarItemId,
): SidebarPress {
  const tabIndex = state.routes.findIndex(
    r => r.name === TAB_ROUTES[tabOfItem(item)],
  );
  const tab = state.routes[tabIndex];
  if (!tab) return {actions: []};
  const focused = state.index === tabIndex;
  const focusTab = focused
    ? []
    : [CommonActions.navigate({name: tab.name, merge: true})];
  const asTab: SidebarPress = {tabPress: tab.key, actions: focusTab};
  const stack = tabStack(tab);
  const root = stack.routes[0] ?? {name: STACK_ROOT};

  if (item === 'adhkar') {
    const shown = shownRoutes(stack);
    const at = shown.findIndex(r => r.name === ADHKAR_ROUTE);
    if (at >= 0 && !focused) return {actions: focusTab};
    if (at >= 0) {
      const inner = shown[at].state;
      const innerTop = inner ? (inner.index ?? inner.routes.length - 1) : 0;
      if (at === shown.length - 1 && innerTop === 0) return {actions: []};
    }
    return {
      actions: [openWithStack(tab.name, 1, [root, {name: ADHKAR_ROUTE}])],
    };
  }

  if (item === 'home') {
    const showsAdhkar = shownRoutes(stack).some(r => r.name === ADHKAR_ROUTE);
    // On show, tabPress pops to Home.
    if (showsAdhkar && !focused) {
      return {actions: [openWithStack(tab.name, 0, [root])]};
    }
    return asTab;
  }

  if (item === 'library') {
    if (root.name === STACK_ROOT) return asTab;
    // A section is at the bottom of the stack. Put the Collection home
    // back under it, or show the home if Collection is already on show.
    if (focused) {
      return {actions: [openWithStack(tab.name, 0, [{name: STACK_ROOT}])]};
    }
    const top = stack.index ?? stack.routes.length - 1;
    return {
      actions: [
        openWithStack(tab.name, top + 1, [{name: STACK_ROOT}, ...stack.routes]),
      ],
    };
  }

  const section = LIBRARY_SECTIONS.find(s => s.id === item);
  if (section) {
    if (root.name === section.route) return asTab;
    return {actions: [openWithStack(tab.name, 0, [{name: section.route}])]};
  }

  return asTab;
}
