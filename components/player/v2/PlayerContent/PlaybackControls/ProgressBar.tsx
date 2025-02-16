import React, {useCallback, useMemo} from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {Slider} from '@miblanchard/react-native-slider';
import {moderateScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {useUnifiedPlayer} from '@/hooks/useUnifiedPlayer';
import {useProgress} from '@/services/player/store/progressStore';

export const ProgressBar = React.memo(() => {
  const {theme} = useTheme();
  const {seekTo} = useUnifiedPlayer();
  const progress = useProgress();

  // Memoize the current position to reduce re-renders
  const currentPosition = useMemo(() => {
    return progress.seekPosition ?? progress.position;
  }, [progress.seekPosition, progress.position]);

  const handleValueChange = useCallback(
    (values: number[]) => {
      if (progress.duration > 0) {
        const newPosition = values[0] * progress.duration;
        // Update seekPosition immediately for optimistic UI
        progress.setSeekPosition(newPosition);
        if (!progress.isSeeking) {
          progress.setIsSeeking(true);
        }
      }
    },
    [progress],
  );

  const handleSlidingComplete = useCallback(
    async (values: number[]) => {
      if (progress.duration > 0) {
        const newPosition = values[0] * progress.duration;
        try {
          await seekTo(newPosition);
        } finally {
          // Reset seeking state regardless of seek success
          progress.setIsSeeking(false);
          progress.setSeekPosition(null);
        }
      }
    },
    [progress, seekTo],
  );

  const formatTime = useCallback((seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}:${minutes < 10 ? '0' : ''}${minutes}:${
        remainingSeconds < 10 ? '0' : ''
      }${remainingSeconds}`;
    } else {
      return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
    }
  }, []);

  // Memoize slider value to prevent unnecessary re-renders
  const sliderValue = useMemo(() => {
    return progress.duration > 0 ? currentPosition / progress.duration : 0;
  }, [currentPosition, progress.duration]);

  return (
    <View style={styles.container}>
      <View style={styles.timeContainer}>
        <Text style={[styles.timeText, {color: theme.colors.text}]}>
          {formatTime(currentPosition)}
        </Text>
        <Text style={[styles.timeText, {color: theme.colors.text}]}>
          {'-'} {formatTime(progress.duration - currentPosition)}
        </Text>
      </View>
      <Slider
        value={sliderValue}
        onValueChange={handleValueChange}
        onSlidingComplete={handleSlidingComplete}
        minimumTrackTintColor={theme.colors.text}
        maximumTrackTintColor={`${theme.colors.text}4D`}
        trackStyle={{
          height: moderateScale(8),
          borderRadius: moderateScale(4),
        }}
        thumbStyle={{height: 0, width: 0}}
        containerStyle={styles.sliderContainer}
      />
    </View>
  );
});

ProgressBar.displayName = 'ProgressBar';

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingHorizontal: moderateScale(10),
  },
  timeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: moderateScale(8),
  },
  timeText: {
    fontSize: moderateScale(12),
  },
  sliderContainer: {
    height: moderateScale(8),
  },
});
