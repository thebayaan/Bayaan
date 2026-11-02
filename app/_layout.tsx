// @ai-start
import i18n from '@/i18n';
import {uiFontFiles} from '@/i18n/fonts';
import {bootstrapDirection} from '@/i18n/language';
import {appDirection, appLayoutDirection, isRTL} from '@/utils/rtl';
// @ai-end
import React, {useEffect, useState, useRef, useCallback, useMemo} from 'react';
import {Stack, useRouter} from 'expo-router';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {useFonts} from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import {usePlayerStore} from '@/services/player/store/playerStore';
import ErrorBoundary from '@/components/ErrorBoundary';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {
  AppState,
  View,
  Text,
  Platform,
  Appearance,
  Linking,
  type AppStateStatus,
} from 'react-native';
import {runAfterInteractions} from '@/utils/afterInteractions';
import {useTheme} from '@/hooks/useTheme';
// @ai-start
import {LocaleDirContext, ThemeProvider} from 'expo-router/react-navigation';
// @ai-end
import {PlayerHost} from '@/components/player/v2/PlayerHost';
import {
  WhatsNewModal,
  WhatsNewModalRef,
} from '@/components/modals/WhatsNewOnboarding';
import {DevMenu} from '@/components/DevMenu';
import {SheetProvider} from 'react-native-actions-sheet';
import {recordTouch} from '@/utils/lastTouch'; // @ai
import {useResponsive} from '@/hooks/useResponsive'; // @ai
// @ai-start
import {AppKeyCommands} from '@/components/keyboard/AppKeyCommands';
import {keyCommandsSupported} from '@/services/keyboard/keyCommands';
// @ai-end
import '@/components/sheets/sheets'; // Register action sheets
import {
  configureReanimatedLogger,
  ReanimatedLogLevel,
} from 'react-native-reanimated';
import {preloadTajweedData} from '@/utils/tajweedLoader';
import {bootApp} from '@/services/appBoot';
import {NetworkStatusMonitor} from '@/components/NetworkStatusMonitor';
import {useNetworkMonitor} from '@/hooks/useNetworkMonitor';
import {PostHogProvider, usePostHog} from 'posthog-react-native';
import {startWidgetSync} from '@/services/widgets/syncWidgets';
import {startContentWidgetSync} from '@/services/widgets/syncContentWidgets';
import {startConfiguredWidgetSync} from '@/services/widgets/syncConfiguredWidgets';
import {startLiveActivitySync} from '@/services/widgets/live-activity/syncLiveActivity';
import {analyticsService} from '@/services/analytics/AnalyticsService';
import {ExpoAudioProvider} from '@/services/audio';
import {useShareIntent} from 'expo-share-intent';
import {useUploadsStore} from '@/store/uploadsStore';
import {SheetManager} from 'react-native-actions-sheet';
import {showToast} from '@/utils/toastUtils';
import {mushafSessionStore} from '@/services/mushaf/MushafSessionStore';
import {USE_GLASS} from '@/hooks/useGlassProps';
import Constants from 'expo-constants';
import * as Sentry from '@sentry/react-native';
import {usePhoneOrientation} from '@/hooks/usePhoneOrientation'; // @ai
import {ConfirmationDialogHost} from '@/components/native/ConfirmationDialogHost'; // @ai

// Configure Reanimated logger
configureReanimatedLogger({
  level: ReanimatedLogLevel.warn,
  strict: false,
});

// Cache for expo-navigation-bar module (Android only)
let NavigationBarModule:
  | typeof import('expo-navigation-bar').NavigationBar
  | null = null;

// Prevent the splash screen from auto-hiding
SplashScreen.preventAutoHideAsync().catch(() => {
  /* reloading the app might trigger some race conditions, ignore them */
});

// Set native root view background immediately (before any component renders)
// This prevents the white flash between splash screen and first frame
SystemUI.setBackgroundColorAsync(
  Appearance.getColorScheme() === 'dark' ? '#07121a' : '#f4f3ec',
);

