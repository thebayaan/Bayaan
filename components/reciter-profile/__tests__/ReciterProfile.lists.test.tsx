// @ai-generated
/**
 * The surah lists of a reciter with more than one rewayah:
 * - a row plays the rewayah of the tab it is in, and the rewayah chip in the
 *   profile's search moves the tab with it (they used to drift apart, so a
 *   tap in the Hafs list played Warsh);
 * - with the heart filter on, un-loving a surah takes it out of the list.
 */
import React from 'react';
import TestRenderer, {act} from 'react-test-renderer';
import type {Surah} from '@/data/surahData';

const mockReciter = {
  id: 'r1',
  name: 'Reciter',
  rewayat: [
    {id: 'hafs', name: 'Hafs', style: 'murattal', surah_list: [1, 2, 36]},
    {id: 'warsh', name: 'Warsh', style: 'murattal', surah_list: [1, 2]},
  ],
};
jest.mock('@/services/dataService', () => ({
  getReciterByIdSync: () => mockReciter,
}));

type ListProps = {
  surahs: Surah[];
  rewayatId: string;
  onSurahPress: (surah: Surah) => void;
};
const mockLists: Record<string, ListProps> = {};
jest.mock('../components/SurahList', () => ({
  SurahList: (props: ListProps) => {
    mockLists[props.rewayatId] = props;
    return null;
  },
  SurahListTableHeader: () => null,
  TABLE_MIN_WIDTH: 720,
}));
type SearchProps = {
  onRewayatSelect: (id: string) => void;
  onSurahPress: (surah: Surah) => void;
};
const mockSearch: {props: SearchProps | null} = {props: null};
jest.mock('../components/SearchView', () => ({
  SearchView: (props: SearchProps) => {
    mockSearch.props = props;
    return null;
  },
}));
const mockTabBar: {activeTabId: string | null} = {activeTabId: null};
jest.mock('../components/RewayatTabBar', () => ({
  RewayatTabBar: ({activeTabId}: {activeTabId: string}) => {
    mockTabBar.activeTabId = activeTabId;
    return null;
  },
}));
const mockNav: {openSearch: (() => void) | null} = {openSearch: null};
jest.mock('../components/NavigationButtons', () => ({
  NavigationButtons: ({onSearchPress}: {onSearchPress: () => void}) => {
    mockNav.openSearch = onSearchPress;
    return null;
  },
}));

type Loved = {reciterId: string; surahId: string; rewayatId: string};
const mockLoved = {
  tracks: [] as Loved[],
  listeners: new Set<() => void>(),
  set(tracks: Loved[]) {
    mockLoved.tracks = tracks;
    mockLoved.listeners.forEach(listener => listener());
  },
  // One function for the life of the screen, as the real store's is.
  isLovedWithRewayat: (
    reciterId: string,
    surahId: string | number,
    rewayatId: string,
  ) =>
    mockLoved.tracks.some(
      track =>
        track.reciterId === reciterId &&
        track.surahId === String(surahId) &&
        track.rewayatId === rewayatId,
    ),
};
jest.mock('@/hooks/useLoved', () => {
  const MockReact = jest.requireActual('react');
  return {
    useLoved: () => ({
      lovedTracks: MockReact.useSyncExternalStore(
        (listener: () => void) => {
          mockLoved.listeners.add(listener);
          return () => mockLoved.listeners.delete(listener);
        },
        () => mockLoved.tracks,
      ),
      isLovedWithRewayat: mockLoved.isLovedWithRewayat,
    }),
  };
});

const mockUpdateQueue = jest.fn(async (_tracks: unknown[], _index: number) => {
  return undefined;
});
jest.mock('@/hooks/usePlayerActions', () => ({
  usePlayerActions: () => ({
    updateQueue: mockUpdateQueue,
    addToQueue: jest.fn(),
    toggleShuffle: jest.fn(),
  }),
}));
const mockStartNewChain = jest.fn();
jest.mock('@/services/player/store/recentlyPlayedStore', () => ({
  useRecentlyPlayedStore: (select: (state: unknown) => unknown) =>
    select({startNewChain: mockStartNewChain}),
}));
jest.mock('@/utils/audioUtils', () => ({
  generateSmartAudioUrl: (
    reciter: {id: string},
    surahId: string,
    rewayatId: string,
  ) => `${reciter.id}/${rewayatId}/${surahId}`,
}));

