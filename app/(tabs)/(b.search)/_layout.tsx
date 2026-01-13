import React from 'react';
import {Stack} from 'expo-router';

export default function SearchLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        freezeOnBlur: true,
      }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="browse-all" />
      <Stack.Screen name="browse-all-surahs" />
      <Stack.Screen name="system-playlist/[id]" />
      <Stack.Screen name="reciter/[id]" />
      <Stack.Screen name="reciter/browse" />
    </Stack>
  );
}
