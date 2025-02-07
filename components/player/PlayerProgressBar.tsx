import React, {useCallback, useState, useEffect} from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {Slider} from '@miblanchard/react-native-slider';
import {usePlayerStore} from '@/store/playerStore';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale} from 'react-native-size-matters';
import {useProgress} from 'react-native-track-player';
import {usePlayerColors} from '@/hooks/usePlayerColors';

const PlayerProgressBar: React.FC = React.memo(() => {
  const {seekTo} = usePlayerStore();
  const {theme} = useTheme();
  const playerColors = usePlayerColors();

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
        <Text
          style={[
            styles.timeText,
            {color: playerColors?.text || theme.colors.text},
          ]}>
          {formatTime(displayPosition)}
        </Text>
        <Text
          style={[
            styles.timeText,
            {color: playerColors?.text || theme.colors.text},
          ]}>
          {'-'} {formatTime(progress.duration - displayPosition)}
        </Text>
      </View>
      <Slider
        value={progress.duration > 0 ? displayPosition / progress.duration : 0}
        onValueChange={handleValueChange}
        onSlidingComplete={handleSlidingComplete}
        minimumTrackTintColor={playerColors?.text || theme.colors.text}
        maximumTrackTintColor={`${playerColors?.text || theme.colors.text}4D`}
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
