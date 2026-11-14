// @ai-generated
/**
 * Supporting test for review finding 3 on PR #487. This one is meant to
 * PASS on the PR head: it is the evidence for the suggestion, not a bug.
 *
 * What it shows: if app/quran/[surah].tsx redirected at once to /mushaf
 * with {surah, ayah} and no page, the reader alone already gives the four
 * results that utils/__tests__/quranLink.test.ts pins on resolveQuranLink
 * (loading view on a cold start, the ayah's page once the data is ready,
 * the surah start for an unknown ayah, the surah start for a surah-only
 * link). So the route's own wait, resolveQuranLink and its test can go.
 *
 * Expected and actual on the PR head: all three tests pass.
 *
 * The harness (mocks, open(), dataReady(), shownPage()) is copied from
 * MushafScreenSavedVerseOpen.test.tsx in this PR.
 */
import React, {act} from 'react';
import TestRenderer from 'react-test-renderer';

const mockParams: Record<string, string> = {};
const mockViewer: {props: {pageNumber: number} | null} = {props: null};
const mockDk: {
  initialized: boolean;
  rewayah: string;
  version: number;
  listeners: Set<() => void>;
  finishSwitch: (() => void) | null;
} = {
  initialized: false,
  rewayah: 'hafs',
  version: 0,
  listeners: new Set(),
  finishSwitch: null,
};
// The page of Hafs 2:255 differs by rewayah, and both differ from the start
// page of Al-Baqarah (2).
const mockVersePages: Record<string, Record<string, number>> = {
  hafs: {'2:255': 42},
  warsh: {'2:255': 43},
};

function mockNotify(): void {
  mockDk.version += 1;
  for (const listener of [...mockDk.listeners]) listener();
}

jest.mock('expo-router', () => ({
  Stack: {Toolbar: () => null},
  useLocalSearchParams: () => mockParams,
  useRoute: () => ({params: mockParams}),
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
  default: (props: {pageNumber: number}) => {
    mockViewer.props = props;
    return null;
  },
}));

jest.mock('@/services/mushaf/DigitalKhattDataService', () => ({
  digitalKhattDataService: {
    get initialized() {
      return mockDk.initialized;
    },
    get rewayah() {
      return mockDk.rewayah;
    },
    getRewayahLoadState: () => 'loading',
    getSurahStartPages: () => ({1: 1, 2: 2}),
    getPageForVerse: (key: string) => mockVersePages[mockDk.rewayah]?.[key],
    switchRewayah: jest.fn(
      (next: string) =>
        new Promise<void>(resolve => {
          mockDk.finishSwitch = () => {
            mockDk.rewayah = next;
            mockNotify();
            resolve();
          };
        }),
    ),
    subscribeCacheChanges: (listener: () => void) => {
      mockDk.listeners.add(listener);
      return () => mockDk.listeners.delete(listener);
    },
    getCacheVersion: () => mockDk.version,
  },
}));

jest.mock('@/services/mushaf/MushafPreloadService', () => ({
  mushafPreloadService: {
    // The preload ends with the data load: the reader waits for both.
    get initialized() {
      return mockDk.initialized;
    },
    get state() {
      return mockDk.initialized ? 'ready' : 'loading';
    },
    subscribe: () => () => undefined,
    initialize: () => Promise.resolve(),
    startIfIdle: jest.fn(),
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
  mushafVerseMapService: {
    getOrderedVerseKeysForPage: () => [],
    isShownVerseUnitsPending: () => false,
  },
  selectionForAnchor: () => null,
  whenShownVerseUnitsResolved: () => Promise.resolve(null),
}));

import MushafScreen from '@/app/mushaf';
import {digitalKhattDataService} from '@/services/mushaf/DigitalKhattDataService';
import {SheetManager} from 'react-native-actions-sheet';
import {useMushafPlayerStore} from '@/store/mushafPlayerStore';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import {useMushafVerseSelectionStore} from '@/store/mushafVerseSelectionStore';

declare const global: {IS_REACT_ACT_ENVIRONMENT?: boolean};
global.IS_REACT_ACT_ENVIRONMENT = true;

let renderer: TestRenderer.ReactTestRenderer | null = null;
let errorSpy: jest.SpyInstance;

function open(params: Record<string, string>): void {
  Object.assign(mockParams, params);
  act(() => {
    renderer = TestRenderer.create(<MushafScreen />);
  });
}

/** The Mushaf data load ends (the main cache commits). */
async function dataReady(): Promise<void> {
  await act(async () => {
    mockDk.initialized = true;
    mockNotify();
  });
}

const shownPage = () => mockViewer.props?.pageNumber ?? null;
const selectedKeys = () =>
  useMushafVerseSelectionStore.getState().selectedVerseKeys;
const switchRewayah = digitalKhattDataService.switchRewayah as jest.Mock;

beforeEach(() => {
  jest.useFakeTimers();
  for (const key of Object.keys(mockParams)) delete mockParams[key];
  mockViewer.props = null;
  mockDk.initialized = false;
  mockDk.rewayah = 'hafs';
  mockDk.finishSwitch = null;
  mockDk.listeners.clear();
  switchRewayah.mockClear();
  (SheetManager.show as jest.Mock).mockClear();
  useMushafPlayerStore.setState({currentPage: 1});
  useMushafSettingsStore.setState({rewayah: 'hafs', mushafRenderer: 'dk_v2'});
  useMushafVerseSelectionStore.getState().clearSelection();
  // react-test-renderer prints a deprecation notice under React 19.
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
  errorSpy.mockRestore();
  jest.useRealTimers();
});

const initialSurahId = () =>
  (mockViewer.props as {initialSurahId?: number} | null)?.initialSurahId;

// What /quran/{surah}?ayah=N would send if it redirected at once, with no
// page and no wait of its own: the reader alone resolves the same page that
// resolveQuranLink waits for today.
describe('/quran link handed straight to the reader', () => {
  it('cold start: the ayah page once the data is ready', async () => {
    open({surah: '2', ayah: '255'});
    expect(shownPage()).toBeNull(); // loading view
    await dataReady();
    expect(shownPage()).toBe(42);
    expect(initialSurahId()).toBe(2);
  });
  it('an ayah with no page falls back to the surah start', async () => {
    open({surah: '2', ayah: '999'});
    await dataReady();
    expect(shownPage()).toBe(2);
  });
  it('a surah-only link opens the surah start', async () => {
    open({surah: '2'});
    await dataReady();
    expect(shownPage()).toBe(2);
  });
});
