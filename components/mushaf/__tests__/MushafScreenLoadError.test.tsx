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
let mockParams: Record<string, string> = {};
const mockRoute = {params: {}}; // @ai
jest.mock('expo-router', () => {
  const Toolbar = Object.assign(() => null, {
    Button: () => null,
    Spacer: () => null,
  });
  return {
    Stack: {Toolbar},
    useLocalSearchParams: () => mockParams,
    useRoute: () => mockRoute, // @ai a stable route: no link comes
  };
});

jest.mock('expo-screen-orientation', () => ({
  unlockAsync: jest.fn(),
  lockAsync: jest.fn(),
  OrientationLock: {PORTRAIT_UP: 1},
}));

jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({theme: {colors: {background: '#fff', text: '#111'}}}),
}));

let mockGlass = false;
jest.mock('@/hooks/useGlassProps', () => ({
  useGlassTint: () => undefined,
  get USE_GLASS() {
    return mockGlass;
  },
}));

// The reader: it keeps the page it shows in its own state, as the real one
// does, and counts its mounts.
const mockViewer = {mounts: 0, turnTo: (_page: number): void => undefined};
jest.mock('@/components/mushaf/main', () => {
  const ReactMock = jest.requireActual<typeof React>('react');
  const {Text: TextMock} = jest.requireActual('react-native');
  function MockViewer({pageNumber}: {pageNumber: number}) {
    const [page, setPage] = ReactMock.useState(pageNumber);
    ReactMock.useEffect(() => {
      mockViewer.mounts += 1;
      mockViewer.turnTo = setPage;
    }, []);
    return <TextMock>{`page ${page}`}</TextMock>;
  }
  return {__esModule: true, default: MockViewer};
});

const mockDk = {
  initialized: false,
  loadState: 'loading',
  ensureRewayahLoaded: jest.fn(() => Promise.resolve()),
  listeners: new Set<() => void>(),
};