jest.mock('expo-router', () => ({
  useNavigation: () => ({goBack: jest.fn(), setOptions: jest.fn()}),
}));
jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: {
      isDarkMode: false,
      colors: {
        text: '#000000',
        textSecondary: '#666666',
        background: '#ffffff',
        border: '#dddddd',
        card: '#ffffff',
        error: '#ff0000',
      },
      fonts: {bold: 'b', semiBold: 's', medium: 'm', regular: 'r'},
    },
  }),
}));
jest.mock('@/hooks/useGlassProps', () => ({USE_GLASS: false}));
jest.mock('@/hooks/useGlassHeaderHeight', () => ({
  useGlassHeaderHeight: () => 0,
}));
jest.mock('@/hooks/useBottomInset', () => ({useBottomInset: () => 0}));
jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({isTablet: false}),
}));
jest.mock('react-native-safe-area-context', () => {
  const {View} = jest.requireActual('react-native');
  return {
    SafeAreaView: View,
    useSafeAreaInsets: () => ({top: 0, bottom: 0, left: 0, right: 0}),
  };
});
jest.mock('expo-status-bar', () => ({StatusBar: () => null}));
jest.mock('@/hooks/useFavoriteReciters', () => ({
  useFavoriteReciters: () => ({
    toggleFavorite: jest.fn(),
    isFavoriteReciter: () => false,
  }),
}));
jest.mock('@/services/player/store/playerStore', () => ({
  usePlayerStore: (select: (state: unknown) => unknown) =>
    select({settings: {shuffle: false}}),
}));
jest.mock('@/services/player/store/downloadSelectors', () => ({
  useDownloadQueries: () => ({}),
  useDownloadActions: () => ({}),
  useAreAllSurahsDownloaded: () => false,
}));
jest.mock('@/services/downloadService', () => ({downloadSurah: jest.fn()}));
jest.mock('@/services/player/bulkDownloadSurahs', () => ({
  bulkDownloadSurahs: jest.fn(),
}));
jest.mock('@/store/uploadsStore', () => ({
  useUploadsStore: (select: (state: unknown) => unknown) =>
    select({recitations: []}),
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
  const useSettings = (select?: (s: typeof state) => unknown) =>
    select ? select(state) : state;
  useSettings.getState = () => state;
  return {useSettings};
});
jest.mock('@/utils/track', () => ({createTracksForReciter: jest.fn()}));
jest.mock('@/utils/artworkUtils', () => ({getReciterArtwork: () => 'art'}));
jest.mock('@/utils/toastUtils', () => ({showToast: jest.fn()}));
jest.mock('@/utils/shareUtils', () => ({
  reciterShareUrl: jest.fn(),
  shareUrl: jest.fn(),
}));
jest.mock('@/services/analytics/AnalyticsService', () => ({
  analyticsService: {trackReciterSelected: jest.fn()},
}));
jest.mock('@/components/sheets/options/surahOptions', () => ({
  SurahOptionsScope: ({children}: {children: React.ReactNode}) => children,
}));
jest.mock('react-native-actions-sheet', () => ({SheetManager: {}}));
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
jest.mock('@expo/vector-icons', () => ({Feather: () => null}));
jest.mock('@/components/Icons', () => ({HeartIcon: () => null}));
jest.mock('../components/ActionButtons', () => ({ActionButtons: () => null}));
jest.mock('../components/ReciterHeader', () => ({ReciterHeader: () => null}));
jest.mock('../components/UploadsTabContent', () => ({
  UploadsTabContent: () => null,
}));
jest.mock('../components/TabletReciterHero', () => ({
  TabletReciterHero: () => null,
}));
jest.mock('@/components/player/v2/recitationStyle', () => ({
  getRecitationStyleLabel: (style: string) => style,
}));

import ReciterProfile from '../ReciterProfile';

const PAGE_WIDTH = 390;

/** Mounts the profile with its pager measured and every tab's list drawn. */
function open(props: {showLoved?: boolean} = {}) {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(<ReciterProfile id="r1" {...props} />);
  });
  // The content mounts once the push transition has settled. Timers are
  // stepped, not drained: the list skeleton pulses for as long as it shows.
  act(() => {
    jest.advanceTimersByTime(400);
  });
  const pager = renderer.root.findAll(
    node =>
      node.props.horizontal === true &&
      typeof node.props.onLayout === 'function' &&
      typeof node.props.onContentSizeChange === 'function',
  )[0];
  act(() => {
    pager.props.onLayout({
      nativeEvent: {layout: {width: PAGE_WIDTH, height: 800}},
    });
  });
  // Uploads, Hafs, Warsh: the neighbours of the first tab render after this.
  act(() => {
    pager.props.onContentSizeChange(PAGE_WIDTH * 3, 800);
    jest.advanceTimersByTime(50);
  });
  return renderer;
}

