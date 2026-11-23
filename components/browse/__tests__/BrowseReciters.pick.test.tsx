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
jest.mock('../BrowseGrid', () => ({
  __esModule: true,
  default: (props: {onReciterPress: (reciter: Reciter) => void}) => {
    mockGrid.onReciterPress = props.onReciterPress;
    return null;
  },
}));
jest.mock('../FilterModal', () => ({__esModule: true, default: () => null}));
// @ai: the filters open as a native sheet only on iPhone (not here).
jest.mock('@/components/sheets/sheetControl', () => ({
  presentsNatively: () => false,
  showSheet: jest.fn(),
}));
jest.mock('@/components/SearchInput', () => ({SearchInput: () => null}));
jest.mock('@/components/Header', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@/hooks/useFavoriteReciters', () => ({
  useFavoriteReciters: () => ({}),
}));
jest.mock('@/hooks/useTabReciterPath', () => ({
  useReciterProfilePathname: () => '/(tabs)/(a.home)/reciter/[id]',
}));
jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({isTablet: false, width: 390}),
}));
jest.mock('@/hooks/useGlassProps', () => ({USE_GLASS: false}));
jest.mock('@/hooks/useGlassHeaderHeight', () => ({
  useGlassHeaderHeight: () => 0,
}));
jest.mock('@/hooks/useBottomInset', () => ({useBottomInset: () => 0}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({top: 0, bottom: 0, left: 0, right: 0}),
}));
jest.mock('@/utils/reciterImageLookup', () => ({
  getLocalReciterImage: () => undefined,
}));
jest.mock('@expo/vector-icons', () => ({Feather: () => null}));
jest.mock('react-native-reanimated', () => {
  const {View} = jest.requireActual('react-native');
  const transition = {duration: () => transition};
  return {
    __esModule: true,
    default: {View},
    FadeIn: transition,
    FadeOut: transition,
    LinearTransition: transition,
  };
});

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
