// @ai-generated
import React from 'react';
import TestRenderer, {act} from 'react-test-renderer';

// The window is always a 13" iPad in landscape. Only the profile's own
// measured width decides whether the hero is pinned as a column.
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({width: 1376, height: 1032, scale: 2, fontScale: 1}),
}));
jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({isTablet: true}),
}));
jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: {
      isDarkMode: false,
      colors: {
        text: '#111111',
        textSecondary: '#555555',
        background: '#ffffff',
        card: '#f2f2f2',
        primary: '#5b4fe0',
        border: '#dddddd',
        error: '#ff0000',
      },
      fonts: {regular: 'r', medium: 'm', semiBold: 's', bold: 'b'},
    },
  }),
}));
jest.mock('@/hooks/useGlassProps', () => ({USE_GLASS: false}));
jest.mock('@/hooks/useGlassHeaderHeight', () => ({
  useGlassHeaderHeight: () => 0,
}));
jest.mock('@/hooks/useBottomInset', () => ({useBottomInset: () => 0}));
jest.mock('react-native-safe-area-context', () => {
  const {View} = jest.requireActual('react-native');
  return {
    SafeAreaView: View,
    useSafeAreaInsets: () => ({top: 24, bottom: 20, left: 0, right: 0}),
  };
});
jest.mock('expo-router', () => ({
  useNavigation: () => ({setOptions: jest.fn()}),
}));
jest.mock('expo-status-bar', () => ({StatusBar: () => null}));
jest.mock('@expo/vector-icons', () => ({Feather: () => null}));
jest.mock('@/components/Icons', () => ({HeartIcon: () => null}));
jest.mock('react-native-reanimated', () => {
  const {View} = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: {View},
    useSharedValue: (value: number) => ({value}),
    useAnimatedStyle: () => ({}),
    withSpring: (value: number) => value,
  };
});
jest.mock('react-native-actions-sheet', () => ({
  SheetManager: {show: jest.fn()},
}));
// Render the content at once instead of after the interactions.
jest.mock('@/utils/afterInteractions', () => ({
  runAfterInteractions: (task: () => void) => {
    task();
    return {cancel: jest.fn()};
  },
}));

