// @ai-generated
/**
 * RFC-023 step 5: the home route draws nothing under a reader that the launch
 * restores. It renders 1 s after the reader's first content, on a return to
 * Home, or at the safety limit. The reader can also open before the Mushaf data
 * loads (step 1), so this also holds for a load that fails: the reader shows its
 * failed view, the splash goes at the deadline, and the home route still waits.
 * Lives outside app/ because every file there is bundled as a route.
 */
import React, {act} from 'react';
import {Text, View} from 'react-native';
import TestRenderer from 'react-test-renderer';

const mockSession = {lastScreenWasMushaf: true};
const mockReciters = {renders: 0};
const mockDk = {
  initialized: false,
  loadState: 'loading',
  listeners: new Set<() => void>(),
};

jest.mock('@/components/RecitersView', () => ({
  __esModule: true,
  default: () => {
    mockReciters.renders += 1;
    return null;
  },
}));
jest.mock('@/services/mushaf/MushafSessionStore', () => ({
  mushafSessionStore: {
    getLastScreenWasMushaf: () => mockSession.lastScreenWasMushaf,
    setLastScreenWasMushaf: (value: boolean) => {
      mockSession.lastScreenWasMushaf = value;
    },
  },
}));
jest.mock('expo-router', () => ({
  Stack: {Toolbar: () => null},
  useLocalSearchParams: () => ({page: '42'}),
  useRouter: () => ({push: jest.fn()}),
  useNavigation: () => ({setOptions: jest.fn()}),
}));

// What the reader screen needs (MushafScreenLoadError.test.tsx has the same).
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
    get initialized() {
      return mockDk.initialized;
    },
    rewayah: 'hafs',
    getSurahStartPages: () => ({}),
    getPageForVerse: () => undefined,
    getRewayahLoadState: () => mockDk.loadState,
    ensureRewayahLoaded: () => Promise.resolve(),
    switchRewayah: () => Promise.resolve(),
    subscribeCacheChanges: (listener: () => void) => {
      mockDk.listeners.add(listener);
      return () => {
        mockDk.listeners.delete(listener);
      };
    },
    getCacheVersion: () => 0,
  },
}));
jest.mock('@/services/mushaf/MushafPreloadService', () => ({
  mushafPreloadService: {
    state: 'loading',
    subscribe: () => () => undefined,
    initialize: () => Promise.resolve(),
    startIfIdle: () => undefined,
  },
}));
jest.mock('react-native-actions-sheet', () => ({
  SheetManager: {show: jest.fn()},
}));
jest.mock('@/utils/toastUtils', () => ({showToast: jest.fn()}));
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

import HomeScreen from '@/app/(tabs)/(a.home)/index';
import MushafScreen from '@/app/mushaf';
import {
  HOME_AFTER_SHOWN_MS,
  RESTORE_SAFETY_LIMIT_MS,
  SPLASH_DEADLINE_MS,
  beginReaderRestore,
  noteReaderFirstContent,
  noteReaderPushed,
  readerRestoreHoldsSplash,
  shouldPushReader,
} from '@/services/mushaf/readerRestoreState';

declare const global: {IS_REACT_ACT_ENVIRONMENT?: boolean};
global.IS_REACT_ACT_ENVIRONMENT = true;

let home: TestRenderer.ReactTestRenderer | null = null;
let reader: TestRenderer.ReactTestRenderer | null = null;
let errorSpy: jest.SpyInstance;

function renderHome(): void {
  act(() => {
    home = TestRenderer.create(<HomeScreen />);
  });
}

function renderReader(): void {
  act(() => {
    reader = TestRenderer.create(<MushafScreen />);
  });
}

function homeIsEmpty(): boolean {
  if (!home) throw new Error('not rendered');
  const views = home.root.findAll(node => (node.type as unknown) === View);
  return views.length === 1 && views[0].props.children === undefined;
}

