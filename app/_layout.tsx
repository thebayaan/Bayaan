import React, {useEffect, useState, useRef, useCallback, useMemo} from 'react';
import {Stack, useRouter} from 'expo-router';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {useFonts} from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {useDownloadStore} from '@/services/player/store/downloadStore';
import ErrorBoundary from '@/components/ErrorBoundary';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {
  View,
  Text,
  Platform,
  StatusBar as RNStatusBar,
  Appearance,
  InteractionManager,
} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {ThemeProvider} from '@react-navigation/native';
import {PlayerSheet} from '@/components/player/v2/PlayerSheet';
import {
  WhatsNewModal,
  WhatsNewModalRef,
} from '@/components/modals/WhatsNewOnboarding';
import {DevMenu} from '@/components/DevMenu';
import {SheetProvider} from 'react-native-actions-sheet';
import '@/components/sheets/sheets'; // Register action sheets
import {
  configureReanimatedLogger,
  ReanimatedLogLevel,
} from 'react-native-reanimated';
import {preloadTajweedData} from '@/utils/tajweedLoader';
import {appInitializer} from '@/services/AppInitializer';
import {ExpoAudioProvider} from '@/services/audio';
import {expoAudioService} from '@/services/audio/ExpoAudioService';
import {restoreSession} from '@/services/player/utils/restoreSession';
import {useShareIntent} from 'expo-share-intent';
import {useUploadsStore} from '@/store/uploadsStore';
import {SheetManager} from 'react-native-actions-sheet';
import {showToast} from '@/utils/toastUtils';
import {mushafSessionStore} from '@/services/mushaf/MushafSessionStore';
import {USE_GLASS} from '@/hooks/useGlassProps';

// Configure Reanimated logger
configureReanimatedLogger({
  level: ReanimatedLogLevel.warn,
  strict: false,
});

// Cache for expo-navigation-bar module (Android only)
let NavigationBarModule: any = null;

// Prevent the splash screen from auto-hiding
SplashScreen.preventAutoHideAsync().catch(() => {
  /* reloading the app might trigger some race conditions, ignore them */
});

// Set native root view background immediately (before any component renders)
// This prevents the white flash between splash screen and first frame
SystemUI.setBackgroundColorAsync(
  Appearance.getColorScheme() === 'dark' ? '#07121a' : '#f4f3ec',
);

