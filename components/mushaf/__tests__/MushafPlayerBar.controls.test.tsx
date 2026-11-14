// @ai-generated
/**
 * What the mushaf player bar's buttons ask of the player
 * (components/mushaf/MushafPlayerBar.tsx, the bar of every device but
 * iOS 26): the real bar over the real store, with the store's playback
 * actions replaced by spies.
 *
 *  - Play starts the page on screen: a range or a start verse left in the
 *    store by an earlier request must not decide where it starts;
 *  - Next / Previous ayah go through the store, which tells a skip from the
 *    reciter reaching the next verse (verse repeat used to undo the skip).
 */

import React, {act} from 'react';
import TestRenderer from 'react-test-renderer';

jest.mock('@/utils/toastUtils', () => ({showToast: jest.fn()}));
jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: {colors: {text: '#111111', textSecondary: '#555555'}},
  }),
}));
jest.mock('@expo/vector-icons', () => ({
  Feather: () => null,
  Ionicons: () => null,
}));
jest.mock('@/components/Icons', () => ({
  PlayIcon: () => null,
  PauseIcon: () => null,
}));
const mockShowSheet = jest.fn();
jest.mock('react-native-actions-sheet', () => ({
  SheetManager: {show: (...args: unknown[]) => mockShowSheet(...args)},
}));

// mushafPlayerStore's playback dependencies (not exercised here)
jest.mock('expo-audio', () => ({createAudioPlayer: jest.fn()}));
jest.mock('@/services/audio/AudioCoordinator', () => ({
  audioCoordinator: {mushafWillPlay: jest.fn(), sourceDidStop: jest.fn()},
}));
jest.mock('@/data/reciterData', () => ({RECITERS: []}));
jest.mock('@/services/timestamps/TimestampService', () => ({
  timestampService: {getTimestampsForSurah: async () => null},
}));
jest.mock('@/services/timestamps/TimestampFetchService', () => ({
  timestampFetchService: {hasSurah: () => true, hasSource: () => true},
}));
jest.mock('@/services/mushaf/MushafVerseMapService', () => ({
  mushafVerseMapService: {getOrderedVerseKeysForPage: () => []},
}));
jest.mock('@/services/recitation/RecitationTrackingService', () => ({
  stopRecitationTracking: jest.fn(),
}));
jest.mock('@/components/mushaf/RecitationMicButton', () => ({
  RecitationMicButton: () => null,
  peekOnPage: jest.fn(),
  useRecitationStatusText: () => null,
}));

import {MushafPlayerBar} from '@/components/mushaf/MushafPlayerBar';
import {
  useMushafPlayerStore,
  type MushafPlayerStoreState,
} from '@/store/mushafPlayerStore';

declare const global: {IS_REACT_ACT_ENVIRONMENT?: boolean};
global.IS_REACT_ACT_ENVIRONMENT = true;

const PAGE = 300;
const initial = useMushafPlayerStore.getState();
const st = () => useMushafPlayerStore.getState();
let renderer: TestRenderer.ReactTestRenderer | null = null;

function press(label: string) {
  const target = renderer!.root.find(
    n =>
      n.props.accessibilityLabel === label &&
      typeof n.props.onPress === 'function',
  );
  act(() => {
    target.props.onPress();
  });
}

/** What the store held when the bar asked it to start. */
type StartSnapshot = Pick<
  MushafPlayerStoreState,
  'rangeStart' | 'rangeEnd' | 'rangeUnits' | 'pendingStartVerseKey'
> & {page: number; startAt: unknown};

function spyOnStart(): StartSnapshot[] {
  const starts: StartSnapshot[] = [];
  useMushafPlayerStore.setState({
    startPlayback: async (page, startAt) => {
      const {rangeStart, rangeEnd, rangeUnits, pendingStartVerseKey} = st();
      starts.push({
        page,
        startAt,
        rangeStart,
        rangeEnd,
        rangeUnits,
        pendingStartVerseKey,
      });
    },
  });
  return starts;
}

beforeEach(() => {
  mockShowSheet.mockClear();
  useMushafPlayerStore.setState(initial, true);
  act(() => {
    renderer = TestRenderer.create(<MushafPlayerBar currentPage={PAGE} />);
  });
});

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
});

describe('Play', () => {
  it('starts the page on screen, not a range or start verse left behind', () => {
    const starts = spyOnStart();
    useMushafPlayerStore.setState({
      rewayatId: 'hafs-clean',
      // a start that failed left its range; a closed sheet its start verse
      rangeStart: {surah: 112, ayah: 3},
      rangeEnd: {surah: 112, ayah: 4},
      pendingStartVerseKey: '36:1',
    });
    press('Play');
    expect(starts).toEqual([
      {
        page: PAGE,
        startAt: undefined,
        rangeStart: null,
        rangeEnd: null,
        rangeUnits: null,
        pendingStartVerseKey: null,
      },
    ]);
    expect(st().currentPage).toBe(PAGE);
  });

  it('without a reciter it opens the play options for the page on screen', () => {
    const starts = spyOnStart();
    useMushafPlayerStore.setState({pendingStartVerseKey: '36:1'});
    press('Play');
    expect(starts).toEqual([]);
    expect(mockShowSheet).toHaveBeenCalledWith('mushaf-player-options', {
      payload: {currentPage: PAGE},
    });
    expect(st().pendingStartVerseKey).toBeNull();
  });
});

describe('Next / Previous ayah', () => {
  it('ask the store to skip', () => {
    const nextVerse = jest.fn();
    const previousVerse = jest.fn();
    act(() => {
      useMushafPlayerStore.setState({
        playbackState: 'playing',
        currentSurah: 2,
        numberingMode: 'hafs',
        nextVerse,
        previousVerse,
      });
    });
    press('Next ayah');
    expect(nextVerse).toHaveBeenCalledTimes(1);
    expect(previousVerse).not.toHaveBeenCalled();
    press('Previous ayah');
    expect(previousVerse).toHaveBeenCalledTimes(1);
    expect(nextVerse).toHaveBeenCalledTimes(1);
  });
});
