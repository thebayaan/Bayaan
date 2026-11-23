/**
 * The page and surah the reader counts as current. The header, last-read,
 * "Continue reading" and the reading widget all follow them.
 *
 * iPad spreads: a jump remembers the page it asked for until the spread
 * holding it reports (spreadPage.ts). A second jump right after the first,
 * back to the spread being left, was taken for a jump within the spread
 * shown and scrolled nowhere, while the list was still on its way to the
 * first jump's spread: the reader ended there.
 *
 * Reopened at the last-read page with only its page (Continue reading, the
 * widget, the restore at launch), the reader named the last surah to start on
 * the page and saved it over the surah being read: on page 604, Al-Ikhlas
 * became An-Nas after one round trip.
 */
import React, {act} from 'react';
import TestRenderer from 'react-test-renderer';

type MockViewability = {viewableItems: Array<{item: unknown; index: number}>};

const mockLayout = {facingPages: true};
const mockSession = {
  page: null as number | null,
  surahId: null as number | null,
};
/** The pager: its data, its viewability callback, and each scroll asked of it. */
const mockList = {
  data: [] as unknown[],
  onViewableItemsChanged: null as ((info: MockViewability) => void) | null,
  scrolls: [] as number[],
};

// Renders no page: these tests read what the viewer makes current.
jest.mock('react-native-gesture-handler', () => {
  const ReactActual = jest.requireActual('react');
  return {
    FlatList: ReactActual.forwardRef(
      (
        props: {
          data: unknown[];
          onViewableItemsChanged?: (info: MockViewability) => void;
        },
        ref: unknown,
      ) => {
        mockList.data = props.data;
        mockList.onViewableItemsChanged = props.onViewableItemsChanged ?? null;
        ReactActual.useImperativeHandle(ref, () => ({
          scrollToIndex: ({index}: {index: number}) => {
            mockList.scrolls.push(index);
          },
        }));
        return null;
      },
    ),
  };
});
jest.mock('../skia/SkiaPage', () => () => null);
jest.mock('../qcf/QCFPage', () => () => null);
jest.mock('../reading/ReadingPageView', () => () => null);
jest.mock('../skia/ContinuousMushafView', () => () => null);
jest.mock('../reading/ContinuousListView', () => () => null);
jest.mock('../RecitationMicButton', () => ({
  useRecitationFollowAlong: () => undefined,
}));

jest.mock('../constants', () => ({
  ...jest.requireActual('../constants'),
  useMushafLayout: () => ({
    ...mockLayout,
    scrollContainerHeight: undefined,
    pageWidth: 300,
    screenWidth: 800,
    screenHeight: 800,
    contentWidth: 280,
    contentHeight: 700,
    paddingHorizontal: 10,
    paddingTop: 50,
    paddingBottom: 50,
    baseLineHeight: 40,
    facingGap: 8,
    pageOffsetX: 0,
  }),
}));

