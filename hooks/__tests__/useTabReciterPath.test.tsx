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

import {
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
