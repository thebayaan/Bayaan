// app/(tabs)/_layout.tsx

import React from 'react';
import {View} from 'react-native';
import {Tabs} from 'expo-router';
import {StatusBar} from 'expo-status-bar';
import {useTheme} from '@/hooks/useTheme';
import {NativeTabs} from 'expo-router/unstable-native-tabs';
import {MiniPlayer} from '@/components/player/v2/MiniPlayer';
import {usePlayerStore} from '@/services/player/store/playerStore';
import BottomTabBar from '@/components/BottomTabBar';
import {BottomTabBarProps} from '@react-navigation/bottom-tabs';
import {FloatingPlayer} from '@/components/player/v2/FloatingPlayer';
import {TabletSidebar} from '@/components/tablet/TabletSidebar';
import {useResponsive} from '@/hooks/useResponsive';
import {USE_GLASS} from '@/hooks/useGlassProps';

// PNG tab icons for NativeTabs (iOS) — template-rendered by the native tab bar
const tabIcons = {
  home: {
    default: require('@/assets/images/tab-icons/home-default.png'),
    selected: require('@/assets/images/tab-icons/home-filled.png'),
  },
  surahs: {
    default: require('@/assets/images/tab-icons/surahs-default.png'),
    selected: require('@/assets/images/tab-icons/surahs-filled.png'),
  },
  search: {
    default: require('@/assets/images/tab-icons/search-default.png'),
    selected: require('@/assets/images/tab-icons/search-filled.png'),
  },
  collection: {
    default: require('@/assets/images/tab-icons/collection-default.png'),
    selected: require('@/assets/images/tab-icons/collection-filled.png'),
  },
};

const tabBarComponent = (props: BottomTabBarProps) => (
  <BottomTabBar {...props} />
);

const tabletSidebarComponent = (props: BottomTabBarProps) => (
  <TabletSidebar {...props} />
);

function IOSTabs() {
  const {theme} = useTheme();
  const hasTrack = usePlayerStore(state => {
    const tracks = state.queue.tracks;
    const index = state.queue.currentIndex;
    return tracks.length > 0 && tracks[index] != null;
  });

  return (
    <NativeTabs
      tintColor={theme.colors.text}
      minimizeBehavior="onScrollDown"
      blurEffect="none"
      backgroundColor="transparent">
      {hasTrack && (
        <NativeTabs.BottomAccessory>
          <MiniPlayer />
        </NativeTabs.BottomAccessory>
      )}
      <NativeTabs.Trigger
        name="(a.home)"
        contentStyle={{backgroundColor: theme.colors.background}}>
        <NativeTabs.Trigger.Icon src={tabIcons.home} renderingMode="template" />
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger
        name="(b.surahs)"
        contentStyle={{backgroundColor: theme.colors.background}}>
        <NativeTabs.Trigger.Icon
          src={tabIcons.surahs}
          renderingMode="template"
        />
        <NativeTabs.Trigger.Label>Surahs</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger
        name="(b.search)"
        role="search"
        contentStyle={{backgroundColor: theme.colors.background}}>
        <NativeTabs.Trigger.Icon
          src={tabIcons.search}
          renderingMode="template"
        />
        <NativeTabs.Trigger.Label>Search</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger
        name="(c.collection)"
        contentStyle={{backgroundColor: theme.colors.background}}>
        <NativeTabs.Trigger.Icon
          src={tabIcons.collection}
          renderingMode="template"
        />
        <NativeTabs.Trigger.Label>Collection</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger
        name="(d.settings)"
        contentStyle={{backgroundColor: theme.colors.background}}>
        <NativeTabs.Trigger.Icon
          sf={{default: 'gearshape', selected: 'gearshape.fill'}}
        />
        <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

function AndroidTabs() {
  return (
    <View style={{flex: 1}}>
      <Tabs
        initialRouteName="(a.home)"
        screenOptions={{
          headerShown: false,
          lazy: true,
          tabBarStyle: {
            position: 'absolute',
            height: 0,
            overflow: 'hidden',
            borderTopWidth: 0,
          },
        }}
        tabBar={tabBarComponent}>
        <Tabs.Screen name="(a.home)" options={{title: 'Home'}} />
        <Tabs.Screen name="(b.surahs)" options={{title: 'Surahs'}} />
        <Tabs.Screen name="(b.search)" options={{title: 'Search'}} />
        <Tabs.Screen name="(c.collection)" options={{title: 'Collection'}} />
        <Tabs.Screen name="(d.settings)" options={{title: 'Settings'}} />
      </Tabs>
      <FloatingPlayer />
    </View>
  );
}

/**
 * Tablet shell: left-docked sidebar (rail in portrait, labeled in landscape)
 * with the mini player docked in the sidebar footer. Replaces both the iOS
 * NativeTabs and the Android floating pill when `isTablet` is true.
 */
function TabletTabs() {
  return (
    <View style={{flex: 1}}>
      <Tabs
        initialRouteName="(a.home)"
        screenOptions={{
          headerShown: false,
          lazy: true,
          tabBarPosition: 'left',
          tabBarStyle: {
            borderTopWidth: 0,
            borderRightWidth: 0,
            elevation: 0,
          },
        }}
        tabBar={tabletSidebarComponent}>
        <Tabs.Screen name="(a.home)" options={{title: 'Home'}} />
        <Tabs.Screen name="(b.surahs)" options={{title: 'Surahs'}} />
        <Tabs.Screen name="(b.search)" options={{title: 'Search'}} />
        <Tabs.Screen name="(c.collection)" options={{title: 'Collection'}} />
        <Tabs.Screen name="(d.settings)" options={{title: 'Settings'}} />
      </Tabs>
    </View>
  );
}

export default function TabsLayout() {
  const {isDarkMode} = useTheme();
  const {isTablet} = useResponsive();

  return (
    <>
      <StatusBar
        style={isDarkMode ? 'light' : 'dark'}
        translucent
        backgroundColor="transparent"
      />
      {isTablet ? <TabletTabs /> : USE_GLASS ? <IOSTabs /> : <AndroidTabs />}
    </>
  );
}
