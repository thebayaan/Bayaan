// @ai-generated
/**
 * The mushaf player bar (components/mushaf/MushafPlayerBar.tsx, the
 * non-glass counterpart of the iOS 26 toolbar) shows refusals inline, above
 * controls that stay, with the one thing to do about them.
 */

import {Text} from 'react-native';
import {useNetworkStore} from '@/store/networkStore';
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
  TIMESTAMPS_UNAVAILABLE_ERROR,
  TIMINGS_LOAD_FAILED_ERROR,
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

function textNodes(): TestRenderer.ReactTestInstance[] {
  return renderer!.root.findAll(node => node.type === Text);
}

function texts(): string[] {
  return textNodes().map(node => [node.props.children].flat().join(''));
}

function labels(): string[] {
  return renderer!.root
    .findAll(node => typeof node.props.accessibilityLabel === 'string')
    .map(node => node.props.accessibilityLabel as string);
}

it('a refusal shows above the controls, which stay, in two lines', () => {
  setPlayer({
    timestampError: TIMESTAMPS_UNAVAILABLE_ERROR,
    timestampErrorSurah: 2,
  });
  expect(texts()).toContain(
    "This reciter doesn't follow along in Al-Baqarah. Choose another reciter.",
  );
  const message = textNodes().find(node =>
    String(node.props.children).includes('follow along'),
  );
  expect(message?.props.numberOfLines).toBe(2);
  expect(labels()).toEqual(
    expect.arrayContaining(['Change reciter', 'Search', 'Play']),
  );
  expect(mockShowToast).not.toHaveBeenCalled();
});

it('a connection problem offers Try again and retries', () => {
  const retry = jest.fn();
  useMushafPlayerStore.setState({retryPlayback: retry});
  setPlayer({timestampError: TIMINGS_LOAD_FAILED_ERROR});
  expect(texts()).toContain(
    "Verse timings couldn't load. Check your connection.",
  );
  const button = renderer!.root.find(
    node =>
      node.props.accessibilityLabel === 'Try again' && !!node.props.onPress,
  );
  act(() => button.props.onPress());
  expect(retry).toHaveBeenCalledTimes(1);
});

it('a returning connection retries a connection refusal only', () => {
  const retry = jest.fn();
  useMushafPlayerStore.setState({retryPlayback: retry});
  setPlayer({timestampError: TIMINGS_LOAD_FAILED_ERROR});
  act(() => useNetworkStore.setState({isOnline: false}));
  act(() => useNetworkStore.setState({isOnline: true}));
  expect(retry).toHaveBeenCalledTimes(1);

  retry.mockClear();
  setPlayer({timestampError: TIMESTAMPS_UNAVAILABLE_ERROR});
  act(() => useNetworkStore.setState({isOnline: false}));
  act(() => useNetworkStore.setState({isOnline: true}));
  expect(retry).not.toHaveBeenCalled();
});
