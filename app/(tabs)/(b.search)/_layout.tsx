import React from 'react';
import {View} from 'react-native';
import {Stack} from 'expo-router';
// @ai-start
import {useTranslation} from 'react-i18next';
// @ai-end
import {useTheme} from '@/hooks/useTheme';
import {USE_GLASS} from '@/hooks/useGlassProps';
import {capScreensExcept} from '@/components/layout/MaxWidthContainer';

const EmptyHeaderBackground = () => <View />;

// Grids and shelves take the whole pane on iPad; other screens stay in the
// 720pt column for now (ipad-standards §5.3). On `index`, Explore and the
// search results fill the pane and recent searches keep that column. @ai
const SCREEN_LAYOUT = capScreensExcept([
  'index',
  'browse-all',
  'reciter/browse',
  'reciter/[id]',
]); // @ai

// A deep link (widget, Live Activity, App Link) that opens a screen in this
// stack lands on top of its first screen, so back always has a target.
export const unstable_settings = {initialRouteName: 'index'};

// @ai-start
export default function SearchLayout() {
  const {theme} = useTheme();
  const {t} = useTranslation('home');

  return (
    <Stack
      screenLayout={SCREEN_LAYOUT} // @ai
      screenOptions={{
        headerShown: false,
        freezeOnBlur: true,
      }}>
      <Stack.Screen
        name="index"
        options={
          USE_GLASS
            ? {
                headerShown: true,
                headerTransparent: true,
                headerStyle: {backgroundColor: 'transparent'},
                headerShadowVisible: false,
                title: '',
                headerBackTitle: ' ',
              }
            : undefined
        }
      />
      <Stack.Screen
        name="browse-all"
        options={{
          ...(USE_GLASS
            ? {
                headerShown: true,
                headerLargeTitle: false,
                headerTransparent: true,
                headerBlurEffect: undefined,
                headerStyle: {backgroundColor: 'transparent'},
                headerShadowVisible: false,
                headerTitle: t('browse.browseAll'),
                headerBackTitle: '',
                headerBackground: EmptyHeaderBackground,
                fullScreenGestureEnabled: false,
              }
            : {headerShown: false}),
        }}
      />
      <Stack.Screen
        name="browse-all-surahs"
        options={{
          ...(USE_GLASS
            ? {
                headerShown: true,
                headerTransparent: true,
                headerBlurEffect: undefined,
                headerStyle: {backgroundColor: 'transparent'},
                headerShadowVisible: false,
                headerTitle: t('browse.allSurahs'),
                headerBackTitle: ' ',
                headerBackButtonDisplayMode: 'minimal',
                fullScreenGestureEnabled: false,
              }
            : {headerShown: false}),
        }}
      />
      <Stack.Screen
        name="system-playlist/[id]"
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
                fullScreenGestureEnabled: false,
              }
            : {headerShown: false}),
        }}
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
      {/* @ai-start */}
      {/* Glass devices need the native header here too: BrowseReciters
          draws no header of its own when USE_GLASS is on, so without it
          the screen had no title or back button. The screen sets the
          title. */}
      <Stack.Screen
        name="reciter/browse"
        options={
          USE_GLASS
            ? {
                headerShown: true,
                headerTransparent: true,
                headerBlurEffect: undefined,
                headerStyle: {backgroundColor: 'transparent'},
                headerShadowVisible: false,
                headerBackTitle: ' ',
                headerBackButtonDisplayMode: 'minimal',
                fullScreenGestureEnabled: false,
              }
            : undefined
        }
      />
      {/* @ai-end */}
    </Stack>
  );
}
// @ai-end
