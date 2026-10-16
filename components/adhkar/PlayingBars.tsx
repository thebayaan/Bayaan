// Three small bars: moving while adhkar plays, still when paused or when
// Reduce Motion is on.
import React, {useEffect} from 'react';
import {View} from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import {moderateScale} from 'react-native-size-matters';

const BAR_DELAYS = [0, 180, 360];
const STILL_SCALES = [0.5, 0.9, 0.65];

function Bar({
  value,
  color,
  width,
  height,
}: {
  value: SharedValue<number>;
  color: string;
  width: number;
  height: number;
}): React.JSX.Element {
  const style = useAnimatedStyle(() => ({
    transform: [{scaleY: value.value}],
  }));
  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: width / 2,
          backgroundColor: color,
          // Grow from the baseline, not the middle.
          transformOrigin: 'bottom',
        },
        style,
      ]}
    />
  );
}

export function PlayingBars({
  animating,
  color,
  size = moderateScale(12),
}: {
  animating: boolean;
  color: string;
  size?: number;
}): React.JSX.Element {
  const reduceMotion = useReducedMotion();
  const a = useSharedValue(STILL_SCALES[0]);
  const b = useSharedValue(STILL_SCALES[1]);
  const c = useSharedValue(STILL_SCALES[2]);

  useEffect(() => {
    const values = [a, b, c];
    values.forEach((v, i) => {
      cancelAnimation(v);
      if (animating && !reduceMotion) {
        v.value = withDelay(
          BAR_DELAYS[i],
          withRepeat(withTiming(1, {duration: 420}), -1, true),
        );
      } else {
        v.value = withTiming(STILL_SCALES[i], {duration: 150});
      }
    });
  }, [animating, reduceMotion, a, b, c]);

  const width = Math.max(2, Math.round(size / 5));
  return (
    <View
      testID="dhikr-playing-bars"
      style={{
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: width / 1.5,
        height: size,
      }}>
      {[a, b, c].map((v, i) => (
        <Bar key={i} value={v} color={color} width={width} height={size} />
      ))}
    </View>
  );
}
