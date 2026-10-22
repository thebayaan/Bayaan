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

import {renderHook} from '@testing-library/react-hooks';
import {reciterTabFor} from '@/hooks/useReciterNavigation';
import {
  MomentsTabTracker,
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
  // The tracker writes the store from the segments; the hooks read it.
  const at = (segments: string[]) => {
    mockSegments = segments;
    renderHook(() => MomentsTabTracker());
    return renderHook(() => ({
      tab: useOnMomentsTab(),
      feed: useOnMomentsFeed(),
      hideMini: useHideMiniPlayerOnMoments(),
    })).result.current;
  };

  it('counts only the feed as watching', () => {
    expect(at(['(tabs)', '(d.moments)'])).toEqual({
      tab: true,
      feed: true,
      hideMini: true,
    });
    expect(at(['(tabs)', '(d.moments)', 'reciter', '[id]'])).toEqual({
      tab: true,
      feed: false,
      hideMini: false,
    });
    expect(at(['(tabs)', '(a.home)'])).toEqual({
      tab: false,
      feed: false,
      hideMini: false,
    });
  });
});
// @ai-end
