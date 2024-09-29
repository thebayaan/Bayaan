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
      {/* Add other screens under Collection tab here if needed */}
    </Stack>
  );
}
