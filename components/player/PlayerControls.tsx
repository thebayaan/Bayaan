import React from 'react';
import {View, TouchableOpacity} from 'react-native';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {Icon} from '@rneui/themed';
import TrackPlayer from 'react-native-track-player';
import {usePlayerStore} from '@/store/playerStore';

const PlayerControls: React.FC = () => {
  const {theme} = useTheme();
  const styles = createStyles();
  const {isPlaying, togglePlayback, seekTo, skipToNext} = usePlayerStore();

  const handlePlayPause = async () => {
    await togglePlayback();
  };

  const handlePrevious = async () => {
    await TrackPlayer.skipToPrevious();
  };

  const handleNext = async () => {
    await skipToNext();
  };

  const handleSeekBackward = async () => {
    const position = await TrackPlayer.getPosition();
    await seekTo(Math.max(0, position - 15));
  };

  const handleSeekForward = async () => {
    const position = await TrackPlayer.getPosition();
    await seekTo(position + 15);
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={handlePrevious}>
        <Icon
          name="controller-jump-to-start"
          type="entypo"
          size={moderateScale(24)}
          color={theme.colors.text}
        />
      </TouchableOpacity>
      <View style={styles.centerControls}>
        <TouchableOpacity onPress={handleSeekBackward}>
          <Icon
            name="rewind-15"
            type="material-community"
            size={moderateScale(24)}
            color={theme.colors.text}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.playPauseButton}
          onPress={handlePlayPause}>
          <Icon
            name={isPlaying ? 'controller-paus' : 'controller-play'}
            type="entypo"
            size={moderateScale(40)}
            color={theme.colors.text}
          />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleSeekForward}>
          <Icon
            name="fast-forward-15"
            type="material-community"
            size={moderateScale(24)}
            color={theme.colors.text}
          />
        </TouchableOpacity>
      </View>
      <TouchableOpacity onPress={handleNext}>
        <Icon
          name="controller-next"
          type="entypo"
          size={moderateScale(24)}
          color={theme.colors.text}
        />
      </TouchableOpacity>
    </View>
  );
};

// Styles remain unchanged
const createStyles = () =>
  ScaledSheet.create({
    container: {
      flexDirection: 'row',
      justifyContent: 'space-evenly',
      alignItems: 'center',
      width: '100%',
    },
    centerControls: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    playPauseButton: {
      backgroundColor: 'transparent',
      borderRadius: moderateScale(32),
      width: moderateScale(64),
      height: moderateScale(64),
      justifyContent: 'center',
      alignItems: 'center',
      marginHorizontal: moderateScale(24),
    },
  });

export default PlayerControls;
