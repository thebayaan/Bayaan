// @ai-generated
import {router} from 'expo-router';
import {navigationRef} from 'expo-router/build/global-state/navigationRef';
import {
  nav,
  renderAppRouter,
  stackSummary,
  tabsCopies,
  unmountAppRouter,
} from '@/test-utils/routerHarness';
import {
  focusedTabGroup,
  leaveRootScreens,
  openFromTabs,
  registerNavigationContainer,
  screensAboveTabs,
  type NavContainer,
} from '@/services/navigation/openFromTabs';
import {reciterProfilePathname} from '@/hooks/useTabReciterPath';

const container = navigationRef as unknown as NavContainer;
const searchReciter = (id: string) =>
  ({pathname: '/(tabs)/(b.search)/reciter/[id]', params: {id}}) as const;
const homeReciter = (id: string) =>
  ({pathname: '/(tabs)/(a.home)/reciter/[id]', params: {id}}) as const;

beforeEach(async () => {
  await renderAppRouter('/');
  registerNavigationContainer(container);
});
afterEach(unmountAppRouter);

describe('root screens over the tabs', () => {
  it('opens Translations over the Mushaf and goes back to it (tafseer settings)', async () => {
    await nav(() => router.push({pathname: '/mushaf', params: {page: '3'}}));
    await nav(() => router.push('/translations'));
    expect(stackSummary()).toBe(
      '(tabs){*(a.home)[*index]} > mushaf > *translations',
    );
    await nav(() => router.back());
    expect(stackSummary()).toBe('(tabs){*(a.home)[*index]} > *mushaf');
  });

  // The hazard openFromTabs exists for. If expo-router stops stacking a
  // second copy of the tabs, this fails and the workaround can go.
  it('stacks a second copy of the tabs when a tab route is pushed from the Mushaf', async () => {
    await nav(() => router.push('/mushaf'));
    await nav(() => router.push(homeReciter('r1')));
    expect(tabsCopies()).toBe(2);
    expect(stackSummary()).toBe(
      '(tabs){*(a.home)[*index]} > mushaf > *(tabs){*(a.home)[*reciter/[id]]}',
    );
  });

  it('reports the screens above the tabs and the tab under them', async () => {
    await nav(() => router.navigate('/(tabs)/(b.search)'));
    expect(screensAboveTabs(container.getRootState())).toEqual([]);
    await nav(() => router.push('/mushaf'));
    await nav(() => router.push('/translations'));
    const root = container.getRootState();
    expect(screensAboveTabs(root)).toEqual(['mushaf', 'translations']);
    expect(focusedTabGroup(root)).toBe('(b.search)');
  });

  it('leaves nothing to pop when the tabs are showing', async () => {
    expect(leaveRootScreens(container)).toBe(false);
    expect(stackSummary()).toBe('*(tabs){*(a.home)[*index]}');
  });
});

describe('openFromTabs', () => {
  it('opens a reciter from the Mushaf in the tab under it', async () => {
    await nav(() => router.navigate('/(tabs)/(b.search)'));
    await nav(() => router.push('/mushaf'));
    const tab = focusedTabGroup(container.getRootState());
    await nav(() =>
      openFromTabs({
        pathname: reciterProfilePathname(['(tabs)', tab ?? '']),
        params: {id: 'r1'},
      }),
    );
    expect(tabsCopies()).toBe(1);
    expect(stackSummary()).toBe(
      '*(tabs){(a.home)[*index], *(b.search)[index, *reciter/[id]]}',
    );
  });

  it('opens a route in a tab not visited yet with the tab home beneath it', async () => {
    await nav(() => router.push('/mushaf'));
    await nav(() => router.push('/translations'));
    await nav(() => openFromTabs('/collection/uploads'));
    expect(tabsCopies()).toBe(1);
    expect(stackSummary()).toBe(
      '*(tabs){(a.home)[*index], *(c.collection)[index, *collection/uploads]}',
    );
  });

  it('pushes as usual when no root screen is open', async () => {
    await nav(() => router.navigate('/(tabs)/(b.search)'));
    await nav(() => router.push(searchReciter('r0')));
    await nav(() => openFromTabs(searchReciter('r1')));
    expect(stackSummary()).toBe(
      '*(tabs){(a.home)[*index], *(b.search)[index, reciter/[id], *reciter/[id]]}',
    );
  });

  it('replaces an open Mushaf instead of stacking a second one', async () => {
    await nav(() => router.push({pathname: '/mushaf', params: {page: '3'}}));
    await nav(() => openFromTabs({pathname: '/mushaf', params: {page: '9'}}));
    expect(stackSummary()).toBe('(tabs){*(a.home)[*index]} > *mushaf');
  });

  // app/reciter/[slug]/[surah].tsx: the link route steps off first, then
  // opens the profile, in the same tick.
  it('opens a reciter link over the Mushaf in the tabs', async () => {
    await nav(() => router.push('/mushaf'));
    await nav(() => router.navigate('/reciter/some-slug/2'));
    await nav(() => {
      navigationRef.goBack();
      openFromTabs(homeReciter('r1'));
    });
    expect(tabsCopies()).toBe(1);
    expect(stackSummary()).toBe('*(tabs){*(a.home)[index, *reciter/[id]]}');
  });

  it('leaves a link route before opening its target', async () => {
    await nav(() => router.push('/mushaf'));
    await nav(() => router.navigate('/reciter/some-slug/2'));
    await nav(() => openFromTabs(homeReciter('r1')));
    expect(tabsCopies()).toBe(1);
    expect(stackSummary()).toBe('*(tabs){*(a.home)[index, *reciter/[id]]}');
  });
});

describe('Settings', () => {
  it('keeps Settings pages in the Settings tab', async () => {
    await nav(() => router.navigate('/(tabs)/(d.settings)'));
    await nav(() => router.push('/(d.settings)/translations'));
    expect(stackSummary()).toBe(
      '*(tabs){(a.home)[*index], *(d.settings)[index, *translations]}',
    );
  });

  it('swaps the page beside the list on iPad (dismissAll, then push)', async () => {
    await nav(() => router.navigate('/(tabs)/(d.settings)'));
    await nav(() => router.push('/(d.settings)/storage'));
    await nav(() => {
      router.dismissAll();
      router.push('/(d.settings)/about');
    });
    expect(stackSummary()).toBe(
      '*(tabs){(a.home)[*index], *(d.settings)[index, *about]}',
    );
  });
});
