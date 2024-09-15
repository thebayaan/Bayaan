/* eslint-disable react-native/no-inline-styles */
import React, {useEffect, useState} from 'react';
import {Stack, useRouter} from 'expo-router';
import {View, Text} from 'react-native';
import {AudioPlayerProvider} from '@/contexts/AudioPlayerContext';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {StatusBar} from 'expo-status-bar';
import {ThemeProvider} from '@/contexts/ThemeContext';
import {useFonts} from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import {useAuthStore} from '@/store/authStore';

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

  if (!isReady || !fontsLoaded || isLoading) {
    return (
      <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <ThemeProvider>
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
              name="player"
              options={{
                presentation: 'card',
                gestureEnabled: true,
                gestureDirection: 'vertical',
                animationDuration: 400,
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="(modals)/setting-item-playground"
              options={{
                presentation: 'modal',
                animation: 'slide_from_bottom',
                headerShown: false,
              }}
            />
          </Stack>
        </AudioPlayerProvider>
      </GestureHandlerRootView>
    </ThemeProvider>
  );
}
