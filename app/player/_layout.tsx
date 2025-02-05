import React from 'react';
import {Stack} from 'expo-router';
import {StatusBar} from 'react-native';
import {useTheme} from '@/hooks/useTheme';

export default function PlayerLayout() {
  const {isDarkMode} = useTheme();
  return (
    <>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <Stack
        screenOptions={{
          headerShown: false,
          presentation: 'modal',
          animation: 'slide_from_bottom',
          contentStyle: {
            backgroundColor: 'transparent',
          },
          fullScreenGestureEnabled: true,
        }}>
        <Stack.Screen name="index" />
        <Stack.Screen
          name="extended-summary"
          options={{
            presentation: 'card',
            animation: 'slide_from_right',
          }}
        />
      </Stack>
    </>
  );
}