jest.mock('expo-keep-awake', () => ({useKeepAwake: () => undefined}));
jest.mock('react-native-reanimated', () => {
  const {View: AnimatedView} = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: {View: AnimatedView},
    useSharedValue: (value: unknown) => ({value}),
    useAnimatedStyle: () => ({}),
    withTiming: (value: unknown) => value,
  };
});
jest.mock('expo-router', () => ({
  useRouter: () => ({back: jest.fn()}),
  useNavigation: () => ({
    setOptions: jest.fn(),
    addListener: jest.fn(() => () => {}),
  }),
}));
jest.mock('expo-router/react-navigation', () => ({useHeaderHeight: () => 0}));
jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        background: '#ffffff',
        text: '#111111',
        textSecondary: '#666666',
        border: '#cccccc',
      },
    },
    isDarkMode: false,
  }),
}));
jest.mock('@/hooks/useReadingThemeColors', () => ({
  useReadingThemeColors: () => ({
    card: '#ffffff',
    background: '#fafafa',
    text: '#111111',
    textSecondary: '#666666',
  }),
}));
jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({isTablet: false}),
}));
jest.mock('@/hooks/useGlassProps', () => ({
  useGlassTint: () => undefined,
  USE_GLASS: true,
  useGlassColorScheme: () => 'light',
}));
jest.mock('@/hooks/useMushafAutoPageTurn', () => ({
  useMushafAutoPageTurn: () => undefined,
}));
jest.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
  Feather: () => null,
}));
jest.mock('@/utils/shareUtils', () => ({
  mushafShareUrl: () => '',
  shareUrl: () => undefined,
}));
jest.mock('@/config/branding', () => ({__esModule: true, default: {}}));
jest.mock('react-native-actions-sheet', () => ({
  SheetManager: {show: jest.fn()},
}));
jest.mock('expo-glass-effect', () => ({GlassView: () => null}));
jest.mock('@/components/FrostedView', () => ({FrostedView: () => null}));
jest.mock('@/components/BackButton', () => ({BackButton: () => null}));
jest.mock('../MushafSearchView', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@/components/layout/TabletDialog', () => ({
  TabletDialog: () => null,
}));
jest.mock('@/components/sheets/AdaptiveActionSheet', () => ({
  SHEET_MAX_HEIGHT: 600,
}));
jest.mock('@/components/MushafSettingsContent', () => ({
  RewayahFallbackBanner: () => null,
}));
jest.mock('@/components/keyboard/ReaderKeyCommands', () => ({
  ReaderKeyCommands: () => null,
}));
jest.mock('@/services/keyboard/keyCommands', () => ({
  keyCommandsSupported: () => false,
}));
jest.mock('@/services/keyboard/keyActions', () => ({
  closeTopSheet: () => false,
}));
jest.mock('@/components/popovers/ToolPopovers', () => ({
  ReadingSettingsPopover: () => null,
}));
jest.mock('../MushafPlayerBar', () => ({MushafPlayerBar: () => null}));
jest.mock('../PageEdgeDecoration', () => ({
  __esModule: true,
  default: () => null,
  EDGE_BORDER_RADIUS: 40,
  EDGE_HORIZONTAL_INSET: 4,
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({top: 0, bottom: 0, left: 0, right: 0}),
}));
jest.mock('@/services/analytics/AnalyticsService', () => ({
  analyticsService: {
    trackMushafPageOpened: jest.fn(),
    trackMushafPageRead: jest.fn(),
    trackMushafSessionEnded: jest.fn(),
  },
}));
jest.mock('@/services/mushaf/QCFFontLoader', () => ({
  qcfFontLoader: {ensure: jest.fn(() => Promise.resolve())},
  getQCFFontVariant: () => 'v2',
}));
jest.mock('@/services/mushaf/MushafPreloadService', () => ({
  mushafPreloadService: {fontMgr: null},
}));
jest.mock('@/services/mushaf/DigitalKhattDataService', () => {
  // Pages 591 and 604 start more than one surah: the page map names the
  // last one to start there.
  const pageToSurah = {1: 1, 2: 2, 311: 19, 312: 20, 591: 87, 604: 114};
  const surahStartPages = {
    1: 1,
    2: 2,
    20: 312,
    86: 591,
    87: 591,
    112: 604,
    113: 604,
    114: 604,
  };
  return {
    digitalKhattDataService: {
      initialized: true,
      rewayah: 'hafs',
      getPageLines: () => [],
      getPageToSurah: () => pageToSurah,
      getSurahStartPages: () => surahStartPages,
      subscribeCacheChanges: () => () => undefined,
    },
  };
});
jest.mock('@/services/mushaf/MushafSessionStore', () => ({
  mushafSessionStore: {
    getLastReadPage: () => mockSession.page,
    getLastReadSurahId: () => mockSession.surahId,
    setLastRead: jest.fn(),
    setLastReadPage: jest.fn(),
  },
}));
jest.mock('@/services/mushaf/MushafVerseMapService', () => ({
  followShownRewayah: () => () => undefined,
  mushafVerseMapService: {getOrderedVerseKeysForPage: () => []},
  verseNavigationTarget: () => ({}),
}));
jest.mock('@/store/verseAnnotationsStore', () => {
  const {create} = jest.requireActual('zustand');
  return {
    useVerseAnnotationsStore: create(() => ({
      loadAnnotationsForSurahs: () => undefined,
    })),
  };
});
jest.mock('@/store/mushafPlayerStore', () => {
  const {create} = jest.requireActual('zustand');
  return {
    useMushafPlayerStore: create(() => ({
      playbackState: 'idle',
      isSearchMode: false,
      currentPage: 1,
    })),
  };
});
jest.mock('@/store/mushafVerseSelectionStore', () => {
  const {create} = jest.requireActual('zustand');
  return {
    SELECTION_FLASH_MS: 3000,
    flashedSelectionClearer: () => () => undefined,
    useMushafVerseSelectionStore: create(() => ({})),
  };
});
jest.mock('@/store/mushafSettingsStore', () => {
  const {create} = jest.requireActual('zustand');
  return {
    useMushafSettingsStore: create(() => ({
      pageLayout: 'book',
      viewMode: 'mushaf',
      scrollDirection: 'horizontal',
      rewayah: 'hafs',
      mushafRenderer: 'dk_v2',
      rewayahFallbackFrom: null,
      chains: [],
      activeChainIndex: 0,
      updateActiveChain: () => undefined,
      startNewChain: () => undefined,
      resumeChain: () => undefined,
    })),
  };
});
jest.mock('@/utils/rewayahLabels', () => ({
  getRewayahShortLabel: () => 'Hafs',
}));
jest.mock('@/utils/rtl', () => ({appLayoutDirection: {}, isRTL: false}));
jest.mock('@/i18n', () => ({
  __esModule: true,
  default: {t: (key: string) => key},
}));
jest.mock('@/i18n/format', () => ({
  getSurahDisplayName: () => 'Al-Fatihah',
  localizeDigits: (value: unknown) => String(value),
}));

