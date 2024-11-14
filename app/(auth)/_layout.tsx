import React from 'react';
import {Stack} from 'expo-router';
import {useTheme} from '@/hooks/useTheme';
import {StatusBar} from 'expo-status-bar';

export default function AuthLayout() {
  const {isDarkMode} = useTheme();
  return (
    <>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
      <Stack screenOptions={{headerShown: false}}>
        <Stack.Screen name="welcome" />
        <Stack.Screen name="login" />
        <Stack.Screen name="signup" />
        <Stack.Screen name="verify-email" />
        <Stack.Screen name="password-reset/forgot-password" />
        <Stack.Screen name="password-reset/verify" />
      </Stack>
    </>
  );
}
