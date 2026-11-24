// @ai-generated
/**
 * "Choose a reciter for <surah>": picking a reciter goes back once, straight
 * away. It used to go back only after the audio had loaded, so a second tap
 * or the user's own Back popped an extra screen.
 */
import React from 'react';
import TestRenderer, {act} from 'react-test-renderer';
import type {Reciter} from '@/data/reciterData';
import type {Theme} from '@/utils/themeUtils';

const mockBack = jest.fn();
const mockPush = jest.fn();
const mockUpdateQueue = jest.fn();
const mockPlay = jest.fn();
const mockStartNewChain = jest.fn();
const mockGrid: {onReciterPress: ((reciter: Reciter) => void) | null} = {
  onReciterPress: null,
};

jest.mock('expo-router', () => ({
  useRouter: () => ({back: mockBack, push: mockPush}),
  useNavigation: () => ({setOptions: jest.fn()}),
}));
jest.mock('@/hooks/usePlayerActions', () => ({
  usePlayerActions: () => ({updateQueue: mockUpdateQueue, play: mockPlay}),
}));
jest.mock('@/services/player/store/recentlyPlayedStore', () => ({
  useRecentlyPlayedStore: (
    selector: (state: {startNewChain: jest.Mock}) => unknown,
  ) => selector({startNewChain: mockStartNewChain}),
}));
jest.mock('@/hooks/useSettings', () => {
  const state = {reciterPreferences: {}, setReciterPreference: jest.fn()};
  const useSettings = () => state;
  useSettings.getState = () => state;
  return {useSettings};
});
jest.mock('@/services/dataService', () => ({
  getSurahById: (id: number) => ({id, name: `Surah ${id}`}),
}));
jest.mock('@/utils/track', () => ({
  createTracksForReciter: async (
    reciter: {id: string},
    surahs: {id: number}[],
    rewayatId: string,
  ) => surahs.map(s => ({id: `${reciter.id}-${s.id}`, rewayatId})),
}));
// @ai: rows hand their onPress to the test; the list draws every item.
jest.mock('../ReciterBrowseItems', () => ({
  CARD_GAP: 8,
  ReciterPanelRow: (props: {onPress: (reciter: Reciter) => void}) => {
    mockGrid.onReciterPress = props.onPress;
    return null;
  },
  ReciterCard: (props: {onPress: (reciter: Reciter) => void}) => {
    mockGrid.onReciterPress = props.onPress;
    return null;
  },
}));
jest.mock('@shopify/flash-list', () => {
  const ReactModule = jest.requireActual('react');
  const FlashList = ReactModule.forwardRef(
    (
      props: {
        data: unknown[];
        renderItem: (info: {item: unknown; index: number}) => unknown;
      },
      _ref: unknown,
    ) =>
      ReactModule.createElement(
        ReactModule.Fragment,
        null,
        props.data.map((item, index) =>
          ReactModule.createElement(
            ReactModule.Fragment,
            {key: index},
            props.renderItem({item, index}),
          ),
        ),
      ),
  );
  return {FlashList};
});
jest.mock('@/data/reciterData', () => ({
  RECITERS: [
    {
      id: 'listed',
      name: 'Listed',
      date: null,
      image_url: null,
      rewayat: [
        {id: 'listed-hafs', name: '', style: 'murattal', surah_list: [36]},
      ],
    },
  ],
}));
jest.mock('@/components/default-reciter/useReciterPreview', () => ({
  previewKey: (a: string, b: string) => `${a}:${b}`,
  useReciterPreview: () => ({
    playingKey: null,
    progress: 0,
    elapsed: 0,
    toggle: jest.fn(),
    stop: jest.fn(),
  }),
}));
jest.mock('@/services/player/store/downloadStore', () => ({
  useDownloadStore: (selector: (state: {downloads: unknown[]}) => unknown) =>
    selector({downloads: []}),
}));
jest.mock('@/store/collectionViewStore', () => ({
  useCollectionViewPref: () => ({
    view: 'list',
    sort: 'name',
    setView: jest.fn(),
    setSort: jest.fn(),
  }),
}));
jest.mock('@/components/native/NativeMenu', () => ({NativeMenu: () => null}));
jest.mock('@/components/native/nativeMenus', () => ({
  nativeMenusAvailable: false,
}));
jest.mock('@/components/collection/CollectionScreenHeader', () => ({
  CollectionSearchField: () => null,
}));
jest.mock('@/components/TintedHeader', () => ({tintedHeaderRight: () => ({})}));
jest.mock('@/components/ActionIcons', () => ({SearchIcon: () => null}));
jest.mock('expo-symbols', () => ({SymbolView: () => null}));
jest.mock('@/components/collection/CollectionPanel', () => ({
  PANEL_MARGIN: 16,
  PANEL_ROW_PADDING: 18,
}));
jest.mock('@/components/settings/SettingsList', () => ({
  GROUPED_HEADER_GAP: 8,
  GROUPED_SECTION_GAP: 22,
  groupedHeaderStyle: () => ({}),
}));
jest.mock('../AlphabetRail', () => ({AlphabetRail: () => null}));
jest.mock('@/components/Header', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@/hooks/useFavoriteReciters', () => ({
  useFavoriteReciters: () => ({
    favoriteReciters: [],
    isFavoriteReciter: () => false,
    toggleFavorite: jest.fn(),
  }),
}));
jest.mock('@/hooks/useTabReciterPath', () => ({
  useReciterProfilePathname: () => '/(tabs)/(a.home)/reciter/[id]',
}));
jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({isTablet: false, width: 390}),
}));
jest.mock('@/hooks/useGlassProps', () => ({USE_GLASS: false}));
jest.mock('@/hooks/useBottomInset', () => ({useBottomInset: () => 0}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({top: 0, bottom: 0, left: 0, right: 0}),
}));
jest.mock('@/utils/reciterImageLookup', () => ({
  getLocalReciterImage: () => undefined,
}));
jest.mock('@expo/vector-icons', () => ({
  Feather: () => null,
  MaterialIcons: () => null,
}));

