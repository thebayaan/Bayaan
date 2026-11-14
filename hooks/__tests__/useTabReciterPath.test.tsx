// @ai-generated
import React from 'react';
import {act, create} from 'react-test-renderer';

let mockSegments: string[] = [];
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useSegments: () => mockSegments,
  usePathname: () => '/' + mockSegments.join('/'),
  router: {push: (...args: unknown[]) => mockPush(...args)},
}));
jest.mock('@/services/player/store/playerStore', () => ({
  usePlayerStore: (select: (s: {setSheetMode: jest.Mock}) => unknown) =>
    select({setSheetMode: jest.fn()}),
}));

import {
  reciterProfilePathname,
  reciterTabStack,
} from '@/hooks/useTabReciterPath';
import {useReciterNavigation} from '@/hooks/useReciterNavigation';
import {registerNavigationContainer} from '@/services/navigation/openFromTabs';

describe('reciterTabStack', () => {
  it.each([
    [['(tabs)', '(a.home)'], '(a.home)'],
    [['(tabs)', '(b.search)', 'reciter', 'browse'], '(b.search)'],
    [['(tabs)', '(c.collection)', 'collection', 'loved'], '(c.collection)'],
    // Settings has no reciter screen; root routes are outside the tabs.
    [['(tabs)', '(d.settings)'], '(a.home)'],
    [['mushaf'], '(a.home)'],
    [[], '(a.home)'],
  ])('%j -> %s', (segments, stack) => {
    expect(reciterTabStack(segments)).toBe(stack);
  });

  it('builds the profile pathname for that tab', () => {
    expect(reciterProfilePathname(['(tabs)', '(b.search)'])).toBe(
      '/(tabs)/(b.search)/reciter/[id]',
    );
  });
});

describe('useReciterNavigation', () => {
  const dispatch = jest.fn();

  beforeEach(() => {
    jest.useFakeTimers();
    mockPush.mockClear();
    dispatch.mockClear();
  });
  afterEach(() => jest.useRealTimers());

  // The root stack: the tabs on `tab`, with `above` (root screens such as
  // the Mushaf) on top of them.
  function openProfileFrom(tab: string, above: string[] = []): void {
    mockSegments = above.length ? [above[above.length - 1]] : ['(tabs)', tab];
    const routes = [
      {name: '(tabs)', state: {index: 0, routes: [{name: tab}]}},
      ...above.map(name => ({name})),
    ];
    registerNavigationContainer({
      getRootState: () => ({key: 'root', index: routes.length - 1, routes}),
      dispatch,
    });
    let open: ((id: string) => void) | undefined;
    function Probe(): null {
      open = useReciterNavigation().navigateToReciterProfile;
      return null;
    }
    act(() => {
      create(<Probe />);
    });
    act(() => {
      open?.('r1');
      jest.advanceTimersByTime(300);
    });
  }

  it('opens the profile in the Library tab when the user is there', () => {
    openProfileFrom('(c.collection)');
    expect(dispatch).not.toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith(
      {pathname: '/(tabs)/(c.collection)/reciter/[id]', params: {id: 'r1'}},
      {withAnchor: true},
    );
  });

  it('falls back to Home from Settings', () => {
    openProfileFrom('(d.settings)');
    expect(mockPush).toHaveBeenCalledWith(
      {pathname: '/(tabs)/(a.home)/reciter/[id]', params: {id: 'r1'}},
      {withAnchor: true},
    );
  });

  // From the player or Follow along over the Mushaf: pushed from the
  // Mushaf, the profile would land in a second copy of the tabs.
  it('closes the Mushaf, then opens the profile in the tab under it', () => {
    openProfileFrom('(b.search)', ['mushaf']);
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'POP_TO',
        payload: expect.objectContaining({name: '(tabs)'}),
        target: 'root',
      }),
    );
    expect(mockPush).toHaveBeenCalledWith(
      {pathname: '/(tabs)/(b.search)/reciter/[id]', params: {id: 'r1'}},
      {withAnchor: true},
    );
  });
});
