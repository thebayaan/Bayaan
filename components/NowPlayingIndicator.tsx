import React, {useEffect} from 'react';
import {View, StyleSheet} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withDelay,
  withSequence,
  interpolate,
  Easing,
  Extrapolation,
} from 'react-native-reanimated';
import {moderateScale} from 'react-native-size-matters';
import {LinearGradient} from 'expo-linear-gradient';
import {getRandomColors} from '@/utils/gradientColors';

// Create an animatable version of LinearGradient
const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

interface NowPlayingIndicatorProps {
  isPlaying: boolean;
  color?: string;
  barCount?: number;
  gap?: number;
  barWidth?: number;
  animationDuration?: number;
  surahId?: number; // Optional ID to keep consistent colors
}

const MAX_BAR_HEIGHT = moderateScale(16);
const MIN_BAR_HEIGHT = moderateScale(3);

export const NowPlayingIndicator: React.FC<NowPlayingIndicatorProps> = ({
  isPlaying,
  barCount = 3,
  gap = moderateScale(2),
  barWidth = moderateScale(3),
  animationDuration = 1200,
  surahId, // Use this to keep consistent colors if provided
}) => {
  const styles = createStyles();

  // Get random gradient colors and memoize them so they don't change on re-renders
  const gradientColors = React.useMemo(
    () => getRandomColors(surahId),
    [surahId],
  );

  // Create shared values for each bar position individually
  const progress1 = useSharedValue(0);
  const progress2 = useSharedValue(0);
  const progress3 = useSharedValue(0);

  // Collect shared values into arrays for easier manipulation
  const progressArray = React.useMemo(() => {
    return [progress1, progress2, progress3].slice(0, barCount);
  }, [barCount, progress1, progress2, progress3]);

  useEffect(() => {
    if (isPlaying) {
      progressArray.forEach((progress, index) => {
        const baseDuration = animationDuration;
        const smoothEasing = Easing.inOut(Easing.cubic);
        let sequence: Parameters<typeof withSequence>[0];

        // Define different sequences based on bar index
        switch (index % 3) {
          case 0: // Bar 1: Mostly Short
            sequence = [
              withTiming(0.1, {
                duration: baseDuration * 0.2,
                easing: smoothEasing,
              }), // Start low
              withTiming(0.4, {
                duration: baseDuration * 0.3,
                easing: smoothEasing,
              }), // Brief rise
              withTiming(0.5, {
                duration: baseDuration * 0.2,
                easing: smoothEasing,
              }), // Low peak
              withTiming(0.2, {
                duration: baseDuration * 0.3,
                easing: smoothEasing,
              }), // Back low
            ];
            break;
          case 1: // Bar 2: Mostly Tall
            sequence = [
              withTiming(0.8, {
                duration: baseDuration * 0.2,
                easing: smoothEasing,
              }), // Start high
              withTiming(1.0, {
                duration: baseDuration * 0.2,
                easing: smoothEasing,
              }), // Peak
              withTiming(0.9, {
                duration: baseDuration * 0.2,
                easing: smoothEasing,
              }), // Stay high
              withTiming(0.7, {
                duration: baseDuration * 0.2,
                easing: smoothEasing,
              }), // Dip slightly
              withTiming(0.8, {
                duration: baseDuration * 0.2,
                easing: smoothEasing,
              }), // Back high
            ];
            break;
          case 2: // Bar 3: Mostly Short (similar to Bar 1, slightly different timing)
          default:
            sequence = [
              withTiming(0.2, {
                duration: baseDuration * 0.25,
                easing: smoothEasing,
              }), // Start low
              withTiming(0.5, {
                duration: baseDuration * 0.25,
                easing: smoothEasing,
              }), // Brief rise
              withTiming(0.3, {
                duration: baseDuration * 0.3,
                easing: smoothEasing,
              }), // Stay low
              withTiming(0.1, {
                duration: baseDuration * 0.2,
                easing: smoothEasing,
              }), // Back low
            ];
            break;
        }

        // Apply delay based on index
        const delay = (index * 150) % (animationDuration / 2); // Slightly adjusted delay

        progress.value = withDelay(
          delay,
          withRepeat(withSequence(...sequence), -1, false),
        );
      });
    } else {
      progressArray.forEach(progress => {
        progress.value = withTiming(0, {duration: animationDuration / 3});
      });
    }
  }, [isPlaying, animationDuration, progressArray]);

  // Pre-create animated styles
  const animatedStyle1 = useAnimatedStyle(() => {
    // Sequence for case 0: [0.1, 0.4, 0.5, 0.2] -> Max value is 0.5
    const heightMultiplier = 0.5; // Match max value in sequence
    const minScale = MIN_BAR_HEIGHT / MAX_BAR_HEIGHT;
    const maxScale = heightMultiplier; // Set maxScale to the actual peak

    const scaleY = interpolate(
      progress1.value,
      [0.1, 0.2, 0.4, 0.5], // Input range based on sequence values
      [
        minScale, // Corresponds to 0.1
        minScale + (maxScale - minScale) * (0.2 / 0.5), // Corresponds to 0.2
        minScale + (maxScale - minScale) * (0.4 / 0.5), // Corresponds to 0.4
        maxScale, // Corresponds to 0.5 (the max peak)
      ],
      Extrapolation.CLAMP, // Clamp to avoid issues if value goes outside range briefly
    );
    const opacity = interpolate(
      progress1.value,
      [0.1, 0.5], // Simpler opacity range
      [0.7, 0.9],
      Extrapolation.CLAMP,
    );

    return {
      transform: [{scaleY: isPlaying ? scaleY : minScale}],
      opacity,
      width: barWidth,
    };
  });

  const animatedStyle2 = useAnimatedStyle(() => {
    // Sequence for case 1: [0.8, 1.0, 0.9, 0.7, 0.8] -> Max value is 1.0
    const heightMultiplier = 1.0; // Match max value in sequence
    const minScale = MIN_BAR_HEIGHT / MAX_BAR_HEIGHT;
    const maxScale = heightMultiplier;

    const scaleY = interpolate(
      progress2.value,
      [0.7, 0.8, 0.9, 1.0], // Input range based on sequence values
      [
        minScale + (maxScale - minScale) * 0.7,
        minScale + (maxScale - minScale) * 0.8,
        minScale + (maxScale - minScale) * 0.9,
        maxScale, // Corresponds to 1.0
      ],
      Extrapolation.CLAMP,
    );
    const opacity = interpolate(
      progress2.value,
      [0.7, 1.0], // Simpler opacity range
      [0.8, 1.0],
      Extrapolation.CLAMP,
    );

    return {
      transform: [{scaleY: isPlaying ? scaleY : minScale}],
      opacity,
      width: barWidth,
    };
  });

  const animatedStyle3 = useAnimatedStyle(() => {
    // Sequence for case 2: [0.2, 0.5, 0.3, 0.1] -> Max value is 0.5
    const heightMultiplier = 0.5; // Match max value in sequence
    const minScale = MIN_BAR_HEIGHT / MAX_BAR_HEIGHT;
    const maxScale = heightMultiplier;

    const scaleY = interpolate(
      progress3.value,
      [0.1, 0.2, 0.3, 0.5], // Input range based on sequence values
      [
        minScale, // Corresponds to 0.1
        minScale + (maxScale - minScale) * (0.2 / 0.5),
        minScale + (maxScale - minScale) * (0.3 / 0.5),
        maxScale, // Corresponds to 0.5
      ],
      Extrapolation.CLAMP,
    );
    const opacity = interpolate(
      progress3.value,
      [0.1, 0.5],
      [0.7, 0.9],
      Extrapolation.CLAMP,
    );

    return {
      transform: [{scaleY: isPlaying ? scaleY : minScale}],
      opacity,
      width: barWidth,
    };
  });

  // Collect animated styles
  const animatedStyles = [animatedStyle1, animatedStyle2, animatedStyle3].slice(
    0,
    barCount,
  );

  const renderBars = () => {
    return progressArray.map((_, i) => {
      return (
        <AnimatedLinearGradient
          key={i}
          colors={[gradientColors[0], gradientColors[1]]}
          start={{x: 0, y: 0}}
          end={{x: 0, y: 1}}
          style={[
            styles.bar, // Base styles (height, borderRadius)
            {marginRight: i < barCount - 1 ? gap : 0},
            animatedStyles[i], // Animated styles (transform: scaleY, opacity, width)
          ]}
        />
      );
    });
  };

  return <View style={styles.container}>{renderBars()}</View>;
};

const createStyles = () =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      height: MAX_BAR_HEIGHT,
      justifyContent: 'center',
      overflow: 'hidden',
    },
    bar: {
      height: MAX_BAR_HEIGHT,
      borderRadius: moderateScale(2),
    },
  });
