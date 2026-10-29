import {Stack, useRouter, useSegments} from 'expo-router';
import {useTheme} from '@/hooks/useTheme';
import {USE_GLASS} from '@/hooks/useGlassProps';
import branding from '@/config/branding';
// @ai-start
import React, {useCallback} from 'react';
import {StyleSheet, View} from 'react-native';
import Color from 'color';
import {useTranslation} from 'react-i18next';
import {useResponsive} from '@/hooks/useResponsive';
import {capScreensExcept} from '@/components/layout/MaxWidthContainer';
import {TabletSettingsListPane} from '@/components/settings/TabletSettingsList';
import {
  SETTINGS_LIST_WIDTH,
  SETTINGS_PAGE_MAX_WIDTH,
  SETTINGS_SPLIT_MIN_WIDTH,
  selectedSettingsRoute,
  settingsHref,
  settingsSplitNav,
} from '@/components/settings/settingsItems';
// @ai-end

// A deep link (widget, Live Activity, App Link) that opens a screen in this
// stack lands on top of its first screen, so back always has a target.
export const unstable_settings = {initialRouteName: 'index'};

// @ai-start
// Every page sits in the 640pt settings column on iPad (ipad-standards §5.3).
const SCREEN_LAYOUT = capScreensExcept([], SETTINGS_PAGE_MAX_WIDTH);

export default function SettingsLayout() {
  const {theme} = useTheme();
  const {t} = useTranslation(['settings', 'common']);
  const {isTablet, width} = useResponsive();
  const split = isTablet && width >= SETTINGS_SPLIT_MIN_WIDTH;
  const router = useRouter();
  const segments = useSegments();
  const last = segments[segments.length - 1];
  const current = !last || last === '(d.settings)' ? 'index' : last;

  // In the split, picking a row swaps the page beside the list.
  const openPage = useCallback(
    (routeName: string) => {
      const nav = settingsSplitNav(routeName, current);
      if (nav.kind === 'home' || nav.kind === 'reset') {
        router.dismissAll();
      }
      if (nav.kind === 'push' || nav.kind === 'reset') {
        router.push(settingsHref(nav.routeName));
      } else if (nav.kind === 'replace') {
        router.replace(settingsHref(nav.routeName));
      }
    },
    [current, router],
  );

  // Pages beside the list are siblings: they swap in place, with no back
  // button or swipe back to the page that was there before.
  const pageOptions = (title: string) =>
    split
      ? {
          title,
          animation: 'none' as const,
          headerBackVisible: false,
          gestureEnabled: false,
        }
      : {title};

  const stack = (
    <Stack
      screenLayout={isTablet ? SCREEN_LAYOUT : undefined}
      screenOptions={{
        headerShown: true,
        freezeOnBlur: true,
        headerTintColor: theme.colors.text,
        ...(USE_GLASS
          ? {
              headerTransparent: true,
              headerStyle: {backgroundColor: 'transparent'},
            }
          : {
              headerStyle: {backgroundColor: theme.colors.background},
            }),
        headerTitleStyle: {
          fontFamily: 'Manrope-SemiBold',
          color: theme.colors.text,
        },
        headerShadowVisible: false,
        headerBackButtonDisplayMode: 'minimal',
      }}>
      {/* In the split, the first screen shows the default page. */}
      <Stack.Screen
        name="index"
        options={
          split
            ? {headerShown: true, title: t('layout.mushafSettings')}
            : {headerShown: false}
        }
      />
      <Stack.Screen name="storage" options={pageOptions(t('layout.storage'))} />
      <Stack.Screen
        name="about"
        options={pageOptions(t('layout.about', {appName: branding.appName}))}
      />
      <Stack.Screen name="credits" options={pageOptions(t('layout.credits'))} />
      <Stack.Screen
        name="mushaf-settings"
        options={pageOptions(t('layout.mushafSettings'))}
      />
      <Stack.Screen
        name="default-reciter"
        options={pageOptions(t('layout.defaultReciter'))}
      />
      <Stack.Screen
        name="reciter-choice"
        options={pageOptions(t('layout.reciterChoice'))}
      />
      <Stack.Screen
        name="translations"
        options={pageOptions(t('layout.translations'))}
      />
      {/* Opened from inside Mushaf settings, so it keeps its back button. */}
      <Stack.Screen
        name="reading-theme"
        options={{title: t('layout.readingTheme')}}
      />
      <Stack.Screen
        name="whats-new"
        options={pageOptions(t('layout.whatsNew'))}
      />
      <Stack.Screen
        name="language"
        options={pageOptions(t('common:language.title'))}
      />
    </Stack>
  );

  if (!split) {
    return stack;
  }
  return (
    <View style={[styles.split, {backgroundColor: theme.colors.background}]}>
      <View
        style={[
          styles.list,
          {borderEndColor: Color(theme.colors.text).alpha(0.08).toString()},
        ]}>
        <TabletSettingsListPane
          onOpenPage={openPage}
          selectedRoute={selectedSettingsRoute(current)}
        />
      </View>
      <View style={styles.page}>{stack}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  split: {
    flex: 1,
    flexDirection: 'row',
  },
  list: {
    width: SETTINGS_LIST_WIDTH,
    borderEndWidth: StyleSheet.hairlineWidth,
  },
  page: {
    flex: 1,
    minWidth: 0,
  },
});
// @ai-end
