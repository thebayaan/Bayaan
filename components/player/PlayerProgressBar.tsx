import React, {useEffect, useCallback} from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {Slider} from 'react-native-awesome-slider';
import {usePlayerStore} from '@/store/playerStore';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale} from 'react-native-size-matters';
import {useSharedValue} from 'react-native-reanimated';
import {useProgress} from 'react-native-track-player';

const PlayerProgressBar: React.FC = React.memo(() => {
  const {seekTo} = usePlayerStore();
  const {theme} = useTheme();
  const progress = useProgress(100);

  const progressValue = useSharedValue(0);
  const min = useSharedValue(0);
  const max = useSharedValue(1);
  const isSliding = useSharedValue(false);

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
  }, [isSliding]);

  const handleSlidingComplete = useCallback(
    (value: number) => {
      isSliding.value = false;
      if (progress.duration > 0) {
        seekTo(value * progress.duration);
      }
    },
    [seekTo, progress.duration, isSliding],
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
          minimumTrackTintColor: theme.colors.primary,
          maximumTrackTintColor: theme.colors.border,
          bubbleBackgroundColor: theme.colors.primary,
        }}
        thumbWidth={0}
        renderBubble={() => null}
        sliderHeight={moderateScale(1.5)}
        bubbleWidth={5}
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
