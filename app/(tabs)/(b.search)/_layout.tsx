import React from 'react';
import {Stack} from 'expo-router';

export default function SearchLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="reciter/[id]" />
      <Stack.Screen name="reciter/browse" />
      {/* Add other screens under Search tab here if needed */}
    </Stack>
  );
}
