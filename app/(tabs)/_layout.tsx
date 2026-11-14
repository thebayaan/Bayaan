// app/(tabs)/_layout.tsx

import React from 'react';
import {StyleSheet, View} from 'react-native'; // @ai
import {useSegments} from 'expo-router'; // @ai
import {Tabs, type BottomTabBarProps} from 'expo-router/js-tabs';
import {StatusBar} from 'expo-status-bar';
import {useTheme} from '@/hooks/useTheme';
import {NativeTabs} from 'expo-router/unstable-native-tabs';
import {MiniPlayer} from '@/components/player/v2/MiniPlayer';
import {usePlayerStore} from '@/services/player/store/playerStore';
import BottomTabBar from '@/components/BottomTabBar';

import {FloatingPlayer} from '@/components/player/v2/FloatingPlayer';
import {TabletSidebar} from '@/components/tablet/TabletSidebar';
import {useResponsive} from '@/hooks/useResponsive';
import {USE_GLASS} from '@/hooks/useGlassProps';
// @ai-start
import {useTranslation} from 'react-i18next';
import {appDirection, appLayoutDirection, forceLTR, isRTL} from '@/utils/rtl';
// @ai-end

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

// @ai-start
function IOSTabs() {
  const {theme} = useTheme();
  const {t} = useTranslation();
  const hasTrack = usePlayerStore(state => {
    const tracks = state.queue.tracks;
    const index = state.queue.currentIndex;
    return tracks.length > 0 && tracks[index] != null;
  });

  // @ai-start
  // Arabic, Search tab: the mini player in the native bottom accessory lost
  // most of its content. Nothing in the app's layout differs between the
  // tabs or the two directions there. UIKit mis-frames the accessory in
  // right-to-left when the tab bar shows no separate search button, which is
  // what selecting the Search tab does (it turns into the search field);
  // react-native-screens records this as a UIKit bug in its tabs RTL work
  // (software-mansion/react-native-screens#3613). Until that is fixed, the
  // native accessory is hidden in that one state and the app's own floating
  // mini player (the one Android uses) is shown instead.
  const segments = useSegments();
  const onSearchTab = (segments as string[]).includes('(b.search)');
  const accessoryUnusable = isRTL && onSearchTab;
  // @ai-end

  // UIKit mirrors the tabs via its layout-direction trait. Keep the accessory's
  // Yoga coordinates stable and apply app direction to its content separately.
  return (
    <View style={[{flex: 1}, forceLTR]}>
      <NativeTabs
        unstable_nativeProps={{
          direction: appDirection,
          ios: {bottomAccessoryHidden: accessoryUnusable}, // @ai
        }}
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
          contentStyle={{
            ...appLayoutDirection,
            backgroundColor: theme.colors.background,
          }}>
          <NativeTabs.Trigger.Icon
            src={tabIcons.home}
            renderingMode="template"
          />
          <NativeTabs.Trigger.Label>{t('tabs.home')}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>

        <NativeTabs.Trigger
          name="(b.surahs)"
          contentStyle={{
            ...appLayoutDirection,
            backgroundColor: theme.colors.background,
          }}>
          <NativeTabs.Trigger.Icon
            src={tabIcons.surahs}
            renderingMode="template"
          />
          <NativeTabs.Trigger.Label>
            {t('tabs.surahs')}
          </NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>

        <NativeTabs.Trigger
          name="(b.search)"
          role="search"
          contentStyle={{
            ...appLayoutDirection,
            backgroundColor: theme.colors.background,
          }}>
          <NativeTabs.Trigger.Icon
            src={tabIcons.search}
            renderingMode="template"
          />
          <NativeTabs.Trigger.Label>
            {t('tabs.search')}
          </NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>

        <NativeTabs.Trigger
          name="(c.collection)"
          contentStyle={{
            ...appLayoutDirection,
            backgroundColor: theme.colors.background,
          }}>
          <NativeTabs.Trigger.Icon
            src={tabIcons.collection}
            renderingMode="template"
          />
          <NativeTabs.Trigger.Label>
            {t('tabs.collection')}
          </NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>

        <NativeTabs.Trigger
          name="(d.settings)"
          contentStyle={{
            ...appLayoutDirection,
            backgroundColor: theme.colors.background,
          }}>
          <NativeTabs.Trigger.Icon
            sf={{default: 'gearshape', selected: 'gearshape.fill'}}
          />
          <NativeTabs.Trigger.Label>
            {t('tabs.settings')}
          </NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      </NativeTabs>
      {/* @ai-start */}
      {/* Stands in for the hidden accessory (see accessoryUnusable). The
          wrapper restores the app direction that the LTR parent removes, and
          lets touches outside the pill through to the tabs. */}
      {accessoryUnusable && (
        <View
          pointerEvents="box-none"
          style={[StyleSheet.absoluteFill, appLayoutDirection]}>
          <FloatingPlayer />
        </View>
      )}
      {/* @ai-end */}
    </View>
  );
}
// @ai-end

// @ai-start
function AndroidTabs() {
  const {t} = useTranslation();
  return (
    <View style={{flex: 1}}>
      <Tabs
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
        <Tabs.Screen name="(a.home)" options={{title: t('tabs.home')}} />
        <Tabs.Screen name="(b.surahs)" options={{title: t('tabs.surahs')}} />
        <Tabs.Screen name="(b.search)" options={{title: t('tabs.search')}} />
        <Tabs.Screen
          name="(c.collection)"
          options={{title: t('tabs.collection')}}
        />
        <Tabs.Screen
          name="(d.settings)"
          options={{title: t('tabs.settings')}}
        />
      </Tabs>
      <FloatingPlayer />
    </View>
  );
}
// @ai-end

/**
 * Tablet shell: leading sidebar (icon rail below 900pt wide, labelled from 900pt)
 * with the mini player docked in the sidebar footer. Replaces both the iOS
 * NativeTabs and the Android floating pill when `isTablet` is true.
 */
// @ai-start
function TabletTabs() {
  const {t} = useTranslation();
  return (
    <View style={[{flex: 1}, forceLTR]}>
      <Tabs
        screenOptions={{
          headerShown: false,
          lazy: true,
          tabBarPosition: isRTL ? 'right' : 'left',
          sceneStyle: appLayoutDirection,
          tabBarStyle: {
            borderTopWidth: 0,
            borderRightWidth: 0,
            borderLeftWidth: 0,
            elevation: 0,
          },
        }}
        tabBar={tabletSidebarComponent}>
        <Tabs.Screen name="(a.home)" options={{title: t('tabs.home')}} />
        <Tabs.Screen name="(b.surahs)" options={{title: t('tabs.surahs')}} />
        <Tabs.Screen name="(b.search)" options={{title: t('tabs.search')}} />
        <Tabs.Screen
          name="(c.collection)"
          options={{title: t('tabs.collection')}}
        />
        <Tabs.Screen
          name="(d.settings)"
          options={{title: t('tabs.settings')}}
        />
      </Tabs>
    </View>
  );
}
// @ai-end

// Expo Router 58 takes a navigator's initial route from the route node, not
// from an `initialRouteName` prop on the layout.
export const unstable_settings = {
  initialRouteName: '(a.home)',
};

export default function TabsLayout() {
  const {isDarkMode} = useTheme();
  const {isTablet} = useResponsive();

  return (
    <>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
      {isTablet ? <TabletTabs /> : USE_GLASS ? <IOSTabs /> : <AndroidTabs />}
    </>
  );
}
