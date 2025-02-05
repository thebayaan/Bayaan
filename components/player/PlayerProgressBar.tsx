import React, {useCallback, useState, useEffect} from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {Slider} from '@miblanchard/react-native-slider';
import {usePlayerStore} from '@/store/playerStore';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale} from 'react-native-size-matters';
import {useProgress} from 'react-native-track-player';
import Color from 'color';
import {usePlayerBackground} from '@/hooks/usePlayerBackground';

const PlayerProgressBar: React.FC = React.memo(() => {
  const {seekTo} = usePlayerStore();
  const {theme} = useTheme();
  const {gradientColors} = usePlayerBackground(theme, theme.isDarkMode);

  // Calculate contrasting colors based on background
  const baseColor = Color(gradientColors[0]);
  const contrastColor = baseColor.isLight()
    ? baseColor.darken(0.7)
    : baseColor.lighten(3.9);
  const secondaryColor = baseColor.isLight()
    ? baseColor.darken(0.3)
    : baseColor.lighten(1.2);

  // Reduce update frequency to 500ms
  const progress = useProgress(500);

  // Local state for optimistic updates
  const [localPosition, setLocalPosition] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);

  // Update local position when not seeking
  useEffect(() => {
    if (!isSeeking) {
      setLocalPosition(progress.position);
    }
  }, [progress.position, isSeeking]);

  const handleValueChange = useCallback(
    (values: number[]) => {
      if (progress.duration > 0) {
        const newPosition = values[0] * progress.duration;
        // Update local position immediately
        setLocalPosition(newPosition);
        setIsSeeking(true);
      }
    },
    [progress.duration],
  );

  const handleSlidingComplete = useCallback(
    async (values: number[]) => {
      if (progress.duration > 0) {
        const newPosition = values[0] * progress.duration;
        await seekTo(newPosition);
        setIsSeeking(false);
      }
    },
    [seekTo, progress.duration],
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

  // Use local position for UI updates
  const displayPosition = isSeeking ? localPosition : progress.position;

  return (
    <View style={styles.container}>
      <View style={styles.timeContainer}>
        <Text style={[styles.timeText, {color: contrastColor.string()}]}>
          {formatTime(displayPosition)}
        </Text>
        <Text style={[styles.timeText, {color: contrastColor.string()}]}>
          {'-'} {formatTime(progress.duration - displayPosition)}
        </Text>
      </View>
      <Slider
        value={progress.duration > 0 ? displayPosition / progress.duration : 0}
        onValueChange={handleValueChange}
        onSlidingComplete={handleSlidingComplete}
        minimumTrackTintColor={contrastColor.string()}
        maximumTrackTintColor={secondaryColor.alpha(0.3).string()}
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

PlayerProgressBar.displayName = 'PlayerProgressBar';

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

export default PlayerProgressBar;
