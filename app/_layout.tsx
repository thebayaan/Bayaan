import React, {useEffect, useState, useRef, useCallback} from 'react';
import {Stack, useRouter} from 'expo-router';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {useFonts} from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import TrackPlayer from 'react-native-track-player';
import playbackService from '@/services/player/events/playbackService';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {setupTrackPlayer} from '@/services/player/utils/setup';
import {setupEventBridge} from '@/services/player/events/bridge';
import ErrorBoundary from '@/components/ErrorBoundary';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {View, Text, Platform, StatusBar as RNStatusBar} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {PlayerSheet} from '@/components/player/v2/PlayerSheet';
import {FloatingPlayer} from '@/components/player/v2/FloatingPlayer';
import {ModalProvider} from '@/components/providers/ModalProvider';
import {
  configureReanimatedLogger,
  ReanimatedLogLevel,
} from 'react-native-reanimated';
import {preloadTajweedDataWithTimeout} from '@/utils/tajweedLoader';

// Configure Reanimated logger
configureReanimatedLogger({
  level: ReanimatedLogLevel.warn,
  strict: false,
});

// Prevent the splash screen from auto-hiding
SplashScreen.preventAutoHideAsync().catch(() => {
  /* reloading the app might trigger some race conditions, ignore them */
});

// Register playback service
TrackPlayer.registerPlaybackService(() => playbackService);

// Track initialization attempts to prevent loops
let initializationAttempts = 0;
const MAX_INITIALIZATION_ATTEMPTS = 3;
const RETRY_DELAY = 1000;

