// @ai-generated
/**
 * The mushaf screen (app/mushaf.tsx) when the mushaf text cannot be loaded
 * at all (the DigitalKhatt data service never initialized, e.g. no storage
 * left to copy its DB to the device): it says so and offers a retry instead
 * of an endless spinner. Lives outside app/ because every file there is
 * bundled as a route.
 */
import React, {act} from 'react';
import {ActivityIndicator, Text} from 'react-native';
import TestRenderer from 'react-test-renderer';

const mockPreload = {
  state: 'failed' as string,
  listeners: new Set<() => void>(),
  initialize: jest.fn(() => Promise.resolve()),
};

jest.mock('expo-router', () => ({
  Stack: {Toolbar: () => null},
  useLocalSearchParams: () => ({}),
}));

jest.mock('expo-screen-orientation', () => ({
  unlockAsync: jest.fn(),
  lockAsync: jest.fn(),
  OrientationLock: {PORTRAIT_UP: 1},
}));

jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({theme: {colors: {background: '#fff', text: '#111'}}}),
}));

jest.mock('@/hooks/useGlassProps', () => ({USE_GLASS: false}));

jest.mock('@/components/mushaf/main', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@/services/mushaf/DigitalKhattDataService', () => ({
  digitalKhattDataService: {
    initialized: false,
    rewayah: 'hafs',
    getSurahStartPages: () => ({}),
    switchRewayah: jest.fn(() => Promise.resolve()),
  },
}));

jest.mock('@/services/mushaf/MushafPreloadService', () => ({
  mushafPreloadService: {
    get state() {
      return mockPreload.state;
    },
    subscribe: (listener: () => void) => {
      mockPreload.listeners.add(listener);
      return () => {
        mockPreload.listeners.delete(listener);
      };
    },
    initialize: () => mockPreload.initialize(),
  },
}));

jest.mock('@/services/mushaf/MushafSessionStore', () => ({
  mushafSessionStore: {setLastScreenWasMushaf: jest.fn()},
}));

jest.mock('react-native-actions-sheet', () => ({
  SheetManager: {show: jest.fn()},
}));

jest.mock('@/utils/toastUtils', () => ({showToast: jest.fn()}));

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

import MushafScreen from '@/app/mushaf';

declare const global: {IS_REACT_ACT_ENVIRONMENT?: boolean};
global.IS_REACT_ACT_ENVIRONMENT = true;

let renderer: TestRenderer.ReactTestRenderer | null = null;
let errorSpy: jest.SpyInstance;

function root(): TestRenderer.ReactTestInstance {
  if (!renderer) throw new Error('not rendered');
  return renderer.root;
}

// Compared by identity: react-test-renderer's own React types do not
// accept React Native component classes in findAllByType.
function ofType(type: unknown): TestRenderer.ReactTestInstance[] {
  return root().findAll(node => node.type === type);
}

function texts(): string[] {
  return ofType(Text).map(node => [node.props.children].flat().join(''));
}

function render(): void {
  act(() => {
    renderer = TestRenderer.create(<MushafScreen />);
  });
}

beforeEach(() => {
  mockPreload.state = 'failed';
  mockPreload.listeners.clear();
  mockPreload.initialize.mockClear();
  // react-test-renderer prints a deprecation notice under React 19.
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
  errorSpy.mockRestore();
});

it('says the mushaf could not be loaded and retries the preload', async () => {
  render();
  expect(texts()).toEqual([
    "Couldn't load the mushaf",
    'Check that your device has some free storage, then try again.',
    'Try again',
  ]);
  expect(ofType(ActivityIndicator)).toHaveLength(0);

  const retry = root().find(
    node => node.props.accessibilityRole === 'button' && !!node.props.onPress,
  );
  await act(async () => {
    retry.props.onPress();
  });
  expect(mockPreload.initialize).toHaveBeenCalledTimes(1);
});

it('keeps the spinner while the mushaf is still loading', () => {
  mockPreload.state = 'loading';
  render();
  expect(texts()).toEqual([]);
  expect(ofType(ActivityIndicator)).toHaveLength(1);
});

it('shows the error once a load in progress fails', () => {
  mockPreload.state = 'loading';
  render();
  act(() => {
    mockPreload.state = 'failed';
    mockPreload.listeners.forEach(listener => listener());
  });
  expect(texts()[0]).toBe("Couldn't load the mushaf");
});
