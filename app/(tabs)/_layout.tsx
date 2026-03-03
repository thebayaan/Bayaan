// app/(tabs)/_layout.tsx

import React from 'react';
import {StatusBar} from 'expo-status-bar';
import {useTheme} from '@/hooks/useTheme';
import {NativeTabs} from 'expo-router/unstable-native-tabs';

export default function TabsLayout() {
  const {theme, isDarkMode} = useTheme();

  return (
    <>
      <StatusBar
        style={isDarkMode ? 'light' : 'dark'}
        translucent
        backgroundColor="transparent"
      />
      <NativeTabs tintColor={theme.colors.text} minimizeBehavior="onScrollDown">
        <NativeTabs.Trigger name="(a.home)">
          <NativeTabs.Trigger.Icon
            sf={{default: 'house', selected: 'house.fill'}}
            md="home"
          />
          <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="(b.search)" role="search">
          <NativeTabs.Trigger.Icon sf="magnifyingglass" md="search" />
          <NativeTabs.Trigger.Label>Search</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="(c.collection)">
          <NativeTabs.Trigger.Icon
            sf={{default: 'square.stack', selected: 'square.stack.fill'}}
            md="library_music"
          />
          <NativeTabs.Trigger.Label>Collection</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      </NativeTabs>
    </>
  );
}
