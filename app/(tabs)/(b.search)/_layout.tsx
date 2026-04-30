import React from 'react';
import {View} from 'react-native';
import {Stack} from 'expo-router';
import {useTheme} from '@/hooks/useTheme';
import {USE_GLASS} from '@/hooks/useGlassProps';
import {MaxWidthContainer} from '@/components/layout/MaxWidthContainer';

const EmptyHeaderBackground = () => <View />;

export default function SearchLayout() {
  const {theme} = useTheme();

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
                headerTitle: 'Browse All',
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
                headerTitle: 'All Surahs',
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
