import React from 'react';
import {Platform, View, ViewProps, StyleSheet} from 'react-native';
import {BlurView} from 'expo-blur';
import {useTheme} from '@/hooks/useTheme';

type FrostedViewProps = ViewProps & {
  children?: React.ReactNode;
};

/**
 * Frosted glass fallback for non-liquid-glass devices.
 * iOS: BlurView with frosted effect.
 * Android: solid View with theme card background.
 */
export function FrostedView({style, children, ...rest}: FrostedViewProps) {
  const {theme} = useTheme();

  if (Platform.OS === 'ios') {
    return (
      <BlurView
        style={style}
        intensity={80}
        tint={theme.isDarkMode ? 'dark' : 'light'}
        {...rest}>
        {children}
      </BlurView>
    );
  }

  return (
    <View
      style={StyleSheet.flatten([{backgroundColor: theme.colors.card}, style])}
      {...rest}>
      {children}
    </View>
  );
}