const analyticsEnabled = process.env.EXPO_PUBLIC_ANALYTICS_ENABLED !== 'false';

// Narrows the `any`-typed expoConfig.extra.version without an `as` cast.
function isVersionInfo(
  value: unknown,
): value is {semanticVersion: string; buildNumber: string | number} {
  if (value == null || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.semanticVersion === 'string' &&
    (typeof v.buildNumber === 'string' || typeof v.buildNumber === 'number')
  );
}

if (analyticsEnabled) {
  // Explicit release + dist tagging. Android events were landing with no
  // release (`release: None`), so crashes/ANRs couldn't be tied to a build.
  // Derive both from the build-time version injected into
  // expoConfig.extra.version by scripts/generate-version.js — reliable on both
  // platforms, unlike Sentry's native auto-detection. `undefined` is a safe
  // no-op (Sentry falls back to auto-detect), so a missing manifest can't
  // regress the current behavior.
  const rawVersion: unknown = Constants.expoConfig?.extra?.version;
  const versionInfo = isVersionInfo(rawVersion) ? rawVersion : undefined;
  const appId =
    Constants.expoConfig?.ios?.bundleIdentifier ??
    Constants.expoConfig?.android?.package;
  // Require appId too — without it the template literal would stringify
  // `undefined` into the release name (e.g. "undefined@2.2.1+935"). Falling
  // back to an undefined release is the safe no-op (Sentry auto-detects).
  const sentryRelease =
    versionInfo != null && appId != null
      ? `${appId}@${versionInfo.semanticVersion}+${versionInfo.buildNumber}`
      : undefined;
  const sentryDist =
    versionInfo?.buildNumber != null
      ? String(versionInfo.buildNumber)
      : undefined;

  Sentry.init({
    dsn: process.env.EXPO_PUBLIC_SENTRY_DSN ?? '',
    tracesSampleRate: 0.2,
    enableAutoSessionTracking: true,
    release: sentryRelease,
    dist: sentryDist,
  });
}

/** Connects PostHog SDK to our analytics service and tracks app lifecycle. */
function AnalyticsConnector(): null {
  const posthog = usePostHog();

  // Connect PostHog instance to analytics service
  useEffect(() => {
    if (posthog) {
      analyticsService.setPostHogInstance(posthog);
      analyticsService.trackAppOpened();
    }
  }, [posthog]);

  // Track app foreground/background transitions
  useEffect(() => {
    function handleAppStateChange(nextState: AppStateStatus): void {
      if (nextState === 'background' || nextState === 'inactive') {
        analyticsService.trackAppBackgrounded();
      } else if (nextState === 'active') {
        analyticsService.trackAppOpened();
      }
    }
    const subscription = AppState.addEventListener(
      'change',
      handleAppStateChange,
    );
    return () => subscription.remove();
  }, []);

  return null;
}

