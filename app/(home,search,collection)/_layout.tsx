import React from 'react';
import {Stack} from 'expo-router';

export default function SharedLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="[id]"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="browse"
        options={{
          headerShown: false,
        }}
      />
    </Stack>
  );
}
