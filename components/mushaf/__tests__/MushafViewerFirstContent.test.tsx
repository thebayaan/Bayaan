// @ai-generated
/**
 * RFC-023 step 5: every reader layout reports its first content to the restore
 * state, once. The renderers are stand-ins here (each has its own test). This
 * checks what the viewer does: which layout mounts which surface, and that a
 * page and a spread report once. The horizontal reading view must report too:
 * without it, a restore in the list mode waits for the whole deadline.
 */
import React, {act} from 'react';
import {View} from 'react-native';
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

// Renders the first items only, as the pager does at its first commit.
jest.mock('react-native-gesture-handler', () => {
  const ReactActual = jest.requireActual<typeof import('react')>('react');
  return {
    FlatList: ReactActual.forwardRef(
      (
        props: {
          data: unknown[];
          renderItem: (info: {item: unknown; index: number}) => React.ReactNode;
        },
        _ref: unknown,
      ) =>
        ReactActual.createElement(
          ReactActual.Fragment,
          null,
          props.data
            .slice(0, mockListItems.count)
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

/** The commit that shows a Skia page: DKPageView's opacity is its reveal. */
function pageOpacities(): unknown[] {
  if (!renderer) throw new Error('not rendered');
  return renderer.root
    .findAll(node => (node.type as unknown) === View)
    .map(node => node.props.style?.opacity)
    .filter(opacity => opacity !== undefined);
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

describe('a Mushaf page (DKPageView)', () => {
  it('reports once, in the commit that shows it', () => {
    renderViewer();
    const page = mockSurfaces.skiaPages[0];
    expect(mockReport).not.toHaveBeenCalled();
    expect(pageOpacities()).toContain(0);

    act(() => page.onReady?.());
    expect(pageOpacities()).toContain(1);
    expect(mockReport).toHaveBeenCalledTimes(1);

    // A later draw of the same page calls onReady again.
    act(() => page.onReady?.());
    expect(mockReport).toHaveBeenCalledTimes(1);
  });

  it('reports the same way in the phone landscape scroll view', () => {
    mockLayout.scrollContainerHeight = 300;
    renderViewer();
    act(() => mockSurfaces.skiaPages[0].onReady?.());
    expect(mockReport).toHaveBeenCalledTimes(1);
  });

  it('reports the same way on a centred iPad page', () => {
    mockLayout.pageWidth = 300;
    renderViewer();
    act(() => mockSurfaces.skiaPages[0].onReady?.());
    expect(mockReport).toHaveBeenCalledTimes(1);
  });

  it('hands the report to QCFPage in Mushaf 1440', () => {
    useMushafSettingsStore.setState({mushafRenderer: 'qcf_v2'});
    renderViewer();
    const page = mockSurfaces.qcfPages[0];
    // QCFPage's own test covers when it reports.
    act(() => page.onReady?.());
    expect(mockReport).not.toHaveBeenCalled();
    act(() => page.onFirstContent?.());
    expect(mockReport).toHaveBeenCalledTimes(1);
  });
});

describe('a spread of facing pages (DKSpreadView)', () => {
  beforeEach(() => {
    mockLayout.facingPages = true;
    mockLayout.pageWidth = 300;
    mockLayout.screenWidth = 800;
  });

  it('reports once, when both pages have content', () => {
    renderViewer();
    const left = latest(mockSurfaces.skiaPages, 2);
    const right = latest(mockSurfaces.skiaPages, 1);

    act(() => right.onReady?.());
    expect(mockReport).not.toHaveBeenCalled();
    act(() => left.onReady?.());
    expect(mockReport).toHaveBeenCalledTimes(1);

    act(() => {
      right.onReady?.();
      left.onReady?.();
    });
    expect(mockReport).toHaveBeenCalledTimes(1);
  });

  it('reports once in Mushaf 1440 too', () => {
    useMushafSettingsStore.setState({mushafRenderer: 'qcf_v2'});
    renderViewer();
    act(() => latest(mockSurfaces.qcfPages, 1).onFirstContent?.());
    expect(mockReport).not.toHaveBeenCalled();
    act(() => latest(mockSurfaces.qcfPages, 2).onFirstContent?.());
    expect(mockReport).toHaveBeenCalledTimes(1);
  });
});

describe('the reading views', () => {
  it('passes the report to the horizontal reading view', () => {
    useMushafSettingsStore.setState({viewMode: 'list'});
    renderViewer();
    act(() => mockSurfaces.readingPages[0].onFirstContent?.());
    expect(mockReport).toHaveBeenCalledTimes(1);
  });

  it('uses the single-page reading view where the Mushaf shows spreads', () => {
    mockLayout.facingPages = true;
    useMushafSettingsStore.setState({viewMode: 'list'});
    renderViewer();
    expect(mockSurfaces.readingPages.length).toBeGreaterThan(0);
    act(() => mockSurfaces.readingPages[0].onFirstContent?.());
    expect(mockReport).toHaveBeenCalledTimes(1);
  });

  it('passes the report to the vertical Mushaf', () => {
    useMushafSettingsStore.setState({scrollDirection: 'vertical'});
    renderViewer();
    act(() => mockSurfaces.continuousMushaf[0].onFirstContent?.());
    expect(mockReport).toHaveBeenCalledTimes(1);
  });

  it('passes the report to the vertical list', () => {
    useMushafSettingsStore.setState({
      scrollDirection: 'vertical',
      viewMode: 'list',
    });
    renderViewer();
    act(() => mockSurfaces.continuousList[0].onFirstContent?.());
    expect(mockReport).toHaveBeenCalledTimes(1);
  });
});
