// @ai-generated
jest.mock('@/services/player/store/playerStore', () => ({
  usePlayerStore: jest.fn(),
}));

import {
  computeBottomInset,
  libraryListBottomPadding,
  PHONE_LIBRARY_LIST_BOTTOM_PADDING,
} from '@/hooks/useBottomInset';
import fs from 'fs';
import path from 'path';
import {
  FLOATING_PLAYER_BOTTOM_MARGIN,
  FLOATING_PLAYER_HEIGHT,
  FLOATING_TAB_BAR_BOTTOM_MARGIN,
  TAB_BAR_HEIGHT,
} from '@/utils/constants';

const safeAreaBottom = 20;

describe('computeBottomInset', () => {
  it('only clears the home indicator on tablets, with or without a track', () => {
    for (const platform of ['ios', 'android']) {
      for (const hasTrack of [false, true]) {
        expect(
          computeBottomInset({
            platform,
            isTablet: true,
            safeAreaBottom,
            hasTrack,
          }),
        ).toBe(safeAreaBottom);
      }
    }
  });

  it('clears the iOS tab bar, plus the mini player while a track is loaded', () => {
    const base = {platform: 'ios', isTablet: false, safeAreaBottom};
    expect(computeBottomInset({...base, hasTrack: false})).toBe(49 + 20);
    expect(computeBottomInset({...base, hasTrack: true})).toBe(49 + 20 + 64);
  });

  it('clears the Android floating tab bar and player', () => {
    const base = {platform: 'android', isTablet: false, safeAreaBottom};
    const tabBar = TAB_BAR_HEIGHT + FLOATING_TAB_BAR_BOTTOM_MARGIN + 20;
    expect(computeBottomInset({...base, hasTrack: false})).toBe(tabBar);
    expect(computeBottomInset({...base, hasTrack: true})).toBe(
      tabBar + FLOATING_PLAYER_HEIGHT + FLOATING_PLAYER_BOTTOM_MARGIN,
    );
  });
});

// @ai-start
describe('libraryListBottomPadding', () => {
  it('keeps the floating-player gap on phones', () => {
    expect(
      libraryListBottomPadding({isTablet: false, safeAreaBottom: 34}),
    ).toBe(PHONE_LIBRARY_LIST_BOTTOM_PADDING);
  });

  it('only clears the home indicator on tablets', () => {
    expect(libraryListBottomPadding({isTablet: true, safeAreaBottom: 20})).toBe(
      20,
    );
  });

  it('is used by every Library list instead of a fixed phone gap', () => {
    const root = path.resolve(__dirname, '../..');
    const files = [
      'app/(tabs)/(c.collection)/collection/bookmarks.tsx',
      'app/(tabs)/(c.collection)/collection/downloads.tsx',
      'app/(tabs)/(c.collection)/collection/favorite-reciters.tsx',
      'app/(tabs)/(c.collection)/collection/loved.tsx',
      'app/(tabs)/(c.collection)/collection/notes.tsx',
      'app/(tabs)/(c.collection)/collection/playlists.tsx',
      'app/(tabs)/(c.collection)/collection/uploads.tsx',
      'components/playlist-detail/PlaylistDetail.tsx',
      'components/reciter-downloads/ReciterDownloadsList.tsx',
    ];
    for (const file of files) {
      const source = fs.readFileSync(path.join(root, file), 'utf8');
      expect({file, fixedGap: source.includes('moderateScale(65)')}).toEqual({
        file,
        fixedGap: false,
      });
      expect(source).toContain('useLibraryListBottomPadding()');
    }
  });
});
// @ai-end
