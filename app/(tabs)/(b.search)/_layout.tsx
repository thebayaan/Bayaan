import React from 'react';
import {Platform, View} from 'react-native';
import {Stack} from 'expo-router';
import {useTheme} from '@/hooks/useTheme';

const EmptyHeaderBackground = () => <View />;

export default function SearchLayout() {
  const {theme} = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        freezeOnBlur: true,
      }}>
      <Stack.Screen
        name="index"
        options={
          Platform.OS === 'ios'
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
          ...(Platform.OS === 'ios'
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
          ...(Platform.OS === 'ios'
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
          ...(Platform.OS === 'ios'
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
          ...(Platform.OS === 'ios'
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
  );
}
