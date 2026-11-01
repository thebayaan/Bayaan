// @ai-generated
/**
 * RFC-023 step 5: the root layout (app/_layout.tsx) with the restore state. It
 * pushes the reader once, hides the splash at the reader's first content, and
 * keeps today's conditions: a deep link does not restore, and a share intent
 * holds the push until it ends. Lives outside app/ because every file there is
 * bundled as a route.
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
jest.mock('@/services/appBoot', () => ({
  bootApp: () => Promise.resolve(),
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
  getReaderRestoreState,
  noteReaderFirstContent,
  readerRestoreHoldsHome,
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

describe('a launch with no restore', () => {
  it('never waits and pushes nothing', async () => {
    await launch();
    expect(getReaderRestoreState()).toBe('none');
    expect(mockRouter.push).not.toHaveBeenCalled();
    expect(mockSplash.hideAsync).toHaveBeenCalled();
    expect(readerRestoreHoldsHome()).toBe(false);
  });
});

describe('a launch from a deep link', () => {
  it('does not restore, and nothing waits', async () => {
    lastScreenWasReader();
    linkingSpy.mockResolvedValue('bayaan://quran/2/255');
    await launch();
    expect(mockRouter.push).not.toHaveBeenCalled();
    expect(getReaderRestoreState()).toBe('ended');
    expect(mockSplash.hideAsync).toHaveBeenCalled();
    expect(readerRestoreHoldsHome()).toBe(false);
  });

  it('restores when the read of the initial URL fails, as it did before', async () => {
    lastScreenWasReader();
    linkingSpy.mockRejectedValue(new Error('no link'));
    await launch();
    expect(mockRouter.push).toHaveBeenCalledTimes(1);
  });
});

describe('a launch that restores the reader', () => {
  it('pushes the reader once, at the last read page', async () => {
    lastScreenWasReader(42);
    await launch();
    expect(mockRouter.push).toHaveBeenCalledTimes(1);
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/mushaf',
      params: {page: '42'},
    });
    expect(getReaderRestoreState()).toBe('waitingForContent');
  });

  it('pushes with no page when none was saved', async () => {
    lastScreenWasReader(null);
    await launch();
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/mushaf',
      params: undefined,
    });
  });

  it('keeps the splash until the first content, then hides it at once', async () => {
    lastScreenWasReader();
    await launch();
    expect(mockSplash.hideAsync).not.toHaveBeenCalled();

    act(() => {
      noteReaderFirstContent();
      // At the report, before any render of the root.
      expect(mockSplash.hideAsync).toHaveBeenCalled();
    });
  });

  it('keeps the splash through the interactions: no idle wait hides it', async () => {
    lastScreenWasReader();
    await launch();
    await act(async () => {
      jest.advanceTimersByTime(SPLASH_DEADLINE_MS - 1);
    });
    expect(mockSplash.hideAsync).not.toHaveBeenCalled();
  });

  it('hides the splash at the deadline for a surface that never reports', async () => {
    lastScreenWasReader();
    await launch();
    await act(async () => {
      jest.advanceTimersByTime(SPLASH_DEADLINE_MS);
    });
    expect(mockSplash.hideAsync).toHaveBeenCalled();
    expect(getReaderRestoreState()).toBe('waitingForContent');
    expect(readerRestoreHoldsHome()).toBe(true);
  });

  it('frees the home route 1 s after the first content', async () => {
    lastScreenWasReader();
    await launch();
    act(() => noteReaderFirstContent());
    expect(readerRestoreHoldsHome()).toBe(true);
    await act(async () => {
      jest.advanceTimersByTime(HOME_AFTER_SHOWN_MS);
    });
    expect(readerRestoreHoldsHome()).toBe(false);
  });

  it('hides the splash at the safety limit when the initial URL never comes', async () => {
    lastScreenWasReader();
    linkingSpy.mockReturnValue(new Promise(() => undefined));
    await launch();
    expect(mockSplash.hideAsync).not.toHaveBeenCalled();
    await act(async () => {
      jest.advanceTimersByTime(RESTORE_SAFETY_LIMIT_MS);
    });
    expect(mockSplash.hideAsync).toHaveBeenCalled();
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('does not hide the splash before the fonts load', async () => {
    lastScreenWasReader();
    mockFonts.loaded = false;
    await launch();
    await act(async () => {
      jest.advanceTimersByTime(SPLASH_DEADLINE_MS);
    });
    expect(mockSplash.hideAsync).not.toHaveBeenCalled();
  });
});

describe('a launch with a share intent', () => {
  it('holds the push until the share ends, as it did before', async () => {
    lastScreenWasReader();
    mockShare.hasShareIntent = true;
    await launch();
    expect(mockRouter.push).not.toHaveBeenCalled();
    expect(getReaderRestoreState()).toBe('pushing');

    mockShare.hasShareIntent = false;
    act(() => renderer?.update(<RootLayout />));
    await settle();
    expect(mockRouter.push).toHaveBeenCalledTimes(1);
    expect(getReaderRestoreState()).toBe('waitingForContent');
  });

  it('does not push a second reader when a share arrives after the push', async () => {
    lastScreenWasReader();
    await launch();
    expect(mockRouter.push).toHaveBeenCalledTimes(1);

    mockShare.hasShareIntent = true;
    mockShare.shareIntent.files = [
      {mimeType: 'audio/mpeg', path: 'file:///a.mp3', fileName: 'a.mp3'},
    ];
    act(() => renderer?.update(<RootLayout />));
    await settle();
    // The share's own flow hides the splash, so the first content does not.
    act(() => noteReaderFirstContent());
    expect(mockSplash.hideAsync).not.toHaveBeenCalled();

    mockShare.hasShareIntent = false;
    act(() => renderer?.update(<RootLayout />));
    await settle();
    expect(mockRouter.push).toHaveBeenCalledTimes(1);
    expect(mockSplash.hideAsync).toHaveBeenCalled();
  });
});
