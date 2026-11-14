// @ai-generated
/**
 * RFC-023 step 1: a saved verse (a bookmark) opens the mushaf screen
 * (app/mushaf.tsx) at once, with its verse and its rewayah but no page,
 * also while the Mushaf data still loads. The screen shows its loading view,
 * restores the rewayah when the data is ready, and then opens the page of
 * the verse. Before, the list looked the page up at the tap: with no data the
 * reader opened at page 1, and a wait for the data held the tap for seconds.
 * The options of the player's Repeat wait for the same point. The page is
 * worked out once: a rewayah switch in the reader later keeps it and the
 * reader's selection. A /quran link opens the same way, with no page.
 * Lives outside app/ because every file there is bundled as a route.
 */
import React, {act} from 'react';
import TestRenderer from 'react-test-renderer';

const mockParams: Record<string, string> = {};
const mockViewer: {props: {pageNumber: number} | null} = {props: null};
const mockDk: {
  initialized: boolean;
  rewayah: string;
  listeners: Set<() => void>;
  finishSwitch: (() => void) | null;
} = {
  initialized: false,
  rewayah: 'hafs',
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
import {savedVerseOpenParams} from '@/services/verse-annotations/openSavedVerse';

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

const HAFS_BOOKMARK = savedVerseOpenParams({
  verseKey: '2:255',
  surahNumber: 2,
  ayahNumber: 255,
  rewayahId: 'hafs',
});
const WARSH_BOOKMARK = savedVerseOpenParams({
  verseKey: '2:255',
  surahNumber: 2,
  ayahNumber: 255,
  rewayahId: 'warsh',
});

it('opens during the load, then shows the page of the verse', async () => {
  open(HAFS_BOOKMARK);
  expect(shownPage()).toBeNull(); // the loading view, at once
  expect(selectedKeys()).toEqual([]);

  await dataReady();
  expect(shownPage()).toBe(42); // not 1, not the surah's start page (2)
  expect(switchRewayah).not.toHaveBeenCalled();
  expect(selectedKeys()).toEqual(['2:255']);
});

it('opens with the data ready: the page of the verse, with no wait', async () => {
  mockDk.initialized = true;
  open(HAFS_BOOKMARK);
  // restoreSavedRewayah returns at once: the rewayah is already Hafs.
  await act(async () => undefined);
  expect(switchRewayah).not.toHaveBeenCalled();
  expect(shownPage()).toBe(42);
});

it('another rewayah: restores it after the load, then shows its page', async () => {
  open(WARSH_BOOKMARK);
  await dataReady();
  // The switch starts only after the first load, and the loading view stays
  // until it ends: no Hafs page under the Warsh bookmark meanwhile.
  expect(switchRewayah).toHaveBeenCalledWith('warsh');
  expect(shownPage()).toBeNull();

  await act(async () => {
    mockDk.finishSwitch?.();
  });
  expect(useMushafSettingsStore.getState().rewayah).toBe('warsh');
  expect(shownPage()).toBe(43);
});

it('another rewayah, not before the load: no switch during it', () => {
  open(WARSH_BOOKMARK);
  expect(switchRewayah).not.toHaveBeenCalled();
  expect(shownPage()).toBeNull();
});

it('a page param still wins', async () => {
  open({...HAFS_BOOKMARK, page: '5'});
  await dataReady();
  expect(shownPage()).toBe(5);
});

it('a surah with no ayah still opens at the surah start page', async () => {
  open({surah: '2'});
  await dataReady();
  expect(shownPage()).toBe(2);
});

it('an unknown rewayah param is ignored', async () => {
  open({...HAFS_BOOKMARK, rewayah: 'not-a-rewayah'});
  await dataReady();
  expect(switchRewayah).not.toHaveBeenCalled();
  expect(shownPage()).toBe(42);
});

// The player's Repeat (VerseActionsSheet) can open this screen before the data
// loads. Its options need the page, so they wait for the page of the verse.
describe('the player options', () => {
  const REPEAT = {surah: '2', ayah: '255', playerOptions: '1'};
  const optionsShown = () =>
    (SheetManager.show as jest.Mock).mock.calls.filter(
      ([name]) => name === 'mushaf-player-options',
    );

  it('wait for the load, then open at the page of the verse', async () => {
    useMushafPlayerStore.setState({currentPage: 7});
    open(REPEAT);
    expect(optionsShown()).toEqual([]);
    expect(useMushafPlayerStore.getState().currentPage).toBe(7);

    await dataReady();
    expect(shownPage()).toBe(42);
    expect(optionsShown()).toEqual([
      ['mushaf-player-options', {payload: {currentPage: 42}}],
    ]);
    expect(useMushafPlayerStore.getState().currentPage).toBe(42);
  });

  it('open at once with the data ready, and only once', async () => {
    mockDk.initialized = true;
    open(REPEAT);
    expect(optionsShown()).toHaveLength(1);

    await act(async () => mockNotify());
    expect(optionsShown()).toHaveLength(1);
  });

  it('do not open with no playerOptions param', async () => {
    open(HAFS_BOOKMARK);
    await dataReady();
    expect(optionsShown()).toEqual([]);
  });
});

describe('the opened page after mount', () => {
  it('a rewayah switch in the reader keeps the selection and the page', async () => {
    open({surah: '2', ayah: '255'});
    await dataReady();
    expect(shownPage()).toBe(42);
    expect(selectedKeys()).toEqual(['2:255']);
    act(() => {
      jest.advanceTimersByTime(3100); // the 3 s flash ends
    });
    expect(selectedKeys()).toEqual([]);
    // The reader picks another verse, then switches rewayah in the reader.
    act(() => {
      useMushafVerseSelectionStore.getState().selectVerse('2:260', 43);
    });
    await act(async () => {
      mockDk.rewayah = 'warsh';
      mockNotify();
    });
    // The flash does not run again: the reader's selection stays.
    expect(selectedKeys()).toEqual(['2:260']);
    // The page was worked out once and kept: it does not follow the verse to
    // its page in the new rewayah (43).
    expect(shownPage()).toBe(42);
  });
});

const initialSurahId = () =>
  (mockViewer.props as {initialSurahId?: number} | null)?.initialSurahId;

// What /quran/{surah}?ayah=N sends: no page, and no wait of its own. The
// reader resolves the page.
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
