import React, {useEffect, useState} from 'react';
import {Stack, useRouter} from 'expo-router';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {StatusBar} from 'expo-status-bar';
import {ThemeProvider} from '@/contexts/ThemeContext';
import {useFonts} from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import {useAuthStore} from '@/store/authStore';
import {LoadingIndicator} from '@/components/LoadingIndicator';
import TrackPlayer, {Event} from 'react-native-track-player';
import {playbackService} from '@/services/playbackService';
import {usePlayerStore} from '@/store/playerStore';
import {setupTrackPlayer} from '@/utils/trackPlayerSetup';
import ErrorBoundary from '@/components/ErrorBoundary';

TrackPlayer.registerPlaybackService(() => playbackService);

export default function RootLayout() {
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const setActiveTrack = usePlayerStore(state => state.setActiveTrack);

  useEffect(() => {
    async function initializeTrackPlayer() {
      try {
        await setupTrackPlayer();
        setIsPlayerReady(true);
      } catch (error) {
        console.error('Error initializing TrackPlayer:', error);
      }
    }

    initializeTrackPlayer();
  }, []);

  useEffect(() => {
    if (isPlayerReady) {
      const listener = TrackPlayer.addEventListener(
        Event.PlaybackTrackChanged,
        async event => {
          if (event.nextTrack !== undefined) {
            const track = await TrackPlayer.getTrack(event.nextTrack);
            if (track) {
              setActiveTrack(track);
            }
          }
        },
      );

      return () => {
        listener.remove();
      };
    }
  }, [isPlayerReady, setActiveTrack]);

  TrackPlayer.addEventListener(Event.PlaybackError, error => {
    console.error('Playback error:', error);
  });

  const [fontsLoaded] = useFonts({
    SurahNames: require('@/assets/fonts/surah_names.ttf'),
    SurahNames2: require('@/assets/fonts/surah_names_2.ttf'),
  });
  const {session, isLoading, initializeAuth} = useAuthStore();
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        await SplashScreen.preventAutoHideAsync();
        await initializeAuth();
      } catch (e) {
        console.warn(e);
      } finally {
        setIsReady(true);
      }
    }
    prepare();
  }, [initializeAuth]);

  useEffect(() => {
    if (isReady && fontsLoaded && !isLoading && isPlayerReady) {
      SplashScreen.hideAsync();
      if (session) {
        router.replace('/(tabs)/(home)');
      } else {
        router.replace('/(auth)/welcome');
      }
    }
  }, [isReady, fontsLoaded, isLoading, session, router, isPlayerReady]);

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <GestureHandlerRootView style={{flex: 1}}>
          <StatusBar style="auto" />
          {!fontsLoaded || !isPlayerReady || !isReady ? (
            <LoadingIndicator />
          ) : (
            <Stack screenOptions={{headerShown: false}}>
              <Stack.Screen name="(auth)" options={{headerShown: false}} />
              <Stack.Screen
                name="(modals)/settings"
                options={{
                  presentation: 'modal',
                  animation: 'slide_from_bottom',
                  headerShown: false,
                }}
              />
              {/* <Stack.Screen
                name="(tabs)/(collection)/reciter/select-reciter"
                options={{presentation: 'transparentModal', animation: 'fade'}}
              />
              <Stack.Screen
                name="(tabs)/(home)reciter/select-reciter"
                options={{presentation: 'transparentModal', animation: 'fade'}}
              /> */}
              <Stack.Screen
                name="(modals)/select-reciter"
                options={{presentation: 'transparentModal', animation: 'fade'}}
              />
              <Stack.Screen name="(tabs)" options={{headerShown: false}} />
              <Stack.Screen
                name="player"
                options={{
                  presentation: 'card',
                  animation: 'slide_from_bottom',
                  gestureEnabled: true,
                  gestureDirection: 'vertical',
                }}
              />
              <Stack.Screen
                name="(modals)/setting-item-playground"
                options={{
                  presentation: 'modal',
                  animation: 'slide_from_bottom',
                }}
              />
            </Stack>
          )}
        </GestureHandlerRootView>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
