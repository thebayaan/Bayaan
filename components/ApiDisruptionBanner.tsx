import React, {useEffect} from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useApiHealthStore} from '@/store/apiHealthStore';
import {useNetworkStore} from '@/store/networkStore';
import {useDevSettingsStore} from '@/store/devSettingsStore';
import {useTheme} from '@/hooks/useTheme';
import {Feather} from '@expo/vector-icons';
import {moderateScale} from 'react-native-size-matters';
import Color from 'color';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  interpolate,
  runOnJS,
} from 'react-native-reanimated';

const SLIDE_DURATION = 280;

export function ApiDisruptionBanner() {
  const {isDisrupted, usingStaleCache} = useApiHealthStore();
  const isOnline = useNetworkStore(s => s.isOnline);
  const {theme} = useTheme();
  const insets = useSafeAreaInsets();

  const forceNetworkBanner = useDevSettingsStore(s => s.forceNetworkBanner);

  const showBanner = !isOnline || isDisrupted || forceNetworkBanner;
  const isOffline = !isOnline || (forceNetworkBanner && !isDisrupted);

  const progress = useSharedValue(0);
  const [mounted, setMounted] = React.useState(false);

  useEffect(() => {
    if (showBanner) {
      setMounted(true);
      progress.value = withTiming(1, {
        duration: SLIDE_DURATION,
        easing: Easing.out(Easing.cubic),
      });
    } else {
      progress.value = withTiming(
        0,
        {duration: SLIDE_DURATION, easing: Easing.in(Easing.cubic)},
        finished => {
          if (finished) {
            runOnJS(setMounted)(false);
          }
        },
      );
    }
  }, [showBanner, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0, 1]),
    transform: [{translateY: interpolate(progress.value, [0, 1], [-8, 0])}],
  }));

  if (!mounted) return null;

  const icon: React.ComponentProps<typeof Feather>['name'] = isOffline
    ? 'wifi-off'
    : 'alert-circle';

  const label = isOffline
    ? 'No internet connection'
    : usingStaleCache
      ? 'Showing cached data'
      : 'Backend unreachable';

  const pillBg = Color(theme.colors.text).alpha(0.08).toString();
  const pillBorder = Color(theme.colors.text).alpha(0.06).toString();
  const iconColor = Color(theme.colors.text).alpha(0.5).toString();
  const textColor = Color(theme.colors.text).alpha(0.7).toString();

  return (
    <Animated.View
      style={[
        styles.wrapper,
        {top: insets.top + moderateScale(4)},
        animatedStyle,
      ]}
      pointerEvents="none">
      <View
        style={[
          styles.pill,
          {backgroundColor: pillBg, borderColor: pillBorder},
        ]}>
        <Feather name={icon} size={moderateScale(12)} color={iconColor} />
        <Text style={[styles.label, {color: textColor}]}>{label}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 999,
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: moderateScale(6),
    paddingHorizontal: moderateScale(14),
    paddingVertical: moderateScale(7),
    borderRadius: moderateScale(20),
    borderWidth: 1,
  },
  label: {
    fontSize: moderateScale(11.5),
    fontFamily: 'Manrope-Medium',
  },
});