export default function RootLayout() {
  const [appIsReady, setAppIsReady] = useState(false);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [isTajweedLoading, setIsTajweedLoading] = useState(false);
  const [setupError, setSetupError] = useState<Error | null>(null);
  const router = useRouter();
  const store = usePlayerStore();
  const initializationRef = useRef(false);
  const {theme, isDarkMode} = useTheme();

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
    'ScheherazadeNew-Regular': require('@/assets/fonts/ScheherazadeNew-Regular.ttf'),
    'ScheherazadeNew-Medium': require('@/assets/fonts/ScheherazadeNew-Medium.ttf'),
    'ScheherazadeNew-Bold': require('@/assets/fonts/ScheherazadeNew-Bold.ttf'),
    'ScheherazadeNew-SemiBold': require('@/assets/fonts/ScheherazadeNew-SemiBold.ttf'),
    Uthmani: require('@/assets/fonts/Uthmani.otf'),
    QPC: require('@/assets/fonts/UthmanicHafs1Ver18.ttf'),
    Indopak: require('@/assets/fonts/Indopak.ttf'),
  });

  // Preload Tajweed data once when the app starts
  useEffect(() => {
    if (!isTajweedLoading) {
      setIsTajweedLoading(true);
      console.log('[App] Preloading tajweed data...');
      // Start preloading tajweed data in the background
      preloadTajweedDataWithTimeout();
      // We don't need to wait for tajweed data to load to continue app initialization
      // This will load asynchronously while other resources are being prepared
    }
  }, [isTajweedLoading]);

  const onLayoutRootView = useCallback(async () => {
    try {
      if (appIsReady && fontsLoaded && isPlayerReady) {
        // Only hide the splash screen after everything is ready
        await SplashScreen.hideAsync();
      }
    } catch (e) {
      console.warn('Error hiding splash screen:', e);
    }
  }, [appIsReady, fontsLoaded, isPlayerReady]);

  // Initialize app
  useEffect(() => {
    if (initializationRef.current) {
      return;
    }

    async function prepare() {
      try {
        // Prevent multiple initialization attempts
        if (initializationAttempts >= MAX_INITIALIZATION_ATTEMPTS) {
          console.error('[App] Max initialization attempts reached');
          setSetupError(new Error('Max initialization attempts reached'));
          return;
        }
        initializationAttempts++;

        console.log(
          '[App] Starting initialization attempt:',
          initializationAttempts,
        );

        // Setup player with error handling and retry
        console.log('[App] Setting up player...');
        let setupStatus = await setupTrackPlayer();

        // If setup fails, retry after delay
        if (
          !setupStatus.isInitialized &&
          initializationAttempts < MAX_INITIALIZATION_ATTEMPTS
        ) {
          console.log('[App] Setup failed, retrying after delay...');
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
          setupStatus = await setupTrackPlayer();
        }

        console.log('[App] Player setup status:', setupStatus);

        if (!setupStatus.isInitialized) {
          if (setupStatus.error) {
            console.error('[App] Player setup error:', setupStatus.error);
            store.setError('system', setupStatus.error);
            setSetupError(setupStatus.error);
          }
          return;
        }

        console.log('[App] Player setup complete');

        // Mark app as ready without state restoration
        setIsPlayerReady(true);
        setAppIsReady(true);
        initializationRef.current = true;
        console.log('[App] Initialization complete');
      } catch (error) {
        console.error('[App] Preparation error:', error);

        // Clear any partial initialization
        try {
          await TrackPlayer.reset();
        } catch (resetError) {
          console.error('[App] Reset after error failed:', resetError);
        }

        setSetupError(
          error instanceof Error ? error : new Error('Setup failed'),
        );
        store.setError(
          'system',
          error instanceof Error ? error : new Error('Setup failed'),
        );

        // Reset initialization state
        setIsPlayerReady(false);
        setAppIsReady(false);
        initializationRef.current = false;
      }
    }

    prepare();
  }, [store]);

  // Setup event listeners
  useEffect(() => {
    if (!isPlayerReady) {
      return;
    }

    const handleSetupError = (error: Error) => {
      console.error('[App] Player setup error:', error);
      setSetupError(error);
      store.setError('system', error);
    };

    setupEventBridge.on('setupError', handleSetupError);

    return () => {
      setupEventBridge.off('setupError', handleSetupError);
    };
  }, [isPlayerReady, store]);

  // Handle navigation after initialization
  useEffect(() => {
    if (!appIsReady || !fontsLoaded || !isPlayerReady || fontError) {
      return;
    }
  }, [appIsReady, fontsLoaded, fontError, isPlayerReady, router]);

  // Configure Android navigation bar to match theme
  useEffect(() => {
    async function setupNavigationBar() {
      if (Platform.OS === 'android') {
        try {
          const NavigationBar = await import('expo-navigation-bar').then(
            module => module.default,
          );

          console.log(
            '[NavBar Debug] theme.colors.background:',
            theme.colors.background,
          );
          console.log('[NavBar Debug] isDarkMode:', isDarkMode);

          if (NavigationBar) {
            await NavigationBar.setBackgroundColorAsync(
              theme.colors.background,
            );
            await NavigationBar.setButtonStyleAsync(
              isDarkMode ? 'light' : 'dark',
            );
            console.log(
              '[NavBar Debug] NavigationBar color and style set successfully',
            );
          } else {
            console.warn('[NavBar Debug] NavigationBar module not found');
          }
          RNStatusBar.setTranslucent(true);
        } catch (error) {
          console.warn(
            '[NavBar Debug] Failed to configure navigation bar:',
            error,
          );
        }
      } else {
        console.log(
          '[NavBar Debug] Not Android, skipping navigation bar setup',
        );
      }
    }

    setupNavigationBar();
  }, [theme.colors.background, isDarkMode]);

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
      <SafeAreaProvider>
        <GestureHandlerRootView style={{flex: 1}} onLayout={onLayoutRootView}>
          <ModalProvider>
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: {
                  paddingTop: 0,
                },
                animation: 'fade',
              }}>
              <Stack.Screen name="(tabs)" options={{headerShown: false}} />
            </Stack>
            <FloatingPlayer />
            <PlayerSheet />
          </ModalProvider>
        </GestureHandlerRootView>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
