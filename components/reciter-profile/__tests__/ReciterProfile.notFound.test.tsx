// @ai-generated
/**
 * A reciter id that is not in the catalogue (a card whose reciter was
 * removed, a mistyped link) used to show a spinner forever, with no way back
 * on screens without the native header.
 */
import React from 'react';
import {Text} from 'react-native';
import TestRenderer, {act} from 'react-test-renderer';

const mockGoBack = jest.fn();
jest.mock('expo-router', () => ({
  useNavigation: () => ({goBack: mockGoBack, setOptions: jest.fn()}),
}));
jest.mock('@/services/dataService', () => ({
  getReciterByIdSync: () => undefined,
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
jest.mock('@/hooks/useLoved', () => ({
  useLoved: () => ({lovedTracks: [], isLovedWithRewayat: () => false}),
}));
jest.mock('@/hooks/usePlayerActions', () => ({
  usePlayerActions: () => ({}),
}));
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
jest.mock('@/services/player/store/recentlyPlayedStore', () => ({
  useRecentlyPlayedStore: (select: (state: unknown) => unknown) =>
    select({startNewChain: jest.fn()}),
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
jest.mock('@/utils/audioUtils', () => ({generateSmartAudioUrl: jest.fn()}));
jest.mock('@/utils/artworkUtils', () => ({getReciterArtwork: jest.fn()}));
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
jest.mock('../components/NavigationButtons', () => ({
  NavigationButtons: () => null,
}));
jest.mock('../components/SurahList', () => ({
  SurahList: () => null,
  SurahListTableHeader: () => null,
  TABLE_MIN_WIDTH: 720,
}));
jest.mock('../components/SearchView', () => ({SearchView: () => null}));
jest.mock('../components/RewayatTabBar', () => ({RewayatTabBar: () => null}));
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

beforeEach(() => {
  jest.useFakeTimers();
  mockGoBack.mockClear();
});
afterEach(() => jest.useRealTimers());

it('says the reciter was not found and offers a way back', () => {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(<ReciterProfile id="gone" />);
  });
  // The profile mounts its content once the push transition has settled.
  act(() => {
    jest.runAllTimers();
  });

  const texts = renderer.root
    .findAll(node => (node.type as unknown) === Text)
    .map(node => node.props.children);
  expect(texts).toEqual([
    'Reciter not found',
    'This reciter is not available in the app right now.',
    'Back',
  ]);

  const back = renderer.root.find(
    node =>
      typeof node.type !== 'string' &&
      node.props.accessibilityRole === 'button',
  );
  act(() => {
    back.props.onPress();
  });
  expect(mockGoBack).toHaveBeenCalledTimes(1);
});
