// app/(tabs)/_layout.tsx

import React from 'react';
import {Tabs} from 'expo-router';
import BottomTabBar from '@/components/BottomTabBar';
import {BottomTabBarProps} from '@react-navigation/bottom-tabs';
import {FloatingPlayer} from '@/components/FloatingPlayer';
import {StatusBar} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
const tabBarComponent = (props: BottomTabBarProps) => (
  <BottomTabBar {...props} />
);

export default function TabsLayout() {
  const {isDarkMode} = useTheme();

  return (
    <>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <Tabs
        initialRouteName="(home)"
        screenOptions={{
          headerShown: false,
        }}
        tabBar={tabBarComponent}>
        <Tabs.Screen name="(home)" options={{title: 'Home'}} />
        <Tabs.Screen name="(search)" options={{title: 'Search'}} />
        <Tabs.Screen name="(collection)" options={{title: 'Your Collection'}} />
      </Tabs>
      <FloatingPlayer />
    </>
  );
}
