import React from 'react';
import {View, StyleSheet} from 'react-native';
import {moderateScale} from '@/utils/scale';
import Animated, {
  useAnimatedStyle,
  interpolate,
  SharedValue,
} from 'react-native-reanimated';
import {useTheme} from '@/hooks/useTheme';

interface DotIndicatorProps {
  totalPages: number;
  scrollX: SharedValue<number>;
  pageWidth: number;
}

// @ai-start
function DotIndicatorComponent({
  totalPages,
  scrollX,
  pageWidth,
}: DotIndicatorProps) {
  const {theme} = useTheme();

  // Someone skipping several releases can get more pages than the row has
  // room for at full size, so shrink the dots until they fit the modal.
  const naturalWidth =
    (totalPages - 1) * (DOT_SIZE_INACTIVE + DOT_GAP) + DOT_SIZE_ACTIVE;
  const fit = naturalWidth > pageWidth ? pageWidth / naturalWidth : 1;

  return (
    <View style={[styles.container, {gap: DOT_GAP * fit}]}>
      {Array.from({length: totalPages}).map((_, i) => (
        <Dot
          key={i}
          index={i}
          scrollX={scrollX}
          pageWidth={pageWidth}
          color={theme.colors.text}
          fit={fit}
        />
      ))}
    </View>
  );
}
// @ai-end

interface DotProps {
  index: number;
  scrollX: SharedValue<number>;
  pageWidth: number;
  color: string;
  /** Scale applied to the dot sizes so the whole row fits (1 = full size). */
  fit: number;
}

const DOT_SIZE_INACTIVE = moderateScale(8);
const DOT_SIZE_ACTIVE = moderateScale(20);
const DOT_GAP = moderateScale(6);

function Dot({index, scrollX, pageWidth, color, fit}: DotProps) {
  const inactiveSize = DOT_SIZE_INACTIVE * fit;
  const activeSize = DOT_SIZE_ACTIVE * fit;

  const animatedStyle = useAnimatedStyle(() => {
    const inputRange = [
      (index - 1) * pageWidth,
      index * pageWidth,
      (index + 1) * pageWidth,
    ];

    const width = interpolate(
      scrollX.value,
      inputRange,
      [inactiveSize, activeSize, inactiveSize],
      'clamp',
    );

    const opacity = interpolate(
      scrollX.value,
      inputRange,
      [0.3, 1, 0.3],
      'clamp',
    );

    return {width, opacity};
  });

  return (
    <Animated.View
      style={[
        {
          height: inactiveSize,
          borderRadius: inactiveSize / 2,
          backgroundColor: color,
        },
        animatedStyle,
      ]}
    />
  );
}

export default React.memo(DotIndicatorComponent);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: moderateScale(16),
  },
});