import BrowseReciters from '../BrowseReciters';

const theme = {
  colors: {text: '#000000', textSecondary: '#666666', background: '#ffffff'},
} as unknown as Theme;

const reciter = (id: string) =>
  ({
    id,
    name: `Reciter ${id}`,
    rewayat: [{id: `${id}-hafs`, name: '', style: 'murattal'}],
  }) as unknown as Reciter;

function renderForSurah() {
  act(() => {
    TestRenderer.create(
      <BrowseReciters theme={theme} onBack={jest.fn()} surahId={36} />,
    );
  });
}

async function pick(...reciters: Reciter[]) {
  await act(async () => {
    reciters.forEach(r => mockGrid.onReciterPress!(r));
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGrid.onReciterPress = null;
  // The audio never finishes loading in these tests.
  mockUpdateQueue.mockReturnValue(new Promise(() => {}));
});

it('goes back without waiting for the audio to load', async () => {
  renderForSurah();
  await pick(reciter('a'));

  expect(mockBack).toHaveBeenCalledTimes(1);
  expect(mockStartNewChain).toHaveBeenCalledWith(
    expect.objectContaining({id: 'a'}),
    expect.objectContaining({id: 36}),
    0,
    0,
    'a-hafs',
  );
  expect(mockUpdateQueue).toHaveBeenCalledWith(
    [{id: 'a-36', rewayatId: 'a-hafs'}],
    0,
  );
});

it('takes one pick: a second tap neither goes back again nor plays', async () => {
  renderForSurah();
  await pick(reciter('a'), reciter('b'));
  await pick(reciter('b'));

  expect(mockBack).toHaveBeenCalledTimes(1);
  expect(mockUpdateQueue).toHaveBeenCalledTimes(1);
  expect(mockStartNewChain).toHaveBeenCalledTimes(1);
  expect(mockStartNewChain.mock.calls[0][0].id).toBe('a');
});

it('leaves starting playback to updateQueue', async () => {
  mockUpdateQueue.mockResolvedValue(undefined);
  renderForSurah();
  await pick(reciter('a'));

  expect(mockPlay).not.toHaveBeenCalled();
});
