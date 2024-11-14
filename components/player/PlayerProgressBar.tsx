import React, {useEffect, useCallback} from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {Slider} from 'react-native-awesome-slider';
import {usePlayerStore} from '@/store/playerStore';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale} from 'react-native-size-matters';
import {useProgress} from 'react-native-track-player';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

const PlayerProgressBar: React.FC = React.memo(() => {
  const {seekTo} = usePlayerStore();
  const {theme} = useTheme();
  const progress = useProgress(100);

  const progressValue = useSharedValue(0);
  const min = useSharedValue(0);
  const max = useSharedValue(1);
  const isSliding = useSharedValue(false);
  const thumbSize = useSharedValue(moderateScale(8));

  const animatedThumbStyle = useAnimatedStyle(() => ({
    width: thumbSize.value,
    height: thumbSize.value,
    borderRadius: thumbSize.value / 2,
  }));

  useEffect(() => {
    if (!isSliding.value) {
      if (progress.duration > 0) {
        progressValue.value = progress.position / progress.duration;
      } else {
        console.log('Duration is 0, cannot update progress');
      }
    }
  }, [progress.position, progress.duration, isSliding, progressValue]);

  const formatTime = useCallback((seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}:${minutes < 10 ? '0' : ''}${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
    } else {
      return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
    }
  }, []);

  const handleSlidingStart = useCallback(() => {
    isSliding.value = true;
    thumbSize.value = withTiming(moderateScale(14), {duration: 200});
  }, [isSliding, thumbSize]);

  const handleSlidingComplete = useCallback(
    (value: number) => {
      isSliding.value = false;
      thumbSize.value = withTiming(moderateScale(10), {duration: 100});
      if (progress.duration > 0) {
        seekTo(value * progress.duration);
      }
    },
    [seekTo, progress.duration, isSliding, thumbSize],
  );

  return (
    <View style={styles.container}>
      <View style={styles.timeContainer}>
        <Text style={[styles.timeText, {color: theme.colors.text}]}>
          {formatTime(progress.position)}
        </Text>
        <Text style={[styles.timeText, {color: theme.colors.text}]}>
          {'-'} {formatTime(progress.duration - progress.position)}
        </Text>
      </View>
      <Slider
        progress={progressValue}
        minimumValue={min}
        maximumValue={max}
        onSlidingStart={handleSlidingStart}
        onSlidingComplete={handleSlidingComplete}
        theme={{
          minimumTrackTintColor: theme.colors.text,
          maximumTrackTintColor: theme.colors.border,
          bubbleBackgroundColor: theme.colors.text,
        }}
        renderThumb={() => (
          <Animated.View
            style={[{backgroundColor: theme.colors.text}, animatedThumbStyle]}
          />
        )}
        renderBubble={() => null}
        sliderHeight={moderateScale(3)}
        bubbleWidth={8}
        containerStyle={{borderRadius: moderateScale(10)}}
      />
    </View>
  );
});

PlayerProgressBar.displayName = 'PlayerProgressBar';

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
  },
  timeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: moderateScale(5),
  },
  timeText: {
    fontSize: moderateScale(12),
    opacity: 0.75,
    fontWeight: '500',
  },
});

export default PlayerProgressBar;
