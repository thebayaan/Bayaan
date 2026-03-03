import React from 'react';
import {Stack} from 'expo-router';

export default function SearchLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" />
      <Stack.Screen name="browse-all" options={{headerShown: false}} />
      <Stack.Screen name="browse-all-surahs" options={{headerShown: false}} />
      <Stack.Screen
        name="system-playlist/[id]"
        options={{headerShown: false}}
      />
      <Stack.Screen name="reciter/[id]" options={{headerShown: false}} />
      <Stack.Screen name="reciter/browse" options={{headerShown: false}} />
    </Stack>
  );
}
