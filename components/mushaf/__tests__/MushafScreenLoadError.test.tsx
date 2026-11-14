// @ai-generated
/**
 * The mushaf screen (app/mushaf.tsx) when the mushaf text cannot be loaded
 * at all (the DigitalKhatt data service never initialized, e.g. no storage
 * left to copy its DB to the device): it says so and offers a retry instead
 * of an endless spinner. On a launch that restores the reader (RFC-023 step
 * 5), that view is the reader's first content, so the splash does not cover
 * it. Lives outside app/ because every file there is bundled as a route.
 */
import React, {act, useReducer} from 'react';
import {ActivityIndicator, Text} from 'react-native';
import TestRenderer from 'react-test-renderer';

const mockPreload = {
  state: 'failed' as string,
  listeners: new Set<() => void>(),
  initialize: jest.fn(() => Promise.resolve()),
  startIfIdle: jest.fn(),
};

// Recitation follow-along pulls in native audio and ONNX modules.
jest.mock('@/services/recitation/RecitationTrackingService', () => ({
  stopRecitationTracking: jest.fn(),
}));
jest.mock('@/components/mushaf/RecitationMicButton', () => ({
  RecitationMicButton: () => null,
  useRecitationFollowAlong: jest.fn(),
  useRecitationStatusText: () => null,
  useRecitationMic: () => ({
    enabled: false,
    status: 'off',
    progress: 0,
    busy: false,
    toggle: jest.fn(),
  }),
}));
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

const mockDk = {initialized: false};

jest.mock('@/services/mushaf/DigitalKhattDataService', () => ({
  digitalKhattDataService: {
    get initialized() {
      return mockDk.initialized;
    },
    rewayah: 'hafs',
    getSurahStartPages: () => ({}),
    switchRewayah: jest.fn(() => Promise.resolve()),
    subscribeCacheChanges: () => () => undefined,
  },
}));

jest.mock('@/services/mushaf/MushafPreloadService', () => ({
  mushafPreloadService: {
    get initialized() {
      return mockPreload.state === 'ready' || mockPreload.state === 'failed';
    },
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
    startIfIdle: () => mockPreload.startIfIdle(),
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
import {
  ReaderRestoreContext,
  holdsSplash,
  readerRestoreReducer,
  type ReaderRestorePhase,
} from '@/services/mushaf/readerRestoreState';

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

// The restore of the root layout, after its push of the reader.
let restorePhase: ReaderRestorePhase = 'none';
function RestoredReader() {
  const [phase, dispatch] = useReducer(readerRestoreReducer, 'waiting');
  restorePhase = phase;
  return (
    <ReaderRestoreContext.Provider value={dispatch}>
      <MushafScreen />
    </ReaderRestoreContext.Provider>
  );
}

function renderRestored(): void {
  act(() => {
    renderer = TestRenderer.create(<RestoredReader />);
  });
}

function readerRestoreHoldsSplash(): boolean {
  return holdsSplash(restorePhase);
}

beforeEach(() => {
  mockPreload.state = 'failed';
  mockPreload.listeners.clear();
  mockPreload.initialize.mockClear();
  mockPreload.startIfIdle.mockClear();
  mockDk.initialized = false;
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

// The data loaded and only the fonts failed: the pages would stay blank.
it('fonts that fail: the error, and the retry runs the preload again', async () => {
  mockDk.initialized = true;
  render();
  expect(texts()[0]).toBe("Couldn't load the mushaf");
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

it('starts the load when the screen opens first', () => {
  mockPreload.state = 'idle';
  render();
  expect(mockPreload.startIfIdle).toHaveBeenCalledTimes(1);
  expect(ofType(ActivityIndicator)).toHaveLength(1);
});

describe('a launch that restores the reader', () => {
  it('holds the splash over the spinner', () => {
    mockPreload.state = 'loading';
    renderRestored();
    expect(ofType(ActivityIndicator)).toHaveLength(1);
    expect(readerRestoreHoldsSplash()).toBe(true);
  });

  // From the review of the step 5 PR: the failed view never reported, so the
  // splash covered a known failure until the deadline.
  it("F5: the reader's load-failed view counts as content: the splash goes at once", () => {
    mockPreload.state = 'loading';
    renderRestored();
    act(() => {
      mockPreload.state = 'failed';
      mockPreload.listeners.forEach(listener => listener());
    });
    // Precondition: the reader shows its failed view.
    expect(texts()).toContain("Couldn't load the mushaf");
    expect(readerRestoreHoldsSplash()).toBe(false);
  });

  it('ends the wait when the reader closes', () => {
    mockPreload.state = 'loading';
    const report = jest.fn();
    act(() => {
      renderer = TestRenderer.create(
        <ReaderRestoreContext.Provider value={report}>
          <MushafScreen />
        </ReaderRestoreContext.Provider>,
      );
    });
    expect(report).not.toHaveBeenCalled();
    act(() => renderer?.unmount());
    renderer = null;
    expect(report).toHaveBeenCalledWith('closed');
  });
});
