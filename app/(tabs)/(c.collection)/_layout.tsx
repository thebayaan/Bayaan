import React from 'react';
import {Stack} from 'expo-router';
import {useTheme} from '@/hooks/useTheme';
import {USE_GLASS} from '@/hooks/useGlassProps';

export default function CollectionLayout() {
  const {theme} = useTheme();

  const collectionScreenOptions =
    USE_GLASS
      ? {
          headerShown: true,
          headerTransparent: true,
          headerStyle: {backgroundColor: 'transparent'},
          headerShadowVisible: false,
          headerTitle: '',
          headerBackTitle: ' ',
          headerBackButtonDisplayMode: 'minimal' as const,
          headerTintColor: theme.colors.text,
        }
      : undefined;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        freezeOnBlur: true,
      }}>
      <Stack.Screen
        name="index"
        options={
          USE_GLASS
            ? {title: '', headerBackTitle: ' '}
            : undefined
        }
      />
      <Stack.Screen
        name="reciter/[id]"
        options={{
          ...(USE_GLASS
            ? {
                headerShown: true,
                headerTransparent: true,
                headerBlurEffect: undefined,
                headerStyle: {backgroundColor: 'transparent'},
                headerShadowVisible: false,
                headerTitle: '',
                headerBackTitle: ' ',
                headerBackButtonDisplayMode: 'minimal',
              }
            : {headerShown: false}),
        }}
      />
      <Stack.Screen
        name="collection/loved"
        options={collectionScreenOptions}
      />
      <Stack.Screen
        name="collection/favorite-reciters"
        options={collectionScreenOptions}
      />
      <Stack.Screen
        name="collection/playlists"
        options={collectionScreenOptions}
      />
      <Stack.Screen
        name="collection/downloads"
        options={collectionScreenOptions}
      />
      <Stack.Screen
        name="collection/uploads"
        options={collectionScreenOptions}
      />
      <Stack.Screen
        name="collection/bookmarks"
        options={collectionScreenOptions}
      />
      <Stack.Screen
        name="collection/notes"
        options={collectionScreenOptions}
      />
      <Stack.Screen
        name="collection/reciter-downloads/[reciterId]"
        options={collectionScreenOptions}
      />
      <Stack.Screen
        name="playlist/[id]"
        options={collectionScreenOptions}
      />
    </Stack>
  );
}
