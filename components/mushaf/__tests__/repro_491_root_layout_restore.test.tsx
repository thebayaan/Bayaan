// @ai-generated
/**
 * Repro tests for PR #491 (RFC-023 step 5), written during code review.
 *
 * Built from a copy of RootLayoutReaderRestore.test.tsx with the same mocks.
 * The one change to the mocks: bootApp can be made to take a set time, so a
 * slow boot can be simulated with fake timers.
 *
 * Finding 1 (review comment): the 15 s safety limit starts at root mount, so
 * it can end the restore before the reader was ever pushed.
 *   F2: a boot longer than 15 s. Expected: the reader is pushed once, as on
 *   develop. On the PR head: push is never called, the state is 'ended'.
 *   F2b: a share import longer than 15 s holds the push. Expected: the reader
 *   is pushed once after the share ends. On the PR head: push is never called.
 *
 * Finding 2 (review comment): the restore decision lives in three places and
 * the splash is hidden twice.
 *   F1a: content arrives before the 4 s deadline. Expected: hideAsync runs
 *   once. On the PR head: it runs 2 times.
 *   F1b: content arrives after the 4 s deadline. Expected: hideAsync runs
 *   once. On the PR head: it runs 2 times.
 *
 * Lives outside app/ because every file there is bundled as a route.
 */
import React, {act} from 'react';
import {Linking} from 'react-native';
import TestRenderer from 'react-test-renderer';

const mockRouter = {push: jest.fn()};
const mockSession = {
  lastScreenWasMushaf: false,
  lastReadPage: null as null | number,
};
const mockSplash = {hideAsync: jest.fn(() => Promise.resolve(true))};
const mockShare = {
  hasShareIntent: false,
  shareIntent: {files: [] as unknown[]},
  resetShareIntent: jest.fn(),
};
const mockFonts = {loaded: true};

jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: () => Promise.resolve(true),
  hideAsync: () => mockSplash.hideAsync(),
}));
jest.mock('@/services/mushaf/MushafSessionStore', () => ({
  mushafSessionStore: {
    getLastScreenWasMushaf: () => mockSession.lastScreenWasMushaf,
    getLastReadPage: () => mockSession.lastReadPage,
  },
}));
jest.mock('expo-router', () => {
  function Stack() {
    return null;
  }
  Stack.Screen = function Screen() {
    return null;
  };
  return {Stack, useRouter: () => mockRouter};
});
jest.mock('expo-share-intent', () => ({useShareIntent: () => mockShare}));
jest.mock('expo-font', () => ({
  useFonts: () => [mockFonts.loaded, null],
}));
// A controllable boot: ms 0 ends at once, otherwise after ms of fake time.
const mockBoot = {ms: 0};
jest.mock('@/services/appBoot', () => ({
  bootApp: () =>
    mockBoot.ms === 0
      ? Promise.resolve()
      : new Promise<void>(resolve => setTimeout(resolve, mockBoot.ms)),
}));

