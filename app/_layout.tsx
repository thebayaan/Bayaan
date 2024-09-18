/* eslint-disable react-native/no-inline-styles */
import React, {useEffect, useState} from 'react';
import {Stack, useRouter} from 'expo-router';
import {AudioPlayerProvider} from '@/contexts/AudioPlayerContext';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {StatusBar} from 'expo-status-bar';
import {ThemeProvider} from '@/contexts/ThemeContext';
import {useFonts} from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import {useAuthStore} from '@/store/authStore';
import {LoadingIndicator} from '@/components/LoadingIndicator';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    SurahNames: require('@/assets/fonts/surah_names.ttf'),
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
    if (isReady && fontsLoaded && !isLoading) {
      SplashScreen.hideAsync();
      if (session) {
        router.replace('/(tabs)');
      } else {
        router.replace('/(auth)/welcome');
      }
    }
  }, [isReady, fontsLoaded, isLoading, session, router]);

  return (
    <ThemeProvider>
      {!isReady || !fontsLoaded || isLoading ? (
        <LoadingIndicator />
      ) : (
        <GestureHandlerRootView style={{flex: 1}}>
          <StatusBar style="auto" />
          <AudioPlayerProvider>
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
          </AudioPlayerProvider>
        </GestureHandlerRootView>
      )}
    </ThemeProvider>
  );
}
