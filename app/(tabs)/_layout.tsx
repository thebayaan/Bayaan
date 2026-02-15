// app/(tabs)/_layout.tsx

import React from 'react';
import {Tabs} from 'expo-router';
import BottomTabBar from '@/components/BottomTabBar';
import {BottomTabBarProps} from '@react-navigation/bottom-tabs';
// import {FloatingPlayer} from '@/components/FloatingPlayer';
import {StatusBar} from 'expo-status-bar';
import {useTheme} from '@/hooks/useTheme';

const tabBarComponent = (props: BottomTabBarProps) => (
  <BottomTabBar {...props} />
);

export default function TabsLayout() {
  const {isDarkMode} = useTheme();

  return (
    <>
      <StatusBar
        style={isDarkMode ? 'light' : 'dark'}
        translucent
        backgroundColor="transparent"
      />
      <Tabs
        initialRouteName="(a.home)"
        screenOptions={{
          headerShown: false,
          lazy: true,
          freezeOnBlur: true,
        }}
        tabBar={tabBarComponent}>
        <Tabs.Screen name="(a.home)" options={{title: 'Home'}} />
        <Tabs.Screen name="(b.search)" options={{title: 'Search'}} />
        <Tabs.Screen
          name="(c.collection)"
          options={{title: 'Your Collection'}}
        />
      </Tabs>
      {/* <FloatingPlayer /> */}
    </>
  );
}