jest.mock('@/services/dataService', () => ({
  getReciterByIdSync: () => ({
    id: 'r1',
    name: 'Mishary Alafasy',
    slug: 'mishary',
    date: null,
    image_url: null,
    rewayat: [
      {
        id: 'hafs',
        reciter_id: 'r1',
        name: "Hafs A'n Assem",
        style: 'murattal',
        server: 'https://example.com',
        surah_total: 3,
        surah_list: [1, 2, 3],
        source_type: 'mp3quran',
        created_at: '',
      },
    ],
  }),
}));
jest.mock('@/hooks/useSettings', () => {
  const state = {
    reciterPreferences: {},
    reciterProfileViewMode: 'list',
    reciterProfileSortOption: 'asc',
    setReciterPreference: jest.fn(),
    setReciterProfileViewMode: jest.fn(),
    setReciterProfileSortOption: jest.fn(),
  };
  const useSettings = (selector?: (s: typeof state) => unknown) =>
    selector ? selector(state) : state;
  useSettings.getState = () => state;
  return {useSettings};
});
jest.mock('@/hooks/useLoved', () => ({
  useLoved: () => ({isLovedWithRewayat: () => false}),
}));
jest.mock('@/hooks/usePlayerActions', () => ({
  usePlayerActions: () => ({
    addToQueue: jest.fn(),
    updateQueue: jest.fn(),
    toggleShuffle: jest.fn(),
  }),
}));
jest.mock('@/services/player/store/playerStore', () => ({
  usePlayerStore: (selector: (s: unknown) => unknown) =>
    selector({settings: {shuffle: false}}),
}));
jest.mock('@/services/player/store/recentlyPlayedStore', () => ({
  useRecentlyPlayedStore: (selector: (s: unknown) => unknown) =>
    selector({startNewChain: jest.fn()}),
}));
jest.mock('@/store/uploadsStore', () => ({
  useUploadsStore: (selector: (s: unknown) => unknown) =>
    selector({recitations: []}),
}));
jest.mock('@/hooks/useFavoriteReciters', () => ({
  useFavoriteReciters: () => ({
    toggleFavorite: jest.fn(),
    isFavoriteReciter: () => false,
  }),
}));
jest.mock('@/services/player/store/downloadSelectors', () => ({
  useDownloadQueries: () => ({
    isDownloaded: () => false,
    isDownloadedWithRewayat: () => false,
    isDownloading: () => false,
    isDownloadingWithRewayat: () => false,
  }),
  useDownloadActions: () => ({
    setDownloading: jest.fn(),
    clearDownloading: jest.fn(),
    addDownload: jest.fn(),
    setDownloadProgress: jest.fn(),
  }),
  useAreAllSurahsDownloaded: () => false,
}));
jest.mock('@/services/downloadService', () => ({downloadSurah: jest.fn()}));
jest.mock('@/services/player/bulkDownloadSurahs', () => ({
  bulkDownloadSurahs: jest.fn(),
}));
jest.mock('@/services/analytics/AnalyticsService', () => ({
  analyticsService: {trackReciterSelected: jest.fn()},
}));
jest.mock('@/utils/shareUtils', () => ({
  reciterShareUrl: jest.fn(),
  shareUrl: jest.fn(),
}));
jest.mock('@/utils/track', () => ({createTracksForReciter: jest.fn()}));
jest.mock('@/utils/toastUtils', () => ({showToast: jest.fn()}));
jest.mock('@/utils/audioUtils', () => ({generateSmartAudioUrl: jest.fn()}));
jest.mock('@/utils/artworkUtils', () => ({getReciterArtwork: jest.fn()}));

// The children are stubs: this test is about where the screen puts them.
jest.mock('@/components/sheets/options/surahOptions', () => ({
  SurahOptionsScope: ({children}: {children: React.ReactNode}) => children,
}));
jest.mock('../components/TabletReciterHero', () => ({
  TabletReciterHero: () => null,
}));
jest.mock('../components/SurahList', () => ({
  SurahList: () => null,
  SurahListTableHeader: () => null,
}));
jest.mock('../components/RewayatTabBar', () => ({RewayatTabBar: () => null}));
jest.mock('../components/SearchView', () => ({SearchView: () => null}));
jest.mock('../components/UploadsTabContent', () => ({
  UploadsTabContent: () => null,
}));
jest.mock('../components/NavigationButtons', () => ({
  NavigationButtons: () => null,
}));
jest.mock('../components/ReciterHeader', () => ({ReciterHeader: () => null}));
jest.mock('../components/ActionButtons', () => ({ActionButtons: () => null}));

import ReciterProfile from '../ReciterProfile';
import {TabletReciterHero} from '../components/TabletReciterHero';
import {SurahListTableHeader} from '../components/SurahList';
import {RewayatTabBar} from '../components/RewayatTabBar';

let mounted: TestRenderer.ReactTestRenderer | null = null;
afterEach(() => {
  // Stops the skeleton's looping animation, so Jest can exit.
  act(() => mounted?.unmount());
  mounted = null;
});

function render() {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(<ReciterProfile id="r1" />);
  });
  mounted = renderer;
  return renderer;
}

/** Lays out the profile's root view at `width`. */
function layoutProfile(
  renderer: TestRenderer.ReactTestRenderer,
  width: number,
) {
  const root = renderer.root.findAll(
    n => typeof n.type === 'string' && typeof n.props.onLayout === 'function',
  )[0];
  act(() =>
    root.props.onLayout({nativeEvent: {layout: {width, height: 1032}}}),
  );
}