// @ai-start
function RootLayout() {
  // Start reloads after the root has mounted, when native reload listeners are
  // ready, rather than as a side effect of importing translation resources.
  useEffect(bootstrapDirection, []);
  const [appIsReady, setAppIsReady] = useState(false);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [mushafRestoreHandled, setMushafRestoreHandled] = useState(false);
  const [setupError, setSetupError] = useState<Error | null>(null);
  const router = useRouter();
  const initializationRef = useRef(false);
  const whatsNewModalRef = useRef<WhatsNewModalRef>(null);
  const {theme, isDarkMode} = useTheme();
  const {isTablet} = useResponsive(); // @ai
  useNetworkMonitor();

  // Build React Navigation theme so card/background colors match during transitions
  const navigationTheme = useMemo(
    () => ({
      dark: isDarkMode,
      colors: {
        primary: theme.colors.text,
        background: theme.colors.background,
        card: theme.colors.background,
        text: theme.colors.text,
        border: theme.colors.border,
        notification: theme.colors.error,
      },
      fonts: {
        regular: {fontFamily: 'Manrope-Regular', fontWeight: '400' as const},
        medium: {fontFamily: 'Manrope-Medium', fontWeight: '500' as const},
        bold: {fontFamily: 'Manrope-Bold', fontWeight: '700' as const},
        heavy: {fontFamily: 'Manrope-ExtraBold', fontWeight: '800' as const},
      },
    }),
    [isDarkMode, theme.colors],
  );

  // Critical fonts — block splash screen on these only
  const [fontsLoaded, fontError] = useFonts({
    ...uiFontFiles,
    SurahNames: require('@/assets/fonts/surah_names.ttf'),
    SurahNames2: require('@/assets/fonts/surah_names_2.ttf'),
  });

  // Handle share intents from other apps
  const {hasShareIntent, shareIntent, resetShareIntent} = useShareIntent({
    debug: __DEV__,
    resetOnBackground: true,
  });

  // Phones are portrait (mushaf.tsx allows landscape there); iPads turn
  // freely. @ai
  usePhoneOrientation('portrait'); // @ai

  // Start after init so the first snapshot sees the restored session and
  // stores instead of overwriting the widgets with an empty state.
  useEffect(() => {
    if (!appIsReady) return;
    const stopLiveActivity = startLiveActivitySync();
    const stopSnapshot = startWidgetSync();
    const stopConfigured = startConfiguredWidgetSync();
    const stopContent = startContentWidgetSync();
    return () => {
      stopSnapshot();
      stopConfigured();
      stopContent();
      stopLiveActivity();
    };
  }, [appIsReady]);

  // Tajweed data — defer until after first frame + interactions complete
  useEffect(() => {
    runAfterInteractions(() => {
      if (__DEV__) console.log('[App] Preloading tajweed data...');
      preloadTajweedData();
    });
  }, []);

  const onLayoutRootView = useCallback(async () => {
    try {
      if (
        appIsReady &&
        fontsLoaded &&
        isPlayerReady &&
        !hasShareIntent &&
        mushafRestoreHandled
      ) {
        await SplashScreen.hideAsync();
      }
    } catch (e) {
      if (__DEV__) console.warn('Error hiding splash screen:', e);
    }
  }, [
    appIsReady,
    fontsLoaded,
    isPlayerReady,
    hasShareIntent,
    mushafRestoreHandled,
  ]);

  // Initialize app with expo-audio
  useEffect(() => {
    if (initializationRef.current) {
      return;
    }

    async function prepare() {
      try {
        await bootApp();

        // Mark app as ready
        setIsPlayerReady(true);
        setAppIsReady(true);
        initializationRef.current = true;
        if (__DEV__) console.log('[App] Initialization complete');
      } catch (error) {
        console.error('[App] Preparation error:', error);

        setSetupError(
          error instanceof Error ? error : new Error('Setup failed'),
        );
        usePlayerStore
          .getState()
          .setError(
            'system',
            error instanceof Error ? error : new Error('Setup failed'),
          );

        setIsPlayerReady(false);
        setAppIsReady(false);
        initializationRef.current = false;
      }
    }

    prepare();
  }, []);

  // Set native root view background + configure Android navigation bar to match theme
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(theme.colors.background);

    // Edge-to-edge: the app draws behind the navigation bar, so only the
    // button style follows the theme.
    async function setupNavigationBar() {
      if (Platform.OS === 'android') {
        try {
          if (!NavigationBarModule) {
            NavigationBarModule = (await import('expo-navigation-bar'))
              .NavigationBar;
          }
          NavigationBarModule?.setStyle(isDarkMode ? 'dark' : 'light');
        } catch (error) {
          if (__DEV__)
            console.warn(
              '[NavBar Debug] Failed to configure navigation bar:',
              error,
            );
        }
      }
    }

    setupNavigationBar();
  }, [theme.colors.background, isDarkMode]);

  // Handle share intent (uploads from other apps)
  useEffect(() => {
    if (!hasShareIntent || !appIsReady || !isPlayerReady) return;

    const handleShareIntent = async () => {
      try {
        const files = shareIntent.files;
        if (!files || files.length === 0) {
          resetShareIntent();
          await SplashScreen.hideAsync();
          return;
        }

        const audioFiles = files.filter(f => f.mimeType?.startsWith('audio/'));

        if (audioFiles.length === 0) {
          resetShareIntent();
          await SplashScreen.hideAsync();
          return;
        }

        const {importFile, importFiles} = useUploadsStore.getState();

        if (audioFiles.length === 1) {
          const file = audioFiles[0];
          const recitation = await importFile(
            file.path,
            file.fileName || i18n.t('app.sharedAudio'),
          );
          resetShareIntent();
          await SplashScreen.hideAsync();
          showToast(i18n.t('app.fileImported'));
          SheetManager.show('organize-recitation', {
            payload: {recitation},
          });
        } else {
          const mapped = audioFiles.map(f => ({
            uri: f.path,
            name: f.fileName || i18n.t('app.sharedAudio'),
          }));
          await importFiles(mapped);
          resetShareIntent();
          await SplashScreen.hideAsync();
          showToast(i18n.t('app.filesImported', {count: audioFiles.length}));
          router.push('/collection/uploads');
        }
      } catch (error) {
        console.error('[ShareIntent] Import failed:', error);
        resetShareIntent();
        await SplashScreen.hideAsync();
      }
    };

    handleShareIntent();
  }, [
    hasShareIntent,
    appIsReady,
    isPlayerReady,
    shareIntent,
    resetShareIntent,
  ]);

  // Restore mushaf screen if it was open when the app was killed.
  // MMKV reads are synchronous — no hydration wait needed.
  useEffect(() => {
    if (!appIsReady || !isPlayerReady || hasShareIntent) return;

    let cancelled = false;
    // A launch from a deep link (widget tap, notification) already routed
    // to its target; pushing the mushaf on top would hide it.
    Linking.getInitialURL()
      .catch(() => null)
      .then(initialUrl => {
        if (cancelled) return;
        const lastScreenWasMushaf = mushafSessionStore.getLastScreenWasMushaf();
        const lastReadPage = mushafSessionStore.getLastReadPage();

        if (!lastScreenWasMushaf || initialUrl) {
          setMushafRestoreHandled(true);
          return;
        }
        router.push({
          pathname: '/mushaf',
          params: lastReadPage ? {page: String(lastReadPage)} : undefined,
        });
        // Let the navigation animation finish behind the splash before revealing
        runAfterInteractions(() => {
          setMushafRestoreHandled(true);
        });
      });
    return () => {
      cancelled = true;
    };
  }, [appIsReady, isPlayerReady, hasShareIntent]);

  // Hide splash once mushaf restore (if any) has settled.
  // onLayout only fires once, so this effect covers the case where
  // mushafRestoreHandled flips after the initial layout.
  useEffect(() => {
    if (
      appIsReady &&
      fontsLoaded &&
      isPlayerReady &&
      !hasShareIntent &&
      mushafRestoreHandled
    ) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [
    appIsReady,
    fontsLoaded,
    isPlayerReady,
    hasShareIntent,
    mushafRestoreHandled,
  ]);

  if (fontError) {
    SplashScreen.hideAsync();
    return (
      <View style={{flex: 1, alignItems: 'center', justifyContent: 'center'}}>
        <Text>{i18n.t('app.fontError')}</Text>
      </View>
    );
  }

  if (setupError) {
    SplashScreen.hideAsync();
    return (
      <View style={{flex: 1, alignItems: 'center', justifyContent: 'center'}}>
        <Text>{i18n.t('app.initError', {message: setupError.message})}</Text>
      </View>
    );
  }

  if (!fontsLoaded || !isPlayerReady || !appIsReady) {
    return null;
  }

  return (
    <ErrorBoundary>
      <PostHogProvider
        apiKey={
          process.env.EXPO_PUBLIC_POSTHOG_API_KEY || 'phc_disabled_placeholder'
        }
        options={{
          host: 'https://us.i.posthog.com',
          flushAt: 20,
          flushInterval: 30000,
          disabled: !process.env.EXPO_PUBLIC_POSTHOG_API_KEY,
        }}
        autocapture={{
          captureScreens: true,
        }}>
        <AnalyticsConnector />
        <LocaleDirContext.Provider value={appDirection}>
          <ThemeProvider value={navigationTheme}>
            <SafeAreaProvider>
              <ExpoAudioProvider>
                <GestureHandlerRootView
                  style={[
                    {flex: 1, backgroundColor: theme.colors.background},
                    appLayoutDirection,
                  ]}
                  // @ts-ignore - RN supports this on iOS to override system theme for native UI (keyboard, menus, alerts)
                  overrideUserInterfaceStyle={isDarkMode ? 'dark' : 'light'}
                  onTouchStart={recordTouch} // @ai
                  onLayout={onLayoutRootView}>
                  <NetworkStatusMonitor />
                  <ConfirmationDialogHost /* @ai: iPad confirmations */ />
                  <SheetProvider>
                    <Stack
                      screenOptions={{
                        headerShown: false,
                        contentStyle: {
                          direction: appDirection,
                          paddingTop: 0,
                          backgroundColor: theme.colors.background,
                        },
                        animation: 'fade',
                      }}>
                      <Stack.Screen
                        name="(tabs)"
                        options={{headerShown: false}}
                      />
                      <Stack.Screen
                        name="adhkar-playing"
                        options={{headerShown: false, animation: 'none'}}
                      />
                      <Stack.Screen
                        name="mushaf"
                        options={{
                          headerShown: USE_GLASS,
                          headerTransparent: true,
                          headerStyle: {backgroundColor: 'transparent'},
                          headerShadowVisible: false,
                          headerTitle: '',
                          headerTitleAlign: 'center',
                          headerBackButtonDisplayMode: 'minimal',
                          animation: isRTL
                            ? 'slide_from_left'
                            : 'slide_from_right',
                          fullScreenGestureEnabled: false,
                        }}
                      />
                      {/* @ai-start */}
                      <Stack.Screen
                        name="translations"
                        options={
                          isTablet
                            ? {
                                // iPad: a centered card over the reader
                                // (TabletDialog), not a full page.
                                presentation: 'transparentModal',
                                animation: 'fade',
                                headerShown: false,
                                contentStyle: {
                                  direction: appDirection,
                                  backgroundColor: 'transparent',
                                },
                              }
                            : {
                                title: i18n.t('home:translations.title'),
                                headerShown: true,
                                headerTintColor: theme.colors.text,
                                ...(USE_GLASS
                                  ? {
                                      headerTransparent: true,
                                      headerStyle: {
                                        backgroundColor: 'transparent',
                                      },
                                    }
                                  : {
                                      headerStyle: {
                                        backgroundColor:
                                          theme.colors.background,
                                      },
                                    }),
                                headerShadowVisible: false,
                                headerBackButtonDisplayMode: 'minimal',
                              }
                        }
                      />
                      {/* @ai-end */}
                    </Stack>
                    <PlayerHost />
                    {keyCommandsSupported() && <AppKeyCommands />}
                    <WhatsNewModal ref={whatsNewModalRef} />
                    <DevMenu whatsNewModalRef={whatsNewModalRef} />
                  </SheetProvider>
                </GestureHandlerRootView>
              </ExpoAudioProvider>
            </SafeAreaProvider>
          </ThemeProvider>
        </LocaleDirContext.Provider>
      </PostHogProvider>
    </ErrorBoundary>
  );
}
// @ai-end

// A deep link (widget, Live Activity, App Link) that opens a screen in this
// stack lands on top of its first screen, so back always has a target.
export const unstable_settings = {initialRouteName: '(tabs)'};

export default Sentry.wrap(RootLayout);
