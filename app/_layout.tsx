import React, {useEffect, useState} from 'react';
import {Stack, useRouter} from 'expo-router';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {useFonts} from 'expo-font';
import {useAuthStore} from '@/store/authStore';
import {LoadingIndicator} from '@/components/LoadingIndicator';
import TrackPlayer, {Event} from 'react-native-track-player';
import {playbackService} from '@/services/playbackService';
import {usePlayerStore} from '@/store/playerStore';
import {setupTrackPlayer} from '@/utils/trackPlayerSetup';
import ErrorBoundary from '@/components/ErrorBoundary';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {View, Text} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {PlayerBottomSheet} from '@/components/player/PlayerBottomSheet';

// Register playback service
TrackPlayer.registerPlaybackService(() => playbackService);

export default function RootLayout() {
  const [appIsReady, setAppIsReady] = useState(false);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const router = useRouter();
  const {session, isLoading, initializeAuth, isInitialized} = useAuthStore();

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
  });

  // Initialize app
  useEffect(() => {
    async function prepare() {
      try {
        await initializeAuth();
        await setupTrackPlayer();
        setIsPlayerReady(true);
        setAppIsReady(true);
      } catch (error) {
        console.error('Preparation error:', error);
      }
    }

    prepare();
  }, [initializeAuth]);

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

    const handleNavigation = async () => {
      try {
        const route = session ? '/(tabs)/(home)' : '/(auth)/welcome';
        router.replace(route);
      } catch (error) {
        console.error('Navigation error:', error);
      }
    };

    handleNavigation();
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

  // Setup TrackPlayer event listeners
  useEffect(() => {
    if (!isPlayerReady) return;

    const listeners = [
      TrackPlayer.addEventListener(Event.PlaybackTrackChanged, async () => {
        await usePlayerStore.getState().updateCurrentTrack();
      }),
      TrackPlayer.addEventListener(Event.PlaybackError, error => {
        console.error('Playback error:', error);
      }),
    ];

    return () => {
      listeners.forEach(listener => listener.remove());
    };
  }, [isPlayerReady]);

  if (fontError) {
    return (
      <View style={{flex: 1, alignItems: 'center', justifyContent: 'center'}}>
        <Text>Error loading fonts</Text>
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
    return <LoadingIndicator />;
  }

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <GestureHandlerRootView style={{flex: 1}}>
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
          <PlayerBottomSheet />
        </GestureHandlerRootView>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
