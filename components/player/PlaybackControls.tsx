import React from 'react';
import {View, TouchableOpacity, Text} from 'react-native';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import TrackPlayer, {usePlaybackState, State} from 'react-native-track-player';
import {PlayIcon, PauseIcon, PreviousIcon, NextIcon} from '@/components/Icons';
import {usePlayerColors} from '@/hooks/usePlayerColors';

const PlaybackControls: React.FC = () => {
  const {theme} = useTheme();
  const playerColors = usePlayerColors();
  const playbackState = usePlaybackState();

  const styles = createStyles();

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
        <Text
          style={[
            styles.seekText,
            {color: playerColors?.text || theme.colors.text},
          ]}>
          -15
        </Text>
      </TouchableOpacity>
      <View style={styles.centerControls}>
        <TouchableOpacity
          onPress={handlePrevious}
          style={styles.sideButton}
          activeOpacity={0.99}>
          <PreviousIcon
            color={playerColors?.text || theme.colors.text}
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
                color={playerColors?.text || theme.colors.text}
                size={moderateScale(36)}
              />
            ) : (
              <PlayIcon
                color={playerColors?.text || theme.colors.text}
                size={moderateScale(36)}
              />
            )}
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          onPress={handleNext}
          style={styles.sideButton}
          activeOpacity={0.99}>
          <NextIcon
            color={playerColors?.text || theme.colors.text}
            size={moderateScale(28)}
          />
        </TouchableOpacity>
      </View>
      <TouchableOpacity onPress={handleSeekForward} activeOpacity={0.7}>
        <Text
          style={[
            styles.seekText,
            {color: playerColors?.text || theme.colors.text},
          ]}>
          15+
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const createStyles = () =>
  ScaledSheet.create({
    container: {
      flexDirection: 'row',
      justifyContent: 'space-evenly',
      alignItems: 'center',
      width: '100%',
      paddingHorizontal: moderateScale(16),
    },
    centerControls: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      flex: 1,
    },
    playPauseContainer: {
      marginHorizontal: moderateScale(24),
    },
    playPauseButton: {
      padding: moderateScale(8),
    },
    sideButton: {
      padding: moderateScale(8),
    },
    seekText: {
      fontSize: moderateScale(16),
      fontWeight: '500',
    },
  });

export default PlaybackControls;
