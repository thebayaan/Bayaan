// @ai-generated
/**
 * Opening a screen while a root screen covers the tabs.
 *
 * The Mushaf, Translations and the link routes (app/*.tsx outside (tabs))
 * sit on the root stack above the tabs. Pushing a tab route (a reciter
 * profile, Uploads) from one of them does not switch to that tab: expo-router
 * stacks a second copy of the whole tab bar on top, holding only the new
 * screen. That screen has no back button, the Home tab of the copy shows the
 * same screen, and the screen underneath can no longer be reached.
 *
 * `openFromTabs` returns to the tabs first, then pushes onto the tab the
 * route belongs to. Use it for any navigation that can start from a sheet,
 * the player or a root screen.
 */
import {router, type Href} from 'expo-router';
import {StackActions} from 'expo-router/react-navigation';

const TABS = '(tabs)';

type NavRoute = {name: string; state?: NavState};
type NavState = {key?: string; index?: number; routes: NavRoute[]};

/** The navigation container (useNavigationContainerRef). */
export type NavContainer = {
  getRootState(): unknown;
  dispatch(action: object): void;
};

let appContainer: NavContainer | null = null;

/** Called once by the root layout with useNavigationContainerRef(). */
export function registerNavigationContainer(container: NavContainer): void {
  appContainer = container;
}

function focusedIndex(state: NavState): number {
  return state.index ?? state.routes.length - 1;
}

/** The root stack: the navigator holding the tabs, on the focused path. */
export function findTabsHost(root: unknown): NavState | undefined {
  let state = root as NavState | undefined;
  while (state?.routes) {
    if (state.routes.some(route => route.name === TABS)) return state;
    state = state.routes[focusedIndex(state)]?.state;
  }
  return undefined;
}

function lastTabsIndex(host: NavState): number {
  for (let i = host.routes.length - 1; i >= 0; i--) {
    if (host.routes[i].name === TABS) return i;
  }
  return -1;
}

/** Names of the root screens above the tabs, bottom first. */
export function screensAboveTabs(root: unknown): string[] {
  const host = findTabsHost(root);
  if (!host) return [];
  return host.routes
    .slice(lastTabsIndex(host) + 1, focusedIndex(host) + 1)
    .map(route => route.name);
}

/**
 * The tab group showing in the tabs, e.g. `(b.search)`, whether or not a
 * root screen covers it.
 */
export function focusedTabGroup(root: unknown): string | undefined {
  const host = findTabsHost(root);
  if (!host) return undefined;
  const tabs = host.routes[lastTabsIndex(host)]?.state;
  return tabs ? tabs.routes[focusedIndex(tabs)]?.name : undefined;
}

/**
 * Pop every root screen above the tabs. Returns whether anything was
 * popped.
 */
export function leaveRootScreens(
  container: NavContainer | null = appContainer,
): boolean {
  if (!container) return false;
  const root = container.getRootState();
  const host = findTabsHost(root);
  if (!host?.key || screensAboveTabs(root).length === 0) return false;
  container.dispatch({...StackActions.popTo(TABS), target: host.key});
  return true;
}

/**
 * Push `href` from the tabs: leave any root screen first, so a tab route
 * opens in the tabs underneath instead of a second copy of them. In a tab
 * not opened yet, the tab's first screen goes beneath the route, so it has
 * a back button.
 */
export function openFromTabs(
  href: Href,
  container: NavContainer | null = appContainer,
): void {
  leaveRootScreens(container);
  router.push(href, {withAnchor: true});
}

/**
 * The tab group showing under any root screen, from the app's container.
 * Undefined before the root layout mounts.
 */
export function currentTabGroup(): string | undefined {
  return appContainer
    ? focusedTabGroup(appContainer.getRootState())
    : undefined;
}