export default function RootLayout() {
  const [appIsReady, setAppIsReady] = useState(false);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [mushafRestoreHandled, setMushafRestoreHandled] = useState(false);
  const [setupError, setSetupError] = useState<Error | null>(null);
  const router = useRouter();
  const initializationRef = useRef(false);
  const whatsNewModalRef = useRef<WhatsNewModalRef>(null);
  const {theme, isDarkMode} = useTheme();

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
    'Manrope-Regular': require('@/assets/fonts/Manrope-Regular.ttf'),
    'Manrope-Bold': require('@/assets/fonts/Manrope-Bold.ttf'),
    'Manrope-Medium': require('@/assets/fonts/Manrope-Medium.ttf'),
    'Manrope-SemiBold': require('@/assets/fonts/Manrope-SemiBold.ttf'),
    'Manrope-Light': require('@/assets/fonts/Manrope-Light.ttf'),
    'Manrope-ExtraLight': require('@/assets/fonts/Manrope-ExtraLight.ttf'),
    'Manrope-ExtraBold': require('@/assets/fonts/Manrope-ExtraBold.ttf'),
    SurahNames: require('@/assets/fonts/surah_names.ttf'),
    SurahNames2: require('@/assets/fonts/surah_names_2.ttf'),
  });

  // Handle share intents from other apps
  const {hasShareIntent, shareIntent, resetShareIntent} = useShareIntent({
    debug: __DEV__,
    resetOnBackground: true,
  });

  // Tajweed data — defer until after first frame + interactions complete
  useEffect(() => {
    InteractionManager.runAfterInteractions(() => {
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
        if (__DEV__)
          console.log('[App] Starting initialization with expo-audio...');

        // Initialize expo-audio service
        await expoAudioService.initialize();
        if (__DEV__) console.log('[App] expo-audio service initialized');

        // Initialize all SQLite services, adhkar, playlists, mushaf, fonts, stores, etc.
        // This blocks splash screen so everything is ready when the user sees the app
        await appInitializer.initialize();
        if (__DEV__) console.log('[App] AppInitializer complete');

        // PRE-WARM: Initialize stores BEFORE first play to prevent cold start lag
        try {
          useDownloadStore.getState();
          if (__DEV__) console.log('[App] Download store pre-warmed');

          usePlayerStore.getState();
          if (__DEV__) console.log('[App] Player store pre-warmed');
        } catch (error) {
          console.debug('[App] Failed to pre-warm stores:', error);
        }

        // Restore last session so floating player + lock screen show last track
        try {
          await restoreSession();
          if (__DEV__) console.log('[App] Session restored');
        } catch (error) {
          console.debug('[App] Failed to restore session:', error);
        }

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Set native root view background + configure Android navigation bar to match theme
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(theme.colors.background);

    async function setupNavigationBar() {
      if (Platform.OS === 'android') {
        try {
          if (!NavigationBarModule) {
            NavigationBarModule = await import('expo-navigation-bar').then(
              module => module.default,
            );
            RNStatusBar.setTranslucent(true);
          }

          if (NavigationBarModule) {
            await NavigationBarModule.setBackgroundColorAsync(
              theme.colors.background,
            );
            await NavigationBarModule.setButtonStyleAsync(
              isDarkMode ? 'light' : 'dark',
            );
          }
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
            file.fileName || 'Shared Audio',
          );
          resetShareIntent();
          await SplashScreen.hideAsync();
          showToast('File imported');
          SheetManager.show('organize-recitation', {
            payload: {recitation},
          });
        } else {
          const mapped = audioFiles.map(f => ({
            uri: f.path,
            name: f.fileName || 'Shared Audio',
          }));
          await importFiles(mapped);
          resetShareIntent();
          await SplashScreen.hideAsync();
          showToast(`${audioFiles.length} files imported`);
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

    const lastScreenWasMushaf = mushafSessionStore.getLastScreenWasMushaf();
    const lastReadPage = mushafSessionStore.getLastReadPage();

    if (lastScreenWasMushaf) {
      router.push({
        pathname: '/mushaf',
        params: lastReadPage ? {page: String(lastReadPage)} : undefined,
      });
      // Let the navigation animation finish behind the splash before revealing
      InteractionManager.runAfterInteractions(() => {
        setMushafRestoreHandled(true);
      });
    } else {
      setMushafRestoreHandled(true);
    }
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
        <Text>Error loading fonts</Text>
      </View>
    );
  }

  if (setupError) {
    SplashScreen.hideAsync();
    return (
      <View style={{flex: 1, alignItems: 'center', justifyContent: 'center'}}>
        <Text>Error initializing player: {setupError.message}</Text>
      </View>
    );
  }

  if (!fontsLoaded || !isPlayerReady || !appIsReady) {
    return null;
  }

  return (
    <ErrorBoundary>
      <ThemeProvider value={navigationTheme}>
        <SafeAreaProvider>
          <ExpoAudioProvider>
            <GestureHandlerRootView
              style={{flex: 1, backgroundColor: theme.colors.background}}
              // @ts-ignore - RN supports this on iOS to override system theme for native UI (keyboard, menus, alerts)
              overrideUserInterfaceStyle={isDarkMode ? 'dark' : 'light'}
              onLayout={onLayoutRootView}>
              <SheetProvider>
                <Stack
                  screenOptions={{
                    headerShown: false,
                    contentStyle: {
                      paddingTop: 0,
                      backgroundColor: theme.colors.background,
                    },
                    animation: 'fade',
                  }}>
                  <Stack.Screen name="(tabs)" options={{headerShown: false}} />
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
                      animation: 'slide_from_right',
                      fullScreenGestureEnabled: false,
                    }}
                  />
                </Stack>
                <PlayerSheet />
                <WhatsNewModal ref={whatsNewModalRef} />
                <DevMenu whatsNewModalRef={whatsNewModalRef} />
              </SheetProvider>
            </GestureHandlerRootView>
          </ExpoAudioProvider>
        </SafeAreaProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
