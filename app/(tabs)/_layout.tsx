/* eslint-disable react/no-unstable-nested-components */
import React from 'react';
import {Tabs} from 'expo-router';
// import {FloatingPlayer} from '@/components/FloatingPlayer';
import BottomTabBar from '@/components/BottomTabBar';
import {useTheme} from '@/hooks/useTheme';

export default function TabsLayout() {
  const {theme} = useTheme();

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: theme.colors.background,
          },
        }}
        tabBar={props => <BottomTabBar {...props} />}>
        <Tabs.Screen name="index" options={{title: 'Home'}} />
        <Tabs.Screen name="search" options={{title: 'Search'}} />
        <Tabs.Screen name="library" options={{title: 'Library'}} />
      </Tabs>
      {/* <FloatingPlayer /> */}
    </>
  );
}
