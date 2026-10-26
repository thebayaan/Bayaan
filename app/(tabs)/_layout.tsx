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
import {BottomTabBarProps} from 'expo-router/build/react-navigation/bottom-tabs';
import {FloatingPlayer} from '@/components/player/v2/FloatingPlayer';
import {TabletSidebar} from '@/components/tablet/TabletSidebar';
import {useResponsive} from '@/hooks/useResponsive';
import {USE_GLASS} from '@/hooks/useGlassProps';
// @ai-start
import {useTranslation} from 'react-i18next';
import {appDirection, appLayoutDirection, forceLTR, isRTL} from '@/utils/rtl';
import {
  MomentsTabTracker,
  useHideMiniPlayerOnMoments,
  useOnMomentsFeed,
} from '@/hooks/useOnMomentsTab';
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
  // Moments pauses the main player, so its mini player would only cover the
  // feed. It stays when the main player is playing, e.g. after Continue.
  const hideMiniPlayer = useHideMiniPlayerOnMoments(); // @ai
  // White icons over the black feed only; a profile pushed in Moments is a
  // normal themed screen.
  const onMoments = useOnMomentsFeed(); // @ai

  // UIKit mirrors the tabs via its layout-direction trait. Keep the accessory's
  // Yoga coordinates stable and apply app direction to its content separately.
  return (
    <View style={[{flex: 1}, forceLTR]}>
      <NativeTabs
        unstable_nativeProps={{direction: appDirection}}
        tintColor={onMoments ? '#FFFFFF' : theme.colors.text} // @ai
        // Paging the feed would shrink the tab bar and leave a gap above the
        // mini player, so it stays full size on Moments.
        minimizeBehavior={onMoments ? 'never' : 'onScrollDown'} // @ai
        blurEffect="none"
        backgroundColor="transparent">
        {hasTrack && !hideMiniPlayer && (
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

        {/* @ai-start */}
        {/* Moments sits in the middle of the bar. */}
        <NativeTabs.Trigger
          name="(d.moments)"
          contentStyle={{
            ...appLayoutDirection,
            backgroundColor: '#000000',
          }}>
          <NativeTabs.Trigger.Icon
            sf={{
              default: 'play.square.stack',
              selected: 'play.square.stack.fill',
            }}
          />
          <NativeTabs.Trigger.Label>
            {t('tabs.moments')}
          </NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        {/* @ai-end */}

        {/*
          `role="search"` only reaches react-native-screens as
          `systemItem: 'search'`, the legacy UITabBarItem. The iOS 26 SDK gave
          that item the detached search chrome for free; the iOS 27 SDK does
          not, which is why the tab started rendering inline. The detached
          placement now comes from UISearchTab, which react-native-screens
          builds only when the native `role` prop is set, and iOS 27 keys the
          detachment off `automaticallyActivatesSearch`. expo-router does not
          forward either prop yet, so both go through `unstable_nativeProps`.
          `automaticallyActivatesSearch` also needs a native header search bar,
          which (b.search)/index.tsx already declares via <Stack.SearchBar>.
          Needs react-native-screens >= 4.29.0 (4.26.x has no UISearchTab).
        */}
        <NativeTabs.Trigger
          name="(b.search)"
          role="search"
          unstable_nativeProps={{
            ios: {
              role: 'search',
              automaticallyActivatesSearch: true,
            },
          }}
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
      </NativeTabs>
    </View>
  );
}
// @ai-end

// @ai-start
function AndroidTabs() {
  const {t} = useTranslation();
  const hideMiniPlayer = useHideMiniPlayerOnMoments();
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
        <Tabs.Screen name="(a.home)" options={{title: t('tabs.home')}} />
        <Tabs.Screen name="(b.surahs)" options={{title: t('tabs.surahs')}} />
        <Tabs.Screen name="(d.moments)" options={{title: t('tabs.moments')}} />
        <Tabs.Screen name="(b.search)" options={{title: t('tabs.search')}} />
        <Tabs.Screen
          name="(c.collection)"
          options={{title: t('tabs.collection')}}
        />
      </Tabs>
      {!hideMiniPlayer && <FloatingPlayer />}
    </View>
  );
}
// @ai-end

/**
 * Tablet shell: leading sidebar (rail in portrait, labeled in landscape)
 * with the mini player docked in the sidebar footer. Replaces both the iOS
 * NativeTabs and the Android floating pill when `isTablet` is true.
 */
// @ai-start
function TabletTabs() {
  const {t} = useTranslation();
  return (
    <View style={[{flex: 1}, forceLTR]}>
      <Tabs
        initialRouteName="(a.home)"
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
        <Tabs.Screen name="(d.moments)" options={{title: t('tabs.moments')}} />
        <Tabs.Screen name="(b.search)" options={{title: t('tabs.search')}} />
        <Tabs.Screen
          name="(c.collection)"
          options={{title: t('tabs.collection')}}
        />
      </Tabs>
    </View>
  );
}
// @ai-end

export default function TabsLayout() {
  const {isDarkMode} = useTheme();
  const {isTablet} = useResponsive();

  return (
    <>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
      <MomentsTabTracker /* @ai */ />
      {isTablet ? <TabletTabs /> : USE_GLASS ? <IOSTabs /> : <AndroidTabs />}
    </>
  );
}
