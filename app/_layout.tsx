import React, {useEffect, useState} from 'react';
import {Stack, useRouter} from 'expo-router';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {StatusBar} from 'expo-status-bar';
import {ThemeProvider} from '@/contexts/ThemeContext';
import {useFonts} from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import {useAuthStore} from '@/store/authStore';
import {LoadingIndicator} from '@/components/LoadingIndicator';
import TrackPlayer, {Capability, Event} from 'react-native-track-player';
import {playbackService} from '@/services/playbackService';
import {usePlayerStore} from '@/store/playerStore';

TrackPlayer.registerPlaybackService(() => playbackService);

export default function RootLayout() {
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const setActiveTrack = usePlayerStore(state => state.setActiveTrack);

  useEffect(() => {
    async function setupTrackPlayer() {
      try {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Add a 1-second delay
        await TrackPlayer.setupPlayer();
        await TrackPlayer.updateOptions({
          capabilities: [
            Capability.Play,
            Capability.Pause,
            Capability.SkipToNext,
            Capability.SkipToPrevious,
            Capability.Stop,
          ],
          compactCapabilities: [Capability.Play, Capability.Pause],
        });
        setIsPlayerReady(true);
      } catch (error) {
        console.error('Error setting up TrackPlayer:', error);
      }
    }

    setupTrackPlayer();
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
        router.replace('/(tabs)');
      } else {
        router.replace('/(auth)/welcome');
      }
    }
  }, [isReady, fontsLoaded, isLoading, session, router, isPlayerReady]);

  return (
    <ThemeProvider>
      <GestureHandlerRootView style={{flex: 1}}>
        <StatusBar style="auto" />
        {!fontsLoaded || !isPlayerReady ? (
          <LoadingIndicator />
        ) : (
          <Stack screenOptions={{headerShown: false}}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen
              name="(modals)/settings"
              options={{
                presentation: 'modal',
                animation: 'slide_from_bottom',
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="(modals)/select-reciter"
              options={{
                presentation: 'transparentModal',
                animation: 'fade',
              }}
            />
            <Stack.Screen
              name="(modals)/player"
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
            <Stack.Screen
              name="reciter/[id]"
              options={{
                presentation: 'card',
              }}
            />
            <Stack.Screen
              name="reciter-browse"
              options={{
                presentation: 'card',
                animation: 'slide_from_right',
              }}
            />
          </Stack>
        )}
      </GestureHandlerRootView>
    </ThemeProvider>
  );
}
