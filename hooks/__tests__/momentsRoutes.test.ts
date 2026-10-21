// @ai-start
let mockSegments: string[] = [];
const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useSegments: () => mockSegments,
  useRouter: () => ({push: mockPush}),
  usePathname: () => '/',
}));
jest.mock('@/services/player/store/playerStore', () => ({
  usePlayerStore: (select: (s: unknown) => unknown) =>
    select({playback: {state: 'paused'}, setSheetMode: jest.fn()}),
}));

import {reciterTabFor} from '@/hooks/useReciterNavigation';
import {
  useHideMiniPlayerOnMoments,
  useOnMomentsFeed,
  useOnMomentsTab,
} from '@/hooks/useOnMomentsTab';

describe('reciterTabFor', () => {
  it('stays in a tab that has a reciter screen', () => {
    expect(reciterTabFor(['(tabs)', '(d.moments)'])).toBe('(d.moments)');
    expect(reciterTabFor(['(tabs)', '(c.collection)', 'collection'])).toBe(
      '(c.collection)',
    );
    expect(reciterTabFor(['(tabs)', '(b.search)'])).toBe('(b.search)');
  });

  it('falls back to Home elsewhere', () => {
    expect(reciterTabFor(['(tabs)', '(b.surahs)'])).toBe('(a.home)');
    expect(reciterTabFor(['settings'])).toBe('(a.home)');
    expect(reciterTabFor([])).toBe('(a.home)');
  });
});

describe('Moments visibility', () => {
  it('counts only the feed as watching', () => {
    mockSegments = ['(tabs)', '(d.moments)'];
    expect(useOnMomentsFeed()).toBe(true);
    expect(useHideMiniPlayerOnMoments()).toBe(true);

    mockSegments = ['(tabs)', '(d.moments)', 'reciter', '[id]'];
    expect(useOnMomentsTab()).toBe(true);
    expect(useOnMomentsFeed()).toBe(false);
    expect(useHideMiniPlayerOnMoments()).toBe(false);

    mockSegments = ['(tabs)', '(a.home)'];
    expect(useOnMomentsFeed()).toBe(false);
  });
});
// @ai-end
