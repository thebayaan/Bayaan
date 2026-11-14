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
 *    reciter reaching the next verse (verse repeat used to undo the skip);
 *  - an error that playing again may clear is a notice and leaves Play in
 *    the bar; one that needs another reciter replaces the bar with a row.
 */

import React, {act} from 'react';
import TestRenderer from 'react-test-renderer';

const mockShowToast = jest.fn();
jest.mock('@/utils/toastUtils', () => ({
  showToast: (...args: unknown[]) => mockShowToast(...args),
}));
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
  AUDIO_LOAD_FAILED_ERROR,
  TIMESTAMPS_LOAD_FAILED_ERROR,
  TIMESTAMPS_UNAVAILABLE_ERROR,
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

const labels = (): string[] =>
  renderer!.root
    .findAll(n => typeof n.props.accessibilityLabel === 'string')
    .map(n => n.props.accessibilityLabel as string);

beforeEach(() => {
  mockShowSheet.mockClear();
  mockShowToast.mockClear();
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

describe('errors', () => {
  it.each([
    [
      'the timings could not be fetched',
      TIMESTAMPS_LOAD_FAILED_ERROR,
      "Couldn't load the verse timings. Check your internet connection and try again.",
    ],
    [
      'the audio could not be played',
      AUDIO_LOAD_FAILED_ERROR,
      "Couldn't play the audio for this surah. Check your internet connection and try again.",
    ],
  ])('%s: a notice, and Play stays in the bar', (_name, error, message) => {
    act(() => {
      useMushafPlayerStore.setState({
        rewayatId: 'hafs-clean',
        playbackState: 'idle',
        timestampError: error,
      });
    });
    expect(mockShowToast).toHaveBeenCalledTimes(1);
    expect(mockShowToast).toHaveBeenCalledWith(
      'Playback unavailable',
      message,
      'error',
    );
    expect(labels()).toContain('Play');
    expect(labels()).not.toContain('Change reciter');
    // and Play tries again
    const starts = spyOnStart();
    press('Play');
    expect(starts.map(s => s.page)).toEqual([PAGE]);
  });

  it('the reciter has no timings for the surah: the row offering another reciter', () => {
    act(() => {
      useMushafPlayerStore.setState({
        rewayatId: 'hafs-clean',
        playbackState: 'idle',
        timestampError: TIMESTAMPS_UNAVAILABLE_ERROR,
      });
    });
    expect(mockShowToast).not.toHaveBeenCalled();
    expect(labels()).toContain('Change reciter');
    expect(labels()).not.toContain('Play');
  });
});
