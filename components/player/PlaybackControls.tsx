import React from 'react';
import {View, TouchableOpacity, Text} from 'react-native';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import TrackPlayer, {usePlaybackState, State} from 'react-native-track-player';
import {PlayIcon, PauseIcon, PreviousIcon, NextIcon} from '@/components/Icons';
import {Theme} from '@/utils/themeUtils';
import {usePlayerBackground} from '@/hooks/usePlayerBackground';
import Color from 'color';

const PlaybackControls: React.FC = () => {
  const {theme} = useTheme();
  const {gradientColors} = usePlayerBackground(theme, theme.isDarkMode);
  const playbackState = usePlaybackState();

  // Calculate contrasting colors based on background
  const baseColor = Color(gradientColors[0]);
  const contrastColor = baseColor.isLight()
    ? baseColor.darken(0.7).saturate(0.2)
    : baseColor.lighten(3.9).saturate(0.9);

  const styles = createStyles(theme, contrastColor.string());

  const handlePlayPause = () => {
    if (playbackState.state === State.Playing) {
      TrackPlayer.pause();
    } else {
      TrackPlayer.play();
    }
  };

  const handlePrevious = async () => {
    await TrackPlayer.skipToPrevious();
  };

  const handleNext = async () => {
    await TrackPlayer.skipToNext();
  };

  const handleSeekBackward = async () => {
    const progress = await TrackPlayer.getProgress();
    await TrackPlayer.seekTo(Math.max(0, progress.position - 15));
  };

  const handleSeekForward = async () => {
    const progress = await TrackPlayer.getProgress();
    await TrackPlayer.seekTo(progress.position + 15);
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={handleSeekBackward} activeOpacity={0.99}>
        <Text style={styles.seekText}>-15</Text>
      </TouchableOpacity>
      <View style={styles.centerControls}>
        <TouchableOpacity
          onPress={handlePrevious}
          style={styles.sideButton}
          activeOpacity={0.99}>
          <PreviousIcon
            color={contrastColor.string()}
            size={moderateScale(28)}
          />
        </TouchableOpacity>
        <View style={styles.playPauseContainer}>
          <TouchableOpacity
            activeOpacity={0.99}
            onPress={handlePlayPause}
            style={styles.playPauseButton}>
            {playbackState.state === State.Playing ? (
              <PauseIcon
                color={contrastColor.string()}
                size={moderateScale(36)}
              />
            ) : (
              <PlayIcon
                color={contrastColor.string()}
                size={moderateScale(36)}
              />
            )}
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          onPress={handleNext}
          style={styles.sideButton}
          activeOpacity={0.99}>
          <NextIcon color={contrastColor.string()} size={moderateScale(28)} />
        </TouchableOpacity>
      </View>
      <TouchableOpacity onPress={handleSeekForward} activeOpacity={0.7}>
        <Text style={styles.seekText}>15+</Text>
      </TouchableOpacity>
    </View>
  );
};

const createStyles = (theme: Theme, textColor: string) =>
  ScaledSheet.create({
    container: {
      flexDirection: 'row',
      justifyContent: 'space-evenly',
      alignItems: 'center',
      paddingHorizontal: moderateScale(16),
      marginVertical: moderateScale(16),
    },
    centerControls: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-evenly',
    },
    playPauseContainer: {
      width: moderateScale(10),
      height: moderateScale(20),
      justifyContent: 'center',
      alignItems: 'center',
      marginHorizontal: moderateScale(25),
    },
    playPauseButton: {
      borderRadius: moderateScale(32),
      width: moderateScale(64),
      height: moderateScale(64),
      justifyContent: 'center',
      alignItems: 'center',
      transform: [{scale: 1.1}],
    },
    sideButton: {
      marginHorizontal: moderateScale(8),
      transform: [{scale: 1.05}],
    },
    seekText: {
      fontSize: moderateScale(15),
      fontWeight: 'bold',
      color: textColor,
      opacity: 0.9,
    },
  });

export default PlaybackControls;