// The rest of the root's imports: what the launch does not exercise here.
function mockChildren({children}: {children?: React.ReactNode}) {
  return children ?? null;
}
jest.mock('@/i18n', () => ({
  __esModule: true,
  default: {t: (key: string) => key},
}));
jest.mock('@/i18n/fonts', () => ({uiFontFiles: {}}));
jest.mock('@/i18n/language', () => ({bootstrapDirection: () => undefined}));
jest.mock('@/utils/rtl', () => ({
  appDirection: 'ltr',
  appLayoutDirection: {},
  isRTL: false,
}));
jest.mock('react-native-gesture-handler', () => ({
  GestureHandlerRootView: mockChildren,
}));
jest.mock('expo-system-ui', () => ({
  setBackgroundColorAsync: () => Promise.resolve(),
}));
jest.mock('@/services/player/store/playerStore', () => ({
  usePlayerStore: {getState: () => ({setError: () => undefined})},
}));
jest.mock('@/components/ErrorBoundary', () => ({
  __esModule: true,
  default: mockChildren,
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: mockChildren,
}));
jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        text: '#111',
        background: '#fff',
        border: '#ccc',
        error: '#f00',
      },
    },
    isDarkMode: false,
  }),
}));
jest.mock('expo-router/react-navigation', () => {
  const ReactActual = jest.requireActual('react');
  return {
    LocaleDirContext: ReactActual.createContext('ltr'),
    ThemeProvider: mockChildren,
  };
});
jest.mock('@/components/player/v2/PlayerHost', () => ({
  PlayerHost: () => null,
}));
jest.mock('@/components/modals/WhatsNewOnboarding', () => ({
  WhatsNewModal: () => null,
}));
jest.mock('@/components/DevMenu', () => ({DevMenu: () => null}));
jest.mock('react-native-actions-sheet', () => ({
  SheetProvider: mockChildren,
  SheetManager: {show: jest.fn()},
}));
jest.mock('@/utils/lastTouch', () => ({recordTouch: () => undefined}));
jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({isTablet: false}),
}));
jest.mock('@/components/keyboard/AppKeyCommands', () => ({
  AppKeyCommands: () => null,
}));
jest.mock('@/services/keyboard/keyCommands', () => ({
  keyCommandsSupported: () => false,
}));
jest.mock('@/components/sheets/sheets', () => ({}));
jest.mock('react-native-reanimated', () => ({
  configureReanimatedLogger: () => undefined,
  ReanimatedLogLevel: {warn: 1},
}));
jest.mock('@/utils/tajweedLoader', () => ({
  preloadTajweedData: () => undefined,
}));
jest.mock('@/components/NetworkStatusMonitor', () => ({
  NetworkStatusMonitor: () => null,
}));
jest.mock('@/hooks/useNetworkMonitor', () => ({
  useNetworkMonitor: () => undefined,
}));
jest.mock('posthog-react-native', () => ({
  PostHogProvider: mockChildren,
  usePostHog: () => null,
}));
jest.mock('@/services/widgets/syncWidgets', () => ({
  startWidgetSync: () => () => undefined,
}));
jest.mock('@/services/widgets/syncContentWidgets', () => ({
  startContentWidgetSync: () => () => undefined,
}));
jest.mock('@/services/widgets/syncConfiguredWidgets', () => ({
  startConfiguredWidgetSync: () => () => undefined,
}));
jest.mock('@/services/widgets/live-activity/syncLiveActivity', () => ({
  startLiveActivitySync: () => () => undefined,
}));
jest.mock('@/services/analytics/AnalyticsService', () => ({
  analyticsService: {
    setPostHogInstance: () => undefined,
    trackAppOpened: () => undefined,
    trackAppBackgrounded: () => undefined,
  },
}));
jest.mock('@/services/audio', () => ({ExpoAudioProvider: mockChildren}));
// The import of a shared file does not end, so the share holds the splash.
jest.mock('@/store/uploadsStore', () => ({
  useUploadsStore: {
    getState: () => ({importFile: () => new Promise(() => undefined)}),
  },
}));
jest.mock('@/utils/toastUtils', () => ({showToast: () => undefined}));
jest.mock('@/services/mushaf/MushafPreloadService', () => ({
  mushafPreloadService: {startIfIdle: () => undefined},
}));
jest.mock('@/hooks/useGlassProps', () => ({USE_GLASS: false}));
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {expoConfig: {}},
}));
jest.mock('@sentry/react-native', () => ({
  init: () => undefined,
  wrap: (component: unknown) => component,
}));
jest.mock('@/hooks/usePhoneOrientation', () => ({
  usePhoneOrientation: () => undefined,
}));
jest.mock('@/components/native/ConfirmationDialogHost', () => ({
  ConfirmationDialogHost: () => null,
}));

