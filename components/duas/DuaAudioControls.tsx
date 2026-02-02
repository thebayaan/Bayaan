/**
 * DuaAudioControls Component
 *
 * Audio playback controls for dua reading screen.
 * Displays play/pause button, seekable progress slider, and time display.
 */

import React from 'react';
import {View, Text, TouchableOpacity, ActivityIndicator} from 'react-native';
import {Icon} from '@rneui/themed';
import Slider from '@react-native-community/slider';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {useDuaAudio} from '@/hooks/useDuaAudio';
import {Theme} from '@/utils/themeUtils';
import Color from 'color';

interface DuaAudioControlsProps {
  audioFile: string | null;
}

export const DuaAudioControls: React.FC<DuaAudioControlsProps> = React.memo(
  ({audioFile}) => {
    const {theme} = useTheme();
    const styles = createStyles(theme);

    const {
      isPlaying,
      isLoaded,
      progress,
      currentTimeFormatted,
      durationFormatted,
      toggle,
      seekToProgress,
    } = useDuaAudio(audioFile);

    // Handle no audio available
    if (!audioFile) {
      return (
        <View style={styles.container}>
          <View style={styles.noAudioContainer}>
            <Icon
              name="volume-x"
              type="feather"
              size={moderateScale(18)}
              color={theme.colors.textSecondary}
            />
            <Text style={styles.noAudioText}>No audio available</Text>
          </View>
        </View>
      );
    }

    // Handle slider value change
    const handleSliderChange = (value: number) => {
      seekToProgress(value);
    };

    return (
      <View style={styles.container}>
        {/* Play/Pause Button */}
        <TouchableOpacity
          style={styles.playButton}
          onPress={toggle}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={isPlaying ? 'Pause audio' : 'Play audio'}
          accessibilityState={{disabled: !isLoaded}}>
          {!isLoaded ? (
            <ActivityIndicator
              size="small"
              color={theme.colors.primary}
              style={styles.loader}
            />
          ) : (
            <Icon
              name={isPlaying ? 'pause' : 'play'}
              type="feather"
              size={moderateScale(22)}
              color={theme.colors.primary}
            />
          )}
        </TouchableOpacity>

        {/* Progress Slider */}
        <View style={styles.sliderContainer}>
          <Slider
            style={styles.slider}
            value={progress}
            onSlidingComplete={handleSliderChange}
            minimumValue={0}
            maximumValue={1}
            minimumTrackTintColor={theme.colors.primary}
            maximumTrackTintColor={Color(theme.colors.textSecondary)
              .alpha(0.3)
              .toString()}
            thumbTintColor={theme.colors.primary}
            disabled={!isLoaded}
          />
        </View>

        {/* Time Display */}
        <View style={styles.timeContainer}>
          <Text style={styles.timeText}>
            {currentTimeFormatted} / {durationFormatted}
          </Text>
        </View>
      </View>
    );
  },
);

DuaAudioControls.displayName = 'DuaAudioControls';

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: Color(theme.colors.card).alpha(0.8).toString(),
      borderRadius: moderateScale(12),
      paddingVertical: moderateScale(10),
      paddingHorizontal: moderateScale(12),
      borderWidth: 1,
      borderColor: Color(theme.colors.border).alpha(0.15).toString(),
    },
    playButton: {
      width: moderateScale(44),
      height: moderateScale(44),
      borderRadius: moderateScale(22),
      backgroundColor: Color(theme.colors.primary).alpha(0.15).toString(),
      justifyContent: 'center',
      alignItems: 'center',
    },
    loader: {
      width: moderateScale(22),
      height: moderateScale(22),
    },
    sliderContainer: {
      flex: 1,
      marginHorizontal: moderateScale(12),
    },
    slider: {
      width: '100%',
      height: moderateScale(32),
    },
    timeContainer: {
      minWidth: moderateScale(70),
      alignItems: 'flex-end',
    },
    timeText: {
      fontSize: moderateScale(12),
      fontFamily: theme.fonts.medium,
      color: theme.colors.textSecondary,
    },
    noAudioContainer: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: moderateScale(8),
      paddingVertical: moderateScale(6),
    },
    noAudioText: {
      fontSize: moderateScale(13),
      fontFamily: theme.fonts.regular,
      color: theme.colors.textSecondary,
    },
  });
