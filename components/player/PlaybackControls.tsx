import React from 'react';
import {View, TouchableOpacity, Text} from 'react-native';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import TrackPlayer, {usePlaybackState, State} from 'react-native-track-player';
import {PlayIcon, PauseIcon, PreviousIcon, NextIcon} from '@/components/Icons';
import {Theme} from '@/utils/themeUtils';

const PlaybackControls: React.FC = () => {
  const {theme} = useTheme();
  const styles = createStyles(theme);
  const playbackState = usePlaybackState();

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
          <PreviousIcon color={theme.colors.text} size={moderateScale(28)} />
        </TouchableOpacity>
        <View style={styles.playPauseContainer}>
          <TouchableOpacity
            activeOpacity={0.99}
            onPress={handlePlayPause}
            style={styles.playPauseButton}>
            {playbackState.state === State.Playing ? (
              <PauseIcon color={theme.colors.text} size={moderateScale(36)} />
            ) : (
              <PlayIcon color={theme.colors.text} size={moderateScale(36)} />
            )}
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          onPress={handleNext}
          style={styles.sideButton}
          activeOpacity={0.99}>
          <NextIcon color={theme.colors.text} size={moderateScale(28)} />
        </TouchableOpacity>
      </View>
      <TouchableOpacity onPress={handleSeekForward} activeOpacity={0.99}>
        <Text style={styles.seekText}>15+</Text>
      </TouchableOpacity>
    </View>
  );
};

// Styles remain unchanged
const createStyles = (theme: Theme) =>
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
      backgroundColor: 'transparent',
      borderRadius: moderateScale(32),
      width: moderateScale(64),
      height: moderateScale(64),
      justifyContent: 'center',
      alignItems: 'center',
    },
    sideButton: {
      marginHorizontal: moderateScale(8),
    },
    seekText: {
      fontSize: moderateScale(15),
      fontWeight: 'bold',
      color: theme.colors.text,
    },
  });

export default PlaybackControls;
