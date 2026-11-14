// @ai-generated
/**
 * The app's real route tree, rendered by expo-router in Jest with stub
 * screens, so a navigation can be checked against the stack it builds.
 *
 * Routes and `unstable_settings` come from the files in app/; each layout
 * is the navigator it is in the app (root and tab stacks, the tab bar).
 * Screens render nothing. Read the result with `stackSummary()`.
 *
 * Built on expo-router's own test renderer pieces (expo-router/build/...),
 * which are internal: check these imports after an expo-router upgrade.
 */
import fs from 'fs';
import path from 'path';
import React from 'react';
import {act, create, type ReactTestRenderer} from 'react-test-renderer';
import {Stack, Tabs} from 'expo-router';
import {ExpoRoot} from 'expo-router/build/ExpoRoot';
import {getMockContext} from 'expo-router/build/testing-library/mock-config';
import {navigationRef} from 'expo-router/build/global-state/navigationRef';
import {getRouteInfoFromState} from 'expo-router/build/global-state/getRouteInfoFromState';

const APP_DIR = path.resolve(__dirname, '..', 'app');

/** The tab groups, in the order app/(tabs)/_layout.tsx declares them. */
export const TAB_GROUPS = [
  '(a.home)',
  '(b.surahs)',
  '(b.search)',
  '(c.collection)',
  '(d.settings)',
] as const;

function listRouteFiles(dir: string, base = ''): string[] {
  return fs.readdirSync(dir, {withFileTypes: true}).flatMap(entry => {
    const rel = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory())
      return listRouteFiles(path.join(dir, entry.name), rel);
    // Route files only: underscore-prefixed files other than _layout
    // (_styles.ts) are not routes.
    if (!/\.tsx$/.test(entry.name)) return [];
    if (entry.name.startsWith('_') && entry.name !== '_layout.tsx') return [];
    return [rel.replace(/\.tsx$/, '')];
  });
}

/** `unstable_settings` of a layout file, read from its source. */
function layoutSettings(file: string): Record<string, string> | undefined {
  const source = fs.readFileSync(path.join(APP_DIR, `${file}.tsx`), 'utf8');
  const match = source.match(
    /unstable_settings\s*=\s*\{\s*(initialRouteName|anchor)\s*:\s*'([^']+)'/,
  );
  // expo-router reads the same value under either name.
  return match ? {anchor: match[2]} : undefined;
}

const StackLayout = () => <Stack />;
const TabsLayout = () => (
  <Tabs>
    {TAB_GROUPS.map(name => (
      <Tabs.Screen key={name} name={name} />
    ))}
  </Tabs>
);
const StubScreen = () => null;

export function appRoutes(): Record<string, unknown> {
  const routes: Record<string, unknown> = {};
  for (const file of listRouteFiles(APP_DIR)) {
    if (file.endsWith('_layout')) {
      const Layout = file === '(tabs)/_layout' ? TabsLayout : StackLayout;
      const settings = layoutSettings(file);
      routes[file] = settings
        ? {default: Layout, unstable_settings: settings}
        : Layout;
    } else {
      routes[file] = StubScreen;
    }
  }
  return routes;
}

let renderer: ReactTestRenderer | undefined;

/** Mount the app's routes at `initialUrl` (default: Home). */
export async function renderAppRouter(initialUrl = '/'): Promise<void> {
  process.env.EXPO_ROUTER_IMPORT_MODE = 'sync';
  await act(async () => {
    renderer = create(
      <ExpoRoot
        context={getMockContext(appRoutes() as never)}
        location={initialUrl}
      />,
    );
  });
}

export async function unmountAppRouter(): Promise<void> {
  await act(async () => renderer?.unmount());
  renderer = undefined;
}

/** Run a navigation and let the navigators settle. */
export async function nav(fn: () => unknown): Promise<void> {
  await act(async () => {
    await fn();
  });
}

type NavState = {
  index?: number;
  routes: Array<{name: string; state?: NavState}>;
};

/**
 * The root stack as nested lists of route names, focused routes marked
 * with `*`: `(tabs){*(a.home)[index, *reciter/[id]]} > *mushaf`.
 * Root-stack entries are joined with ` > `; a tab navigator shows only
 * its visited tabs.
 */
export function stackSummary(): string {
  const root = navigationRef.getRootState() as unknown as NavState;
  // The root state wraps the app's root stack in one container route.
  const appStack = root.routes[0]?.state ?? root;
  return describe(appStack, ' > ');
}

function describe(state: NavState, sep: string): string {
  const focused = state.index ?? state.routes.length - 1;
  return state.routes
    .map((route, i) => {
      const mark = i === focused ? '*' : '';
      if (!route.state) return `${mark}${route.name}`;
      const isTabs = route.name === '(tabs)';
      const inner = describe(route.state, ', ');
      return isTabs
        ? `${mark}${route.name}{${inner}}`
        : `${mark}${route.name}[${inner}]`;
    })
    .join(sep);
}

/** How many copies of the tab bar the root stack holds. */
export function tabsCopies(): number {
  const root = navigationRef.getRootState() as unknown as NavState;
  const appStack = root.routes[0]?.state ?? root;
  return appStack.routes.filter(route => route.name === '(tabs)').length;
}

export function currentPathname(): string {
  return getRouteInfoFromState(navigationRef.getRootState() as never).pathname;
}
