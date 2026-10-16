import React from 'react';
import {View} from 'react-native';
import {Stack} from 'expo-router';
// @ai-start
import {useTranslation} from 'react-i18next';
// @ai-end
import {useTheme} from '@/hooks/useTheme';
import {USE_GLASS} from '@/hooks/useGlassProps';
import {MaxWidthContainer} from '@/components/layout/MaxWidthContainer';

const EmptyHeaderBackground = () => <View />;

// A deep link (widget, Live Activity, App Link) that opens a screen in this
// stack lands on top of its first screen, so back always has a target.
export const unstable_settings = {initialRouteName: 'index'};

// @ai-start
export default function SearchLayout() {
  const {theme} = useTheme();
  const {t} = useTranslation('home');

  return (
    <MaxWidthContainer>
      <Stack
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
        <Stack.Screen name="reciter/browse" />
      </Stack>
    </MaxWidthContainer>
  );
}
// @ai-end