import MushafViewer from '../main';
import {mushafSessionStore} from '@/services/mushaf/MushafSessionStore';
import {useMushafNavigationStore} from '@/store/mushafNavigationStore';
import {useMushafPlayerStore} from '@/store/mushafPlayerStore';

declare const global: {IS_REACT_ACT_ENVIRONMENT?: boolean};
global.IS_REACT_ACT_ENVIRONMENT = true;

let renderer: TestRenderer.ReactTestRenderer | null = null;
let errorSpy: jest.SpyInstance;

function renderViewer(props: React.ComponentProps<typeof MushafViewer>): void {
  act(() => {
    renderer = TestRenderer.create(<MushafViewer {...props} />);
  });
}

/** A link to the open reader asks it for `page`. */
function jumpTo(page: number): void {
  act(() => {
    useMushafNavigationStore.getState().navigateTo({page});
  });
}

/** The list reports the item at `index` as the one in view. */
function listShows(index: number): void {
  act(() => {
    mockList.onViewableItemsChanged?.({
      viewableItems: [{item: mockList.data[index], index}],
    });
  });
}

const lastScroll = () => mockList.scrolls[mockList.scrolls.length - 1];
const currentPage = () => useMushafPlayerStore.getState().currentPage;

beforeEach(() => {
  mockLayout.facingPages = true;
  mockSession.page = null;
  mockSession.surahId = null;
  mockList.scrolls.length = 0;
  (mushafSessionStore.setLastRead as jest.Mock).mockClear();
  useMushafPlayerStore.setState({currentPage: 1});
  // react-test-renderer prints a deprecation notice under React 19.
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
  errorSpy.mockRestore();
});

describe('jumps on iPad spreads', () => {
  // Spread 155 is 311 | 312 (Ta-Ha starts on 312); spread 0 is 1 | 2.
  beforeEach(() => {
    renderViewer({pageNumber: 1});
    listShows(0);
  });

  it('a jump to an even page makes that page current', () => {
    jumpTo(312);
    expect(lastScroll()).toBe(155);
    listShows(155);
    expect(currentPage()).toBe(312);
  });

  it('a second jump, back to the spread being left before the first one reported, takes the list back there', () => {
    jumpTo(312);
    jumpTo(2);
    expect(lastScroll()).toBe(0);
    // The list may report nothing: it ends on the spread it was on.
    expect(currentPage()).toBe(2);
  });

  it('the reader then stays on the page of the last jump', () => {
    jumpTo(312);
    jumpTo(2);
    listShows(lastScroll());
    expect(currentPage()).toBe(2);
  });

  it("also when the list reports the first jump's spread on its way", () => {
    jumpTo(312);
    jumpTo(2);
    listShows(155);
    listShows(lastScroll());
    expect(currentPage()).toBe(2);
  });

  it('a jump to the other page of the spread shown makes it current and still tells the list where to go', () => {
    jumpTo(2);
    expect(currentPage()).toBe(2);
    // A swipe may be taking the list away: the jump wins, as it always did.
    expect(lastScroll()).toBe(0);
  });
});

describe('reopened at the last-read page', () => {
  beforeEach(() => {
    mockLayout.facingPages = false;
  });

  const lastSaved = () =>
    (mushafSessionStore.setLastRead as jest.Mock).mock.calls.at(-1);

  it('names the surah saved with that page, and keeps it saved (604: Al-Ikhlas, not An-Nas)', () => {
    mockSession.page = 604;
    mockSession.surahId = 112;
    renderViewer({pageNumber: 604});
    expect(lastSaved()).toEqual([604, 112]);
    expect(mushafSessionStore.setLastRead).not.toHaveBeenCalledWith(604, 114);
  });

  it("591: At-Tariq stays At-Tariq, not Al-A'la", () => {
    mockSession.page = 591;
    mockSession.surahId = 86;
    renderViewer({pageNumber: 591});
    expect(lastSaved()).toEqual([591, 86]);
  });

  it('a surah the open names still wins (Al-Falaq from the Surahs tab)', () => {
    mockSession.page = 604;
    mockSession.surahId = 112;
    renderViewer({pageNumber: 604, initialSurahId: 113});
    expect(lastSaved()).toEqual([604, 113]);
  });

  it('a surah saved with another page is not used', () => {
    mockSession.page = 591;
    mockSession.surahId = 86;
    renderViewer({pageNumber: 604});
    expect(lastSaved()).toEqual([604, 114]);
  });

  it('a saved surah that does not start on the page is not used', () => {
    mockSession.page = 604;
    mockSession.surahId = 2;
    renderViewer({pageNumber: 604});
    expect(lastSaved()).toEqual([604, 114]);
  });
});
