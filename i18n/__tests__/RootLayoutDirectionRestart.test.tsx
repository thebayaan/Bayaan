/**
 * The Android startup restart (i18n/restart) as the root layout
 * (app/_layout.tsx) runs it. When a launch has asked Android to relaunch the
 * process, ProcessPhoenix kills this process shortly after, from a process of
 * its own. Until then nothing boots here (audio session, catalogue fetch,
 * databases, session restore) and the splash stays up. If the kill never
 * comes, the launch goes on.
 *
 * The rules for when a launch restarts are in restart.test.ts. Lives outside
 * app/ because every file there is bundled as a route.
 */
import React, {act} from 'react';
import {Linking} from 'react-native';
import TestRenderer from 'react-test-renderer';

const mockSplash = {hideAsync: jest.fn(() => Promise.resolve(true))};
const mockRestartIfMismatched = jest.fn(() => false);
const mockBootApp = jest.fn(() => Promise.resolve());
const mockPlayback = {state: 'none'};

jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: () => Promise.resolve(true),
  hideAsync: () => mockSplash.hideAsync(),
}));
jest.mock('@/i18n/restart', () => ({
  restartIfDirectionMismatched: () => mockRestartIfMismatched(),
}));
jest.mock('@/services/appBoot', () => ({bootApp: () => mockBootApp()}));
jest.mock('@/services/player/store/playerStore', () => ({
  usePlayerStore: {
    getState: () => ({setError: () => undefined, playback: mockPlayback}),
  },
}));

// The rest of the root's imports: what the launch does not exercise here.
function mockChildren({children}: {children?: React.ReactNode}) {
  return children ?? null;
}
jest.mock('@/services/mushaf/MushafSessionStore', () => ({
  mushafSessionStore: {
    getLastScreenWasMushaf: () => false,
    getLastReadPage: () => null,
  },
}));
jest.mock('expo-router', () => {
  function Stack() {
    return null;
  }
  Stack.Screen = function Screen() {
    return null;
  };
  return {Stack, useRouter: () => ({push: jest.fn()})};
});
jest.mock('expo-share-intent', () => ({
  useShareIntent: () => ({
    hasShareIntent: false,
    shareIntent: {files: []},
    resetShareIntent: () => undefined,
  }),
}));
jest.mock('expo-font', () => ({useFonts: () => [true, null]}));
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
jest.mock('@/components/PlaybackFailureNotice', () => ({
  PlaybackFailureNotice: () => null,
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
    trackAppOpenedOnMount: () => undefined,
    handleAppStateChange: () => undefined,
  },
}));
jest.mock('@/services/audio', () => ({ExpoAudioProvider: mockChildren}));
jest.mock('@/store/uploadsStore', () => ({
  useUploadsStore: {getState: () => ({})},
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

declare const global: {IS_REACT_ACT_ENVIRONMENT?: boolean};
global.IS_REACT_ACT_ENVIRONMENT = true;

let renderer: TestRenderer.ReactTestRenderer | null = null;
const quiet: jest.SpyInstance[] = [];

/** Lets the boot and the effects that follow it run. */
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

async function advance(ms: number): Promise<void> {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
  await settle();
}

beforeEach(() => {
  jest.useFakeTimers();
  mockSplash.hideAsync.mockClear();
  mockBootApp.mockClear();
  mockRestartIfMismatched.mockReset();
  mockRestartIfMismatched.mockReturnValue(false);
  mockPlayback.state = 'none';
  quiet.push(jest.spyOn(Linking, 'getInitialURL').mockResolvedValue(null));
  // react-test-renderer prints a deprecation notice under React 19.
  quiet.push(jest.spyOn(console, 'error').mockImplementation(() => undefined));
  quiet.push(jest.spyOn(console, 'log').mockImplementation(() => undefined));
});

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
  jest.clearAllTimers();
  jest.useRealTimers();
  quiet.splice(0).forEach(spy => spy.mockRestore());
});

describe('a launch in the wrong direction that relaunches', () => {
  it('does not boot in the process being relaunched, and keeps the splash', async () => {
    mockRestartIfMismatched.mockReturnValue(true);
    await launch();
    await advance(1000);
    expect(mockBootApp).not.toHaveBeenCalled();
    expect(mockSplash.hideAsync).not.toHaveBeenCalled();
  });

  it('boots after all when the relaunch does not come', async () => {
    mockRestartIfMismatched.mockReturnValue(true);
    await launch();
    await advance(10_000);
    expect(mockRestartIfMismatched).toHaveBeenCalledTimes(1);
    expect(mockBootApp).toHaveBeenCalledTimes(1);
    expect(mockSplash.hideAsync).toHaveBeenCalledTimes(1);
  });
});

describe('a launch that does not relaunch', () => {
  it('boots at once and hides the splash', async () => {
    await launch();
    expect(mockRestartIfMismatched).toHaveBeenCalledTimes(1);
    expect(mockBootApp).toHaveBeenCalledTimes(1);
    expect(mockSplash.hideAsync).toHaveBeenCalledTimes(1);
  });

  it.each(['playing', 'buffering', 'loading'])(
    'does not ask for a relaunch while audio is %s',
    async state => {
      mockPlayback.state = state;
      await launch();
      expect(mockRestartIfMismatched).not.toHaveBeenCalled();
      expect(mockBootApp).toHaveBeenCalledTimes(1);
    },
  );
});
