// @ai-generated
/**
 * Repro tests for PR #491 (RFC-023 step 5), written during code review.
 *
 * Built from a copy of MushafViewerFirstContent.test.tsx with the same mocks.
 * The one change to the mocks: the FlatList stand-in renders its items from
 * initialScrollIndex, as React Native does at the first commit, instead of
 * from index 0. So with pageNumber 3 the restored page renders first.
 *
 * Finding 3 (review comment): every page in the pager window is given
 * noteReaderFirstContent, not only the restored page.
 *   F3: the restored page is 3 and its neighbour 4 is also rendered. Only
 *   page 4 reports ready. Expected: no report, since page 3 is still empty.
 *   On the PR head: the restore state gets 1 report.
 *
 * Finding 4 (review comment): the facing pages view counts reports and fires
 * at 2, assuming one report per page.
 *   F4: in Mushaf 1440 the right page reports twice (what a QCFPage remount
 *   does) and the left page has not reported. Expected: no report.
 *   On the PR head: the spread reports once.
 */
import React, {act} from 'react';
import TestRenderer from 'react-test-renderer';

interface MockSurfaceProps {
  pageNumber?: number;
  onReady?: () => void;
  onFirstContent?: () => void;
}

const mockSurfaces = {
  skiaPages: [] as MockSurfaceProps[],
  qcfPages: [] as MockSurfaceProps[],
  readingPages: [] as MockSurfaceProps[],
  continuousMushaf: [] as MockSurfaceProps[],
  continuousList: [] as MockSurfaceProps[],
};
const mockReport = jest.fn();
const mockLayout = {
  facingPages: false,
  scrollContainerHeight: undefined as number | undefined,
  pageWidth: 400,
  screenWidth: 400,
};
const mockListItems = {count: 1};

jest.mock('@/services/mushaf/readerRestoreState', () => ({
  noteReaderFirstContent: () => mockReport(),
}));

function mockSurface(record: (props: MockSurfaceProps) => void) {
  return {
    __esModule: true,
    default: (props: MockSurfaceProps) => {
      record(props);
      return null;
    },
  };
}

jest.mock('../skia/SkiaPage', () =>
  mockSurface(props => mockSurfaces.skiaPages.push(props)),
);
jest.mock('../qcf/QCFPage', () =>
  mockSurface(props => mockSurfaces.qcfPages.push(props)),
);
jest.mock('../reading/ReadingPageView', () =>
  mockSurface(props => mockSurfaces.readingPages.push(props)),
);
jest.mock('../skia/ContinuousMushafView', () =>
  mockSurface(props => mockSurfaces.continuousMushaf.push(props)),
);
jest.mock('../reading/ContinuousListView', () =>
  mockSurface(props => mockSurfaces.continuousList.push(props)),
);

// Renders the first items only, as the pager does at its first commit,
// starting at initialScrollIndex as React Native does.
jest.mock('react-native-gesture-handler', () => {
  const ReactActual = jest.requireActual<typeof import('react')>('react');
  return {
    FlatList: ReactActual.forwardRef(
      (
        props: {
          data: unknown[];
          initialScrollIndex?: number;
          renderItem: (info: {item: unknown; index: number}) => React.ReactNode;
        },
        _ref: unknown,
      ) =>
        ReactActual.createElement(
          ReactActual.Fragment,
          null,
          props.data
            .slice(
              props.initialScrollIndex ?? 0,
              (props.initialScrollIndex ?? 0) + mockListItems.count,
            )
            .map((item, index) =>
              ReactActual.createElement(
                ReactActual.Fragment,
                {key: index},
                props.renderItem({item, index}),
              ),
            ),
        ),
    ),
  };
});

jest.mock('../constants', () => ({
  getJuzForPage: () => 1,
  getPageEdgeLayout: () => ({isRightPage: true, contentMarginLeft: 0}),
  readerListKey: (name: string) => name,
  singlePageLayout: (metrics: unknown) => metrics,
  useMushafLayout: () => ({
    ...mockLayout,
    screenHeight: 800,
    contentWidth: 380,
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
  useNavigation: () => ({setOptions: jest.fn(), addListener: jest.fn()}),
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
jest.mock('@/services/mushaf/DigitalKhattDataService', () => ({
  digitalKhattDataService: {
    initialized: true,
    rewayah: 'hafs',
    getPageLines: () => [],
    getPageToSurah: () => ({}),
    getSurahStartPages: () => ({}),
  },
}));
jest.mock('@/services/mushaf/MushafSessionStore', () => ({
  mushafSessionStore: {setLastReadPage: jest.fn()},
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
    })),
  };
});
jest.mock('@/store/mushafVerseSelectionStore', () => {
  const {create} = jest.requireActual('zustand');
  return {useMushafVerseSelectionStore: create(() => ({}))};
});
jest.mock('@/store/mushafNavigationStore', () => {
  const {create} = jest.requireActual('zustand');
  return {useMushafNavigationStore: create(() => ({requestId: 0}))};
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
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';

declare const global: {IS_REACT_ACT_ENVIRONMENT?: boolean};
global.IS_REACT_ACT_ENVIRONMENT = true;

let renderer: TestRenderer.ReactTestRenderer | null = null;
let errorSpy: jest.SpyInstance;

function renderViewer(): void {
  act(() => {
    renderer = TestRenderer.create(<MushafViewer pageNumber={3} />);
  });
}

function latest(pages: MockSurfaceProps[], page: number): MockSurfaceProps {
  const found = pages.filter(props => props.pageNumber === page).pop();
  if (!found) throw new Error(`page ${page} did not render`);
  return found;
}

beforeEach(() => {
  for (const pages of Object.values(mockSurfaces)) pages.length = 0;
  mockReport.mockClear();
  mockLayout.facingPages = false;
  mockLayout.scrollContainerHeight = undefined;
  mockLayout.pageWidth = 400;
  mockLayout.screenWidth = 400;
  mockListItems.count = 1;
  useMushafSettingsStore.setState({
    viewMode: 'mushaf',
    scrollDirection: 'horizontal',
    mushafRenderer: 'dk_v2',
  });
  // react-test-renderer prints a deprecation notice under React 19.
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
  errorSpy.mockRestore();
});

describe('PR #491 finding 3: only the restored page may report', () => {
  it('F3: only the restored page (3) may end the splash, not its neighbour (4)', () => {
    mockListItems.count = 2;
    renderViewer(); // <MushafViewer pageNumber={3} />
    // The neighbour is ready; the restored page 3 has not reported.
    act(() => latest(mockSurfaces.skiaPages, 4).onReady?.());
    // On the PR head: called once, from page 4.
    expect(mockReport).not.toHaveBeenCalled();
  });
});

describe('PR #491 finding 4: a spread reports only when both pages have content', () => {
  it('F4: a spread does not report while one facing page has no content', () => {
    mockLayout.facingPages = true;
    mockLayout.pageWidth = 300;
    mockLayout.screenWidth = 800;
    useMushafSettingsStore.setState({mushafRenderer: 'qcf_v2'});
    renderViewer();
    const right = latest(mockSurfaces.qcfPages, 3);
    // The right page reports twice (a remount); the left page never reports.
    act(() => {
      right.onFirstContent?.();
      right.onFirstContent?.();
    });
    // On the PR head: called once, because the count reached 2.
    expect(mockReport).not.toHaveBeenCalled();
  });
});
