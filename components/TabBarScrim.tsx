// @ai-start
import React from 'react';
import {StyleSheet} from 'react-native';
import {LinearGradient} from 'expo-linear-gradient';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTheme} from '@/hooks/useTheme';
import {GLASS_TINT_ALPHA, USE_GLASS} from '@/hooks/useGlassProps';
import {useResponsive} from '@/hooks/useResponsive';

// The tab bar's glass is drawn by iOS and takes no tint, but it bends what
// sits behind it. This dark fade under the bar (and the mini player above it)
// makes that glass read darker. Its strength follows the shared glass tint.
const FADE_HEIGHT = 150;

export function TabBarScrim() {
  const isDark = useTheme().theme.isDarkMode;
  const {bottom} = useSafeAreaInsets();
  // iPad's tab bar sits at the top, so there is nothing to darken below.
  const {isTablet} = useResponsive();
  if (!USE_GLASS || !isDark || isTablet) return null;
  const strength = Math.min(0.9, GLASS_TINT_ALPHA.dark * 2.5);
  return (
    <LinearGradient
      pointerEvents="none"
      colors={['rgba(0,0,0,0)', `rgba(0,0,0,${strength})`]}
      style={[styles.fade, {height: FADE_HEIGHT + bottom}]}
    />
  );
}

/** Wraps a tab's stack layout so the fade sits above its screens. */
export function withTabBarScrim(Layout: React.ComponentType) {
  function LayoutWithTabBarScrim() {
    return (
      <>
        <Layout />
        <TabBarScrim />
      </>
    );
  }
  LayoutWithTabBarScrim.displayName = `withTabBarScrim(${
    Layout.displayName ?? Layout.name
  })`;
  return LayoutWithTabBarScrim;
}

const styles = StyleSheet.create({
  fade: {position: 'absolute', left: 0, right: 0, bottom: 0},
});
// @ai-end
