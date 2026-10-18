// @ai-generated
/**
 * The mushaf player bar (components/mushaf/MushafPlayerBar.tsx, the
 * non-glass counterpart of the iOS 26 toolbar) shows refusals and "Verse
 * tracking unavailable" inline. When a surah without verse tracking was
 * asked to start at a later verse, it plays from its beginning, and the bar
 * must say so too (the toolbar does it through getPlaybackNotice).
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
jest.mock('react-native-actions-sheet', () => ({
  SheetManager: {show: jest.fn()},
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

import {MushafPlayerBar} from '@/components/mushaf/MushafPlayerBar';
import {
  useMushafPlayerStore,
  VERSE_TIMING_UNAVAILABLE_ERROR,
} from '../mushafPlayerStore';

declare const global: {IS_REACT_ACT_ENVIRONMENT?: boolean};
global.IS_REACT_ACT_ENVIRONMENT = true;

let renderer: TestRenderer.ReactTestRenderer | null = null;

function setPlayer(state: object) {
  act(() => {
    useMushafPlayerStore.setState(state);
  });
}

beforeEach(() => {
  mockShowToast.mockClear();
  useMushafPlayerStore.setState({
    playbackState: 'idle',
    currentSurah: 0,
    currentVerseKey: null,
    currentVerseKeys: [],
    currentVerseLabel: null,
    numberingMode: null,
    ignoredStartVerseKey: null,
    timestampError: null,
  });
  act(() => {
    renderer = TestRenderer.create(<MushafPlayerBar currentPage={562} />);
  });
});

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
});

it('a skipped start verse: says the surah plays from the beginning, once', () => {
  setPlayer({
    playbackState: 'loading',
    currentSurah: 67,
    numberingMode: 'disabled',
    ignoredStartVerseKey: '67:5',
  });
  setPlayer({playbackState: 'playing'});
  expect(mockShowToast).toHaveBeenCalledTimes(1);
  expect(mockShowToast).toHaveBeenCalledWith(
    'Verse tracking unavailable',
    'Al-Mulk plays from the beginning without verse tracking for this reciter.',
    'none',
  );
});

it('what the bar shows inline is not repeated as a notice', () => {
  setPlayer({
    playbackState: 'loading',
    currentSurah: 67,
    numberingMode: 'disabled',
  });
  setPlayer({playbackState: 'playing'});
  setPlayer({
    playbackState: 'idle',
    timestampError: VERSE_TIMING_UNAVAILABLE_ERROR,
  });
  expect(mockShowToast).not.toHaveBeenCalled();
});

it('Hafs playback shows nothing new', () => {
  setPlayer({
    playbackState: 'loading',
    currentSurah: 2,
    numberingMode: 'hafs',
  });
  setPlayer({
    playbackState: 'playing',
    currentVerseKey: '2:5',
    currentVerseKeys: ['2:5'],
    currentVerseLabel: '2:5',
  });
  expect(mockShowToast).not.toHaveBeenCalled();
});
