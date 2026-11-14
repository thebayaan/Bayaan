// @ai-generated
/**
 * Repro test for PR #491 (RFC-023 step 5), written during code review.
 *
 * Built from a copy of HomeRouteReaderRestore.test.tsx with the same mocks.
 *
 * Finding 5 (review comment): the reader's own load failed view (app/mushaf.tsx)
 * never reports first content. Every other error view in the PR (the QCF font
 * error, the verse units failure in both reading views) does count as content.
 *   F5: the launch restores the reader, then the Mushaf data load fails and
 *   the reader shows its failed view. Expected: the splash is no longer held
 *   (readerRestoreHoldsSplash() is false). On the PR head: it is still true,
 *   so the splash covers a known failure until the 4 s deadline, and Home
 *   stays empty until the 15 s safety limit.
 *
 * Lives outside app/ because every file there is bundled as a route.
 */
import React, {act} from 'react';
import {Text} from 'react-native';
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
  beginReaderRestore,
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

/** The launch up to the push, with the home route under the reader. */
function launchIntoReader(): void {
  beginReaderRestore();
  renderHome();
  expect(shouldPushReader(null)).toBe(true);
  noteReaderPushed();
  renderReader();
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

describe("PR #491 finding 5: the reader's load failed view counts as content", () => {
  function readerTexts(): string[] {
    if (!reader) throw new Error('not rendered');
    return reader.root
      .findAll(node => (node.type as unknown) === Text)
      .map(node => String(node.props.children));
  }

  it("F5: the reader's load-failed view counts as content: the splash goes at once", () => {
    launchIntoReader();
    act(() => {
      mockDk.loadState = 'error';
      for (const listener of mockDk.listeners) listener();
    });
    // Precondition: the reader shows its failed view.
    expect(readerTexts()).toContain("Couldn't load the mushaf");
    // On the PR head: true, the splash is still held over the failed view.
    expect(readerRestoreHoldsSplash()).toBe(false);
  });
});