/** Lays out the horizontal pager at `width`, as the column leaves it. */
function layoutPager(renderer: TestRenderer.ReactTestRenderer, width: number) {
  const pager = renderer.root.findAll(
    n =>
      typeof n.type === 'string' &&
      n.props.horizontal === true &&
      typeof n.props.onLayout === 'function',
  )[0];
  act(() =>
    pager.props.onLayout({nativeEvent: {layout: {width, height: 900}}}),
  );
}

/** The horizontal pager's ScrollView, whose content size the test sets. */
const pager = (renderer: TestRenderer.ReactTestRenderer) =>
  renderer.root.find(
    n =>
      typeof n.type !== 'string' &&
      n.props.horizontal === true &&
      typeof n.props.onContentSizeChange === 'function' &&
      n.instance?.scrollTo !== undefined,
  );

/** Gives the pager pages `pageWidth` wide content for its two tabs. */
function layoutPages(
  renderer: TestRenderer.ReactTestRenderer,
  pageWidth: number,
) {
  act(() => {
    pager(renderer).props.onContentSizeChange(2 * pageWidth, 2000);
    jest.runOnlyPendingTimers();
  });
}

const heroLayouts = (renderer: TestRenderer.ReactTestRenderer) =>
  renderer.root
    .findAllByType(TabletReciterHero)
    .map(n => n.props.layout ?? 'row');

describe('ReciterProfile on a 1376pt iPad window', () => {
  it('waits for the profile width before it places the hero', () => {
    const renderer = render();
    expect(heroLayouts(renderer)).toEqual([]);
  });

  // The profile's width is the window less the sidebar or the rail, or the
  // capped Collection column. The list beside the 448pt column needs 720pt.
  it.each([
    ['the Collection column', 720, 'row'],
    ['a 1000pt pane', 1000, 'row'],
    ['the labelled sidebar', 1096, 'row'],
    ['one point under the column and the table', 1167, 'row'],
    ['exactly the column and the table', 1168, 'column'],
    ['the sidebar collapsed to the rail', 1288, 'column'],
  ])('%s (%ipt): the hero is a %s', (_name, width, layout) => {
    const renderer = render();
    layoutProfile(renderer, width);
    expect(heroLayouts(renderer)).toEqual([layout]);
  });

  it('keeps the table beside the pinned column', () => {
    const renderer = render();
    layoutProfile(renderer, 1288);
    layoutPager(renderer, 1288 - 448);
    expect(heroLayouts(renderer)).toEqual(['column']);
    expect(renderer.root.findAllByType(SurahListTableHeader)).toHaveLength(1);
  });

  it('moves the hero back above the list when the sidebar opens', () => {
    const renderer = render();
    layoutProfile(renderer, 1288);
    expect(heroLayouts(renderer)).toEqual(['column']);
    layoutProfile(renderer, 1096);
    expect(heroLayouts(renderer)).toEqual(['row']);
  });

  it('puts the pager and the tab indicator back on the page after a width change', () => {
    jest.useFakeTimers();
    try {
      const renderer = render();
      layoutProfile(renderer, 1288);
      layoutPager(renderer, 840);
      // The reveal: Hafs is page 1, after My Uploads.
      layoutPages(renderer, 840);
      const scrollTo = pager(renderer).instance.scrollTo as jest.Mock;
      scrollTo.mockClear();

      // The sidebar opens: the hero goes back above the list, and the
      // pager is as wide as the profile.
      layoutProfile(renderer, 1096);
      layoutPager(renderer, 1096);
      layoutPages(renderer, 1096);

      expect(scrollTo).toHaveBeenLastCalledWith({
        x: 1096,
        y: 0,
        animated: false,
      });
      const scrollX = renderer.root.find(
        n => (n.type as unknown) === RewayatTabBar,
      ).props.scrollX;
      expect(scrollX.__getValue()).toBe(1096);
    } finally {
      jest.useRealTimers();
    }
  });
});