function homeRendered(): boolean {
  return mockReciters.renders > 0;
}

/** The launch up to the push, with the home route under the reader. */
function launchIntoReader(): void {
  beginReaderRestore();
  renderHome();
  expect(shouldPushReader(null)).toBe(true);
  noteReaderPushed();
  renderReader();
}

function advance(ms: number): void {
  act(() => {
    jest.advanceTimersByTime(ms);
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  mockSession.lastScreenWasMushaf = true;
  mockReciters.renders = 0;
  mockDk.initialized = false;
  mockDk.loadState = 'loading';
  mockDk.listeners.clear();
  // react-test-renderer prints a deprecation notice under React 19.
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  act(() => {
    reader?.unmount();
    home?.unmount();
  });
  reader = null;
  home = null;
  jest.clearAllTimers();
  jest.useRealTimers();
  errorSpy.mockRestore();
});

it('renders at once on a launch with no restore', () => {
  mockSession.lastScreenWasMushaf = false;
  beginReaderRestore();
  renderHome();
  expect(homeRendered()).toBe(true);
});

it('renders at once on a launch from a deep link', () => {
  beginReaderRestore();
  renderHome();
  expect(homeIsEmpty()).toBe(true);

  act(() => {
    shouldPushReader('bayaan://quran/2/255');
  });
  expect(homeRendered()).toBe(true);
});

it('stays empty during the push and until the first content', () => {
  beginReaderRestore();
  renderHome();
  expect(homeIsEmpty()).toBe(true);

  act(() => noteReaderPushed());
  expect(homeIsEmpty()).toBe(true);
  expect(homeRendered()).toBe(false);
});

it('renders 1 s after the first content', () => {
  launchIntoReader();
  act(() => noteReaderFirstContent());
  expect(homeIsEmpty()).toBe(true);

  advance(HOME_AFTER_SHOWN_MS - 1);
  expect(homeRendered()).toBe(false);
  advance(1);
  expect(homeRendered()).toBe(true);
});

it('renders at once on a return to Home, also before the first content', () => {
  launchIntoReader();
  expect(homeRendered()).toBe(false);

  act(() => reader?.unmount());
  reader = null;
  expect(homeRendered()).toBe(true);
});

it('renders at once on a return to Home after the first content', () => {
  launchIntoReader();
  act(() => noteReaderFirstContent());

  act(() => reader?.unmount());
  reader = null;
  expect(homeRendered()).toBe(true);
});

it('renders at the safety limit for a reader that never reports', () => {
  launchIntoReader();
  advance(RESTORE_SAFETY_LIMIT_MS - 1);
  expect(homeRendered()).toBe(false);
  advance(1);
  expect(homeRendered()).toBe(true);
});

describe('a reader that opens before the data', () => {
  function readerTexts(): string[] {
    if (!reader) throw new Error('not rendered');
    return reader.root
      .findAll(node => (node.type as unknown) === Text)
      .map(node => String(node.props.children));
  }

  it('frees the splash at the deadline while the load runs; Home waits', () => {
    launchIntoReader();
    expect(readerRestoreHoldsSplash()).toBe(true);

    advance(SPLASH_DEADLINE_MS);
    expect(readerRestoreHoldsSplash()).toBe(false);
    expect(homeRendered()).toBe(false);
  });

  it('never waits for content after a failed load: the deadline frees the splash', () => {
    launchIntoReader();
    act(() => {
      mockDk.loadState = 'error';
      for (const listener of mockDk.listeners) listener();
    });
    expect(readerTexts()).toContain("Couldn't load the mushaf");

    advance(SPLASH_DEADLINE_MS);
    expect(readerRestoreHoldsSplash()).toBe(false);
    expect(homeRendered()).toBe(false);

    advance(RESTORE_SAFETY_LIMIT_MS - SPLASH_DEADLINE_MS);
    expect(homeRendered()).toBe(true);
  });
});
