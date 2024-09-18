import React from 'react';
import {Stack} from 'expo-router';
import {ThemeProvider} from '@/contexts/ThemeContext';

export default function AuthLayout() {
  return (
    <ThemeProvider>
      <Stack screenOptions={{headerShown: false}}>
        <Stack.Screen name="welcome" />
        <Stack.Screen name="login" />
        <Stack.Screen name="signup" />
        <Stack.Screen name="verify-email" />
      </Stack>
    </ThemeProvider>
  );
}
