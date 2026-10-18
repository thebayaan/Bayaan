import React, {useEffect, useRef} from 'react';
import {Animated, Easing, Text, View} from 'react-native';
import {useToastStore} from '../../store/toastStore';
import {colors} from '../../theme/colors';
import {fonts} from '../../theme/typography';
import {createScaledStyles} from '../../theme/scale';

/**
 * The app's toast (see toastStore): a quiet pill near the bottom of the
 * screen. It takes no focus and no presses, so whatever has focus keeps it.
 */
export function Toast(): React.ReactElement | null {
  const toast = useToastStore(s => s.toast);
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!toast) return;
    opacity.setValue(0);
    const anim = Animated.timing(opacity, {
      toValue: 1,
      duration: 200,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [toast, opacity]);

  if (!toast) return null;
  return (
    <View style={styles.wrap} pointerEvents="none">
      <Animated.View
        style={[styles.pill, {opacity}]}
        accessibilityLiveRegion="polite"
        accessibilityRole="alert">
        <View style={[styles.dot, toast.kind === 'error' && styles.dotError]} />
        <Text style={styles.text} numberOfLines={2}>
          {toast.message}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = createScaledStyles({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 64,
    alignItems: 'center',
    zIndex: 80,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    maxWidth: 960,
    paddingHorizontal: 28,
    paddingVertical: 18,
    borderRadius: 16,
    borderCurve: 'continuous',
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.accent,
  },
  // A hollow ring for a failure: sky stays the only indicator color.
  dotError: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: colors.accent,
  },
  text: {
    flexShrink: 1,
    color: colors.text,
    fontFamily: fonts.semiBold,
    fontWeight: '600',
    fontSize: 20,
    lineHeight: 28,
  },
});
