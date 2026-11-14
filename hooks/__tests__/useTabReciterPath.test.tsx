// @ai-generated
import React from 'react';
import {act, create} from 'react-test-renderer';

let mockSegments: string[] = [];
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useSegments: () => mockSegments,
  usePathname: () => '/' + mockSegments.join('/'),
  useRouter: () => ({push: mockPush}),
}));
jest.mock('@/services/player/store/playerStore', () => ({
  usePlayerStore: (select: (s: {setSheetMode: jest.Mock}) => unknown) =>
    select({setSheetMode: jest.fn()}),
}));

import fs from 'fs';
import path from 'path';
import {
  reciterBrowsePathname,
  reciterProfilePathname,
  reciterTabStack,
} from '@/hooks/useTabReciterPath';
import {useReciterNavigation} from '@/hooks/useReciterNavigation';

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

describe('reciterBrowsePathname', () => {
  const cases: [string[], string][] = [
    [['(tabs)', '(a.home)', 'browse-all-surahs'], '(a.home)'],
    [['(tabs)', '(b.search)', 'browse-all-surahs'], '(b.search)'],
    [['(tabs)', '(b.surahs)'], '(b.surahs)'],
    // Tabs without a browse screen, and routes outside the tabs.
    [['(tabs)', '(c.collection)', 'collection', 'loved'], '(a.home)'],
    [['(tabs)', '(d.settings)'], '(a.home)'],
    [['mushaf'], '(a.home)'],
    [[], '(a.home)'],
  ];

  it.each(cases)('%j -> %s', (segments, tab) => {
    expect(reciterBrowsePathname(segments)).toBe(
      `/(tabs)/${tab}/reciter/browse`,
    );
  });

  // Pushing a route that no tab declares lands on the not-found screen.
  it('only returns routes that exist', () => {
    const appDir = path.join(__dirname, '..', '..', 'app');
    for (const tab of ['(a.home)', '(b.surahs)', '(b.search)']) {
      const pathname = reciterBrowsePathname(['(tabs)', tab]);
      expect(fs.existsSync(path.join(appDir, `${pathname}.tsx`))).toBe(true);
    }
  });
});

describe('useReciterNavigation', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockPush.mockClear();
  });
  afterEach(() => jest.useRealTimers());

  function openProfileFrom(segments: string[]): void {
    mockSegments = segments;
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
    openProfileFrom(['(tabs)', '(c.collection)', 'collection', 'loved']);
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/(tabs)/(c.collection)/reciter/[id]',
      params: {id: 'r1'},
    });
  });

  it('falls back to Home from Settings', () => {
    openProfileFrom(['(tabs)', '(d.settings)']);
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/(tabs)/(a.home)/reciter/[id]',
      params: {id: 'r1'},
    });
  });
});
