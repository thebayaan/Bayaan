import React, {useCallback, useMemo, useState} from 'react';
import {View, Text, StyleSheet} from 'react-native';
import Slider from '@react-native-community/slider';
import {moderateScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {usePlayerActions} from '@/hooks/usePlayerActions';
import {useProgress} from '@/services/player/store/progressStore';

export const ProgressBar = React.memo(() => {
  const {theme} = useTheme();
  const {seekTo} = usePlayerActions();
  const progress = useProgress();
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekValue, setSeekValue] = useState(0);

  const displayTime = useMemo(() => {
    if (isSeeking) return seekValue;
    return progress.seekPosition ?? progress.position;
  }, [isSeeking, seekValue, progress.seekPosition, progress.position]);

  const handleSliderStart = useCallback(() => {
    setIsSeeking(true);
    setSeekValue(progress.seekPosition ?? progress.position);
  }, [progress.seekPosition, progress.position]);

  const handleSliderChange = useCallback((value: number) => {
    setSeekValue(value);
  }, []);

  const handleSlidingComplete = useCallback(
    async (value: number) => {
      try {
        progress.setPosition(value);
        await seekTo(value);
      } catch (error) {
        console.error('Error seeking:', error);
      } finally {
        setIsSeeking(false);
      }
    },
    [progress, seekTo],
  );

  const formatTime = useCallback((seconds: number) => {
    if (!isFinite(seconds) || seconds < 0) return '0:00';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds
        .toString()
        .padStart(2, '0')}`;
    } else {
      return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.timeContainer}>
        <Text style={[styles.timeText, {color: theme.colors.text}]}>
          {formatTime(displayTime)}
        </Text>
        <Text style={[styles.timeText, {color: theme.colors.textSecondary}]}>
          {'-'} {formatTime(progress.duration - displayTime)}
        </Text>
      </View>
      <Slider
        style={styles.slider}
        minimumValue={0}
        maximumValue={progress.duration || 1}
        tapToSeek
        value={displayTime}
        onSlidingStart={handleSliderStart}
        onValueChange={handleSliderChange}
        onSlidingComplete={handleSlidingComplete}
        minimumTrackTintColor={theme.colors.text}
        maximumTrackTintColor={`${theme.colors.text}4D`}
        thumbTintColor={isSeeking ? theme.colors.text : 'transparent'}
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
    marginBottom: moderateScale(4),
  },
  timeText: {
    fontSize: moderateScale(12),
  },
  slider: {
    width: '100%',
    height: 40,
  },
});
