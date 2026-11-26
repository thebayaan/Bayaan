// @ai-generated
/**
 * "Download all" in a reciter profile:
 * - each rewayah has its own batch (another rewayah's button used to show
 *   the running batch's progress, and a tap there cancelled it);
 * - leaving the screen stops the batch and says so (it was silent);
 * - the result alerts go through i18n (they were English only).
 */
import React from 'react';
import {Alert} from 'react-native';
import TestRenderer, {act} from 'react-test-renderer';
import i18n from 'i18next';

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

type Summary = {
  total: number;
  downloaded: number;
  skipped: number;
  failed: number;
  cancelled: boolean;
};
type Batch = {
  items: {surahId: number; rewayatId: string}[];
  callbacks: {
    onProgress: (completed: number, total: number) => void;
    isCancelled: () => boolean;
  };
  finish: (summary: Partial<Summary>) => void;
};
const mockBatches: Batch[] = [];
jest.mock('@/services/player/bulkDownloadSurahs', () => ({
  bulkDownloadSurahs: (
    items: Batch['items'],
    _deps: unknown,
    callbacks: Batch['callbacks'],
  ) =>
    new Promise<Summary>(resolve => {
      mockBatches.push({
        items,
        callbacks,
        finish: summary =>
          resolve({
            total: items.length,
            downloaded: 0,
            skipped: 0,
            failed: 0,
            cancelled: false,
            ...summary,
          }),
      });
    }),
}));

type ActionProps = {
  onDownloadAllPress: () => void;
  isDownloadingAll: boolean;
  downloadAllProgress: number;
};
const mockActions: {props: ActionProps | null} = {props: null};
jest.mock('../components/ActionButtons', () => ({
  ActionButtons: (props: ActionProps) => {
    mockActions.props = props;
    return null;
  },
}));
const mockTabBar: {onTabChange: ((id: string) => void) | null} = {
  onTabChange: null,
};
jest.mock('../components/RewayatTabBar', () => ({
  RewayatTabBar: ({onTabChange}: {onTabChange: (id: string) => void}) => {
    mockTabBar.onTabChange = onTabChange;
    return null;
  },
}));
const mockToast = jest.fn();
jest.mock('@/utils/toastUtils', () => ({
  showToast: (...args: unknown[]) => mockToast(...args),
}));

jest.mock('../components/SurahList', () => ({
  SurahList: () => null,
  SurahListTableHeader: () => null,
  TABLE_MIN_WIDTH: 720,
}));
jest.mock('../components/SearchView', () => ({SearchView: () => null}));
jest.mock('../components/NavigationButtons', () => ({
  NavigationButtons: () => null,
}));
jest.mock('../components/ReciterHeader', () => ({ReciterHeader: () => null}));
jest.mock('../components/UploadsTabContent', () => ({
  UploadsTabContent: () => null,
}));
jest.mock('../components/TabletReciterHero', () => ({
  TabletReciterHero: () => null,
}));
jest.mock('@/hooks/useLoved', () => ({
  useLoved: () => ({lovedTracks: [], isLovedWithRewayat: () => false}),
}));
jest.mock('@/hooks/usePlayerActions', () => ({
  usePlayerActions: () => ({}),
}));
jest.mock('@/services/player/store/recentlyPlayedStore', () => ({
  useRecentlyPlayedStore: (select: (state: unknown) => unknown) =>
    select({startNewChain: jest.fn()}),
}));
jest.mock('@/utils/audioUtils', () => ({generateSmartAudioUrl: jest.fn()}));
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
jest.mock('@/utils/artworkUtils', () => ({getReciterArtwork: jest.fn()}));
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
jest.mock('@/components/player/v2/recitationStyle', () => ({
  getRecitationStyleLabel: (style: string) => style,
}));

import ReciterProfile from '../ReciterProfile';

function open() {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(<ReciterProfile id="r1" />);
  });
  // The content mounts once the push transition has settled.
  act(() => {
    jest.advanceTimersByTime(400);
  });
  return renderer;
}

async function tapDownloadAll() {
  await act(async () => {
    mockActions.props!.onDownloadAllPress();
  });
}

function showTab(id: string) {
  act(() => {
    mockTabBar.onTabChange!(id);
  });
}

