import React from 'react';
import {Stack} from 'expo-router';

export default function CollectionLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="reciter/[id]" />
      <Stack.Screen name="collection/loved" />
      <Stack.Screen name="collection/favorite-reciters" />
      <Stack.Screen name="collection/playlists" />
      <Stack.Screen name="collection/downloads" />
    </Stack>
  );
}