const ids = (surahs: Surah[]) => surahs.map(surah => surah.id);
const queuedRewayat = () =>
  (mockUpdateQueue.mock.calls[0][0] as {rewayatId: string}[]).map(
    track => track.rewayatId,
  );

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockLoved.tracks = [];
  mockLoved.listeners.clear();
  mockSearch.props = null;
  mockNav.openSearch = null;
  mockTabBar.activeTabId = null;
  for (const key of Object.keys(mockLists)) delete mockLists[key];
});
afterEach(() => jest.useRealTimers());

describe('rewayah tabs', () => {
  it('opens on the first rewayah, each tab listing its own surahs', () => {
    open();
    expect(mockTabBar.activeTabId).toBe('hafs');
    expect(ids(mockLists.hafs.surahs)).toEqual([1, 2, 36]);
    expect(ids(mockLists.warsh.surahs)).toEqual([1, 2]);
  });

  it('plays the rewayah of the tab the row is in', async () => {
    open();
    // The Warsh list, while Hafs is still the selected rewayah.
    await act(async () => {
      mockLists.warsh.onSurahPress(mockLists.warsh.surahs[1]);
    });

    expect(queuedRewayat()).toEqual(['warsh', 'warsh']);
    expect(mockUpdateQueue.mock.calls[0][0]).toEqual([
      expect.objectContaining({surahId: '2', url: 'r1/warsh/2'}),
      expect.objectContaining({surahId: '1', url: 'r1/warsh/1'}),
    ]);
    expect(mockStartNewChain).toHaveBeenCalledWith(
      expect.objectContaining({id: 'r1'}),
      expect.objectContaining({id: 2}),
      0,
      0,
      'warsh',
    );
  });

  it('moves the tab when a rewayah chip is picked in search', async () => {
    open();
    act(() => {
      mockNav.openSearch!();
    });
    act(() => {
      mockSearch.props!.onRewayatSelect('warsh');
    });

    expect(mockTabBar.activeTabId).toBe('warsh');

    // The search list is the selected rewayah's.
    await act(async () => {
      mockSearch.props!.onSurahPress(mockLists.warsh.surahs[0]);
    });
    expect(queuedRewayat()).toEqual(['warsh', 'warsh']);
  });
});

describe('loved only', () => {
  const loved = (surahId: string): Loved => ({
    reciterId: 'r1',
    surahId,
    rewayatId: 'hafs',
  });

  it('drops a surah from the list when it is un-loved', () => {
    mockLoved.tracks = [loved('1'), loved('36')];
    open({showLoved: true});
    expect(ids(mockLists.hafs.surahs)).toEqual([1, 36]);

    act(() => {
      mockLoved.set([loved('1')]);
    });

    expect(ids(mockLists.hafs.surahs)).toEqual([1]);
  });

  it('plays what is left after an un-love', async () => {
    mockLoved.tracks = [loved('1'), loved('36')];
    open({showLoved: true});
    act(() => {
      mockLoved.set([loved('36')]);
    });

    await act(async () => {
      mockLists.hafs.onSurahPress(mockLists.hafs.surahs[0]);
    });
    expect(mockUpdateQueue.mock.calls[0][0]).toEqual([
      expect.objectContaining({surahId: '36'}),
    ]);
  });
});