import RootLayout from '@/app/_layout';
import {
  HOME_AFTER_SHOWN_MS,
  RESTORE_SAFETY_LIMIT_MS,
  SPLASH_DEADLINE_MS,
  noteReaderFirstContent,
} from '@/services/mushaf/readerRestoreState';

declare const global: {IS_REACT_ACT_ENVIRONMENT?: boolean};
global.IS_REACT_ACT_ENVIRONMENT = true;

let renderer: TestRenderer.ReactTestRenderer | null = null;
let linkingSpy: jest.SpyInstance;
let errorSpy: jest.SpyInstance;
let logSpy: jest.SpyInstance;

/** Lets the boot and the read of the initial URL end. */
async function settle(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function launch(): Promise<void> {
  act(() => {
    renderer = TestRenderer.create(<RootLayout />);
  });
  await settle();
}

/** The app was killed with the reader open. */
function lastScreenWasReader(page: number | null = 42): void {
  mockSession.lastScreenWasMushaf = true;
  mockSession.lastReadPage = page;
}

beforeEach(() => {
  jest.useFakeTimers();
  mockBoot.ms = 0;
  mockRouter.push.mockClear();
  mockSplash.hideAsync.mockClear();
  mockSession.lastScreenWasMushaf = false;
  mockSession.lastReadPage = null;
  mockShare.hasShareIntent = false;
  mockShare.shareIntent.files = [];
  mockFonts.loaded = true;
  linkingSpy = jest.spyOn(Linking, 'getInitialURL').mockResolvedValue(null);
  // react-test-renderer prints a deprecation notice under React 19.
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
  jest.clearAllTimers();
  jest.useRealTimers();
  linkingSpy.mockRestore();
  errorSpy.mockRestore();
  logSpy.mockRestore();
});

describe('PR #491 finding 2: the splash is hidden exactly once', () => {
  it('F1a: the normal path hides the splash exactly once', async () => {
    lastScreenWasReader();
    await launch();
    act(() => noteReaderFirstContent());
    await settle();
    await act(async () => {
      jest.advanceTimersByTime(HOME_AFTER_SHOWN_MS);
    });
    await settle();
    // On the PR head: received 2 (the subscriber hides it, then the effect).
    expect(mockSplash.hideAsync).toHaveBeenCalledTimes(1);
  });

  it('F1b: content after the deadline hides the splash exactly once', async () => {
    lastScreenWasReader();
    await launch();
    await act(async () => {
      jest.advanceTimersByTime(SPLASH_DEADLINE_MS);
    });
    await settle();
    act(() => noteReaderFirstContent());
    await settle();
    await act(async () => {
      jest.advanceTimersByTime(HOME_AFTER_SHOWN_MS);
    });
    await settle();
    // On the PR head: received 2 (the deadline path, then the subscriber).
    expect(mockSplash.hideAsync).toHaveBeenCalledTimes(1);
  });
});

describe('PR #491 finding 1: the safety limit does not cancel a push that has not happened', () => {
  it('F2: a boot slower than the safety limit still restores the reader (develop did)', async () => {
    lastScreenWasReader(42);
    mockBoot.ms = RESTORE_SAFETY_LIMIT_MS + 1000;
    act(() => {
      renderer = TestRenderer.create(<RootLayout />);
    });
    await act(async () => {
      jest.advanceTimersByTime(mockBoot.ms);
    });
    await settle();
    // On the PR head: push is never called, the restore state is 'ended'.
    expect(mockRouter.push).toHaveBeenCalledTimes(1);
  });

  it('F2b: a share import longer than 15 s still restores the reader afterwards', async () => {
    lastScreenWasReader();
    mockShare.hasShareIntent = true;
    await launch();
    await act(async () => {
      jest.advanceTimersByTime(RESTORE_SAFETY_LIMIT_MS);
    });
    mockShare.hasShareIntent = false;
    act(() => renderer?.update(<RootLayout />));
    await settle();
    // On the PR head: push is never called, the restore state is 'ended'.
    expect(mockRouter.push).toHaveBeenCalledTimes(1);
  });
});
