import React, {useEffect, useState, useRef, useCallback} from 'react';
import {Stack, useRouter} from 'expo-router';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {useFonts} from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import {useAuthStore} from '@/store/authStore';
import {LoadingIndicator} from '@/components/LoadingIndicator';
import TrackPlayer from 'react-native-track-player';
import playbackService from '@/services/player/events/playbackService';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {setupTrackPlayer} from '@/services/player/utils/setup';
import {restorePlayerState} from '@/services/player/utils/stateRecovery';
import {setupEventBridge} from '@/services/player/events/bridge';
import ErrorBoundary from '@/components/ErrorBoundary';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {View, Text} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {PlayerSheet} from '@/components/player/v2/PlayerSheet';
import {FloatingPlayer} from '@/components/player/v2/FloatingPlayer';
import {
  configureReanimatedLogger,
  ReanimatedLogLevel,
} from 'react-native-reanimated';

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
const MAX_INITIALIZATION_ATTEMPTS = 2;

export default function RootLayout() {
  const [appIsReady, setAppIsReady] = useState(false);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [setupError, setSetupError] = useState<Error | null>(null);
  const router = useRouter();
  const {session, isLoading, initializeAuth, isInitialized} = useAuthStore();
  const store = usePlayerStore();
  const initializationRef = useRef(false);

  useTheme();

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
  });

  const onLayoutRootView = useCallback(async () => {
    try {
      if (
        appIsReady &&
        fontsLoaded &&
        isPlayerReady &&
        isInitialized &&
        !isLoading
      ) {
        // Only hide the splash screen after everything is ready
        await SplashScreen.hideAsync();
      }
    } catch (e) {
      console.warn('Error hiding splash screen:', e);
    }
  }, [appIsReady, fontsLoaded, isPlayerReady, isInitialized, isLoading]);

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

        // Initialize auth first
        console.log('[App] Initializing auth...');
        await initializeAuth();
        console.log('[App] Auth initialized');

        // Setup player with error handling
        console.log('[App] Setting up player...');
        const setupStatus = await setupTrackPlayer();
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

        // Restore player state
        console.log('[App] Restoring player state...');
        await restorePlayerState();
        console.log('[App] Player state restored');

        setIsPlayerReady(true);
        setAppIsReady(true);
        initializationRef.current = true;
        console.log('[App] Initialization complete');
      } catch (error) {
        console.error('[App] Preparation error:', error);
        setSetupError(
          error instanceof Error ? error : new Error('Setup failed'),
        );
        store.setError(
          'system',
          error instanceof Error ? error : new Error('Setup failed'),
        );
      }
    }

    prepare();
  }, [initializeAuth, store]);

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
    if (
      !appIsReady ||
      !fontsLoaded ||
      isLoading ||
      !isPlayerReady ||
      !isInitialized ||
      fontError
    ) {
      return;
    }

    const route = session ? '/(tabs)/(home)' : '/(auth)/welcome';
    router.replace(route);
  }, [
    appIsReady,
    fontsLoaded,
    fontError,
    isLoading,
    isPlayerReady,
    isInitialized,
    session,
    router,
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

  if (
    !fontsLoaded ||
    !isPlayerReady ||
    !appIsReady ||
    !isInitialized ||
    isLoading
  ) {
    return null;
  }

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <GestureHandlerRootView style={{flex: 1}} onLayout={onLayoutRootView}>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: {
                paddingTop: 0,
              },
              animation: 'fade',
            }}>
            <Stack.Screen name="(auth)" options={{headerShown: false}} />
            <Stack.Screen
              name="(modals)/select-reciter"
              options={{
                presentation: 'transparentModal',
                animation: 'fade',
              }}
            />
            <Stack.Screen name="(tabs)" options={{headerShown: false}} />
            <Stack.Screen
              name="(modals)/add-favorite-reciters"
              options={{
                presentation: 'transparentModal',
                animation: 'fade',
                headerShown: false,
              }}
            />
          </Stack>
          <PlayerSheet />
          <FloatingPlayer />
        </GestureHandlerRootView>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