async function finish(batch: Batch, summary: Partial<Summary>) {
  await act(async () => {
    batch.finish(summary);
  });
}

let alert: jest.SpyInstance;

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockBatches.length = 0;
  mockActions.props = null;
  mockTabBar.onTabChange = null;
  alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});
afterEach(() => {
  alert.mockRestore();
  jest.useRealTimers();
});

describe('one batch per rewayah', () => {
  it('shows the batch on its own rewayah only', async () => {
    open();
    await tapDownloadAll();
    act(() => {
      mockBatches[0].callbacks.onProgress(1, 3);
    });

    expect(mockBatches[0].items.map(item => item.rewayatId)).toEqual([
      'hafs',
      'hafs',
      'hafs',
    ]);
    expect(mockActions.props!.isDownloadingAll).toBe(true);
    expect(mockActions.props!.downloadAllProgress).toBeCloseTo(1 / 3);

    showTab('warsh');
    expect(mockActions.props!.isDownloadingAll).toBe(false);
    expect(mockActions.props!.downloadAllProgress).toBe(0);

    showTab('hafs');
    expect(mockActions.props!.isDownloadingAll).toBe(true);
  });

  it("starts the other rewayah's batch instead of cancelling this one", async () => {
    open();
    await tapDownloadAll();
    showTab('warsh');
    await tapDownloadAll();

    expect(mockBatches).toHaveLength(2);
    expect(mockBatches[1].items.map(item => item.rewayatId)).toEqual([
      'warsh',
      'warsh',
    ]);
    expect(mockBatches[0].callbacks.isCancelled()).toBe(false);
    expect(mockActions.props!.isDownloadingAll).toBe(true);
  });

  it('cancels a batch with a second tap on its rewayah', async () => {
    open();
    await tapDownloadAll();
    await tapDownloadAll();

    expect(mockBatches).toHaveLength(1);
    expect(mockBatches[0].callbacks.isCancelled()).toBe(true);
  });

  it('clears the button when the batch ends', async () => {
    open();
    await tapDownloadAll();
    await finish(mockBatches[0], {downloaded: 3});

    expect(mockActions.props!.isDownloadingAll).toBe(false);
    // A new batch can be started afterwards.
    await tapDownloadAll();
    expect(mockBatches).toHaveLength(2);
  });
});

describe('leaving the screen', () => {
  it('stops the batch and says so', async () => {
    const renderer = open();
    await tapDownloadAll();
    act(() => {
      renderer.unmount();
    });

    expect(mockBatches[0].callbacks.isCancelled()).toBe(true);
    expect(mockToast).toHaveBeenCalledTimes(1);
    expect(mockToast).toHaveBeenCalledWith(
      'Download all stopped',
      'Open the reciter again to carry on.',
      'none',
    );

    // No alert on whatever screen the user is on by the time it stops.
    await finish(mockBatches[0], {cancelled: true, downloaded: 1});
    expect(alert).not.toHaveBeenCalled();
  });

  it('says nothing when no batch is running', () => {
    const renderer = open();
    act(() => {
      renderer.unmount();
    });
    expect(mockToast).not.toHaveBeenCalled();
  });
});

describe('result alerts', () => {
  it('reports a batch stopped by the user', async () => {
    open();
    await tapDownloadAll();
    await finish(mockBatches[0], {cancelled: true, downloaded: 2});

    expect(alert).toHaveBeenCalledWith(
      'Download Stopped',
      'Downloaded 2 surahs before stopping.',
    );
  });

  it('reports failures', async () => {
    open();
    await tapDownloadAll();
    await finish(mockBatches[0], {downloaded: 2, failed: 1});

    expect(alert).toHaveBeenCalledWith(
      'Download Finished',
      '2 downloaded, 1 failed. Tap again to retry the rest.',
    );
  });

  it('reports a complete download, in the app language', async () => {
    await i18n.changeLanguage('ar');
    try {
      open();
      await tapDownloadAll();
      await finish(mockBatches[0], {downloaded: 3});

      expect(alert).toHaveBeenCalledWith(
        'اكتمل التنزيل',
        'جميع سور Reciter متاحة الآن دون اتصال.',
      );
    } finally {
      await i18n.changeLanguage('en');
    }
  });
});
