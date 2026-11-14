import React from 'react';
import {Stack} from 'expo-router';
import {useTranslation} from 'react-i18next';
import {useTheme} from '@/hooks/useTheme';
import {USE_GLASS} from '@/hooks/useGlassProps';

// The hifz screens: today's plan, plan settings, memory map, quizzes, the
// look-alike trainer and recitation history.
export const unstable_settings = {initialRouteName: 'index'};

export default function HifzLayout(): React.JSX.Element {
  const {theme} = useTheme();
  const {t} = useTranslation('reader');
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerTintColor: theme.colors.text,
        ...(USE_GLASS
          ? {
              headerTransparent: true,
              headerStyle: {backgroundColor: 'transparent'},
            }
          : {headerStyle: {backgroundColor: theme.colors.background}}),
        headerTitleStyle: {
          fontFamily: 'Manrope-SemiBold',
          color: theme.colors.text,
        },
        headerShadowVisible: false,
        headerBackButtonDisplayMode: 'minimal',
        contentStyle: {backgroundColor: theme.colors.background},
      }}>
      <Stack.Screen name="index" options={{title: t('hifz.title')}} />
      <Stack.Screen name="setup" options={{title: t('hifz.settings')}} />
      <Stack.Screen name="heatmap" options={{title: t('hifz.heatmap')}} />
      <Stack.Screen name="quiz" options={{title: t('hifz.quizzes')}} />
      <Stack.Screen
        name="mutashabihat"
        options={{title: t('hifz.mutashabihat')}}
      />
      <Stack.Screen name="history" options={{title: t('hifz.history')}} />
    </Stack>
  );
}