jest.mock('@/services/mushaf/DigitalKhattDataService', () => ({
  digitalKhattDataService: {
    get initialized() {
      return mockDk.initialized;
    },
    rewayah: 'hafs',
    getSurahStartPages: () => ({}),
    getPageForVerse: (key: string) => (key === '2:255' ? 42 : undefined),
    getRewayahLoadState: () => mockDk.loadState,
    ensureRewayahLoaded: (...args: unknown[]) =>
      mockDk.ensureRewayahLoaded(...(args as [])),
    switchRewayah: jest.fn(() => Promise.resolve()),
    subscribeCacheChanges: (listener: () => void) => {
      mockDk.listeners.add(listener);
      return () => {
        mockDk.listeners.delete(listener);
      };
    },
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

const mockShowSheet = jest.fn();
jest.mock('react-native-actions-sheet', () => ({
  SheetManager: {show: (...args: unknown[]) => mockShowSheet(...args)},
}));
const mockSelectVerse = jest.fn();
jest.mock('@/store/mushafVerseSelectionStore', () => ({
  // The reader's verse flash ends through flashedSelectionClearer.
  SELECTION_FLASH_MS: 3000,
  flashedSelectionClearer: () => () => undefined,
  useMushafVerseSelectionStore: {
    getState: () => ({
      selectVerse: mockSelectVerse,
      selectUnits: jest.fn(),
      clearSelection: jest.fn(),
    }),
  },
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
  whenShownVerseUnitsResolved: () => Promise.resolve(),
}));

import MushafScreen, {MushafToolbar} from '@/app/mushaf';
import {
  ReaderRestoreContext,
  holdsSplash,
  readerRestoreReducer,
  type ReaderRestorePhase,
} from '@/hooks/readerRestoreState';

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
  mockDk.loadState = 'loading';
  mockDk.ensureRewayahLoaded.mockClear();
  mockDk.listeners.clear();
  mockParams = {};
  mockGlass = false;
  mockViewer.mounts = 0;
  mockShowSheet.mockClear();
  mockSelectVerse.mockClear();
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

// One data state, with one retry that knows which load to redo. A failed read
// of the active rewayah drops its data after the preload finished: the preload
// stays 'ready', and its initialize() would do nothing.
it('the rewayah failed after the preload: the retry goes to the data', async () => {
  mockPreload.state = 'ready';
  mockDk.initialized = true;
  render();
  expect(texts()).not.toContain("Couldn't load the mushaf");

  act(() => {
    mockDk.initialized = false;
    mockDk.loadState = 'error';
    mockDk.listeners.forEach(listener => listener());
  });
  expect(texts()).toContain("Couldn't load the mushaf");

  const retry = root().find(
    node => node.props.accessibilityRole === 'button' && !!node.props.onPress,
  );
  await act(async () => {
    retry.props.onPress();
  });
  expect(mockDk.ensureRewayahLoaded).toHaveBeenCalledWith('hafs', {
    retry: true,
  });
  expect(mockPreload.initialize).not.toHaveBeenCalled();
});

it('starts the load when the screen opens first', () => {
  mockPreload.state = 'idle';
  render();
  expect(mockPreload.startIfIdle).toHaveBeenCalledTimes(1);
  expect(ofType(ActivityIndicator)).toHaveLength(1);
});

// A failed chunk read mid-session drops the data of the rewayah on screen.
// The reader stays mounted under the error, so the retry brings the pages
// back where the user is: no second open at the verse the screen opened on.
it('a failure while reading: the retry keeps the page, no second open', async () => {
  mockPreload.state = 'ready';
  mockDk.initialized = true;
  mockGlass = true; // the iOS toolbar, which the error cannot cover
  mockParams = {surah: '2', ayah: '255', playerOptions: '1'};
  const toolbars = () => ofType(MushafToolbar).length;
  const hiddenFromScreenReaders = () =>
    root().findAll(
      node => node.props.importantForAccessibility === 'no-hide-descendants',
    ).length > 0;
  render();
  expect(texts()).toEqual(['page 42']);
  expect(toolbars()).toBe(1);
  expect(mockSelectVerse).toHaveBeenCalledTimes(1);
  expect(mockShowSheet).toHaveBeenCalledTimes(1);
  act(() => mockViewer.turnTo(300));

  act(() => {
    mockDk.initialized = false;
    mockDk.loadState = 'error';
    mockDk.listeners.forEach(listener => listener());
  });
  expect(texts()).toContain("Couldn't load the mushaf");
  expect(toolbars()).toBe(0);
  expect(hiddenFromScreenReaders()).toBe(true);

  let commit!: () => void;
  mockDk.ensureRewayahLoaded.mockImplementationOnce(
    () =>
      new Promise<void>(resolve => {
        commit = () => {
          mockDk.initialized = true;
          mockDk.loadState = 'ready';
          mockDk.listeners.forEach(listener => listener());
          resolve();
        };
      }),
  );
  const retry = root().find(
    node => node.props.accessibilityRole === 'button' && !!node.props.onPress,
  );
  act(() => retry.props.onPress());
  expect(ofType(ActivityIndicator)).toHaveLength(1);
  await act(async () => commit());

  expect({
    texts: texts(),
    toolbars: toolbars(),
    hidden: hiddenFromScreenReaders(),
    spinners: ofType(ActivityIndicator).length,
    readerMounts: mockViewer.mounts,
    flashes: mockSelectVerse.mock.calls.length,
    playerOptions: mockShowSheet.mock.calls.length,
  }).toEqual({
    texts: ['page 300'],
    toolbars: 1,
    hidden: false,
    spinners: 0,
    readerMounts: 1,
    flashes: 1,
    playerOptions: 1,
  });
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

  // From the review of the merge with the in-place error: a chunk read that
  // fails with the reader mounted shows the failed view over it, while the
  // open state stays 'ready'. That view reports too: the splash goes at once,
  // not at the deadline.
  it('a read that fails over the mounted reader: the error shows and the splash goes', () => {
    mockPreload.state = 'ready';
    mockDk.initialized = true;
    renderRestored();
    // The reader is mounted; its page has not reported content yet.
    expect(mockViewer.mounts).toBe(1);
    expect(readerRestoreHoldsSplash()).toBe(true);

    act(() => {
      mockDk.initialized = false;
      mockDk.loadState = 'error';
      mockDk.listeners.forEach(listener => listener());
    });
    expect(texts()).toContain("Couldn't load the mushaf");
    expect(mockViewer.mounts).toBe(1);
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
