import React, {useEffect, useCallback} from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {Slider} from 'react-native-awesome-slider';
import {usePlayerControls} from '@/hooks/usePlayerControls';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale} from 'react-native-size-matters';
import {useSharedValue} from 'react-native-reanimated';
import TrackPlayer, {useProgress} from 'react-native-track-player';

const PlayerProgressBar: React.FC = React.memo(() => {
  usePlayerControls();
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
      }
    }
  }, [progress.position, progress.duration, isSliding, progressValue]);

  useEffect(() => {
    const checkPlaybackState = async () => {
      await TrackPlayer.getState();
    };
    checkPlaybackState();
  }, []);

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
    async (value: number) => {
      isSliding.value = false;
      const newPosition = value * progress.duration;
      await TrackPlayer.seekTo(newPosition);
    },
    [progress.duration, isSliding],
  );

  return (
    <View style={styles.container}>
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
      />
      <View style={styles.timeContainer}>
        <Text style={[styles.timeText, {color: theme.colors.text}]}>
          {formatTime(progress.position)}
        </Text>
        <Text style={[styles.timeText, {color: theme.colors.text}]}>
          {'-'} {formatTime(progress.duration - progress.position)}
        </Text>
      </View>
    </View>
  );
});

PlayerProgressBar.displayName = 'PlayerProgressBar';

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingHorizontal: moderateScale(20),
  },
  timeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: moderateScale(5),
  },
  timeText: {
    fontSize: moderateScale(12),
    opacity: 0.75,
    fontWeight: '500',
  },
});

export default PlayerProgressBar;
