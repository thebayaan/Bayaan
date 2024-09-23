import React from 'react';
import {View, TouchableOpacity} from 'react-native';
import {Icon} from '@rneui/themed';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale, ScaledSheet} from 'react-native-size-matters';
import {usePlayerStore} from '@/store/playerStore';
import TrackPlayer from 'react-native-track-player';

const PlayerControls = () => {
  const {theme} = useTheme();
  const {isPlaying, togglePlayback} = usePlayerStore();

  const skipBackward = async () => {
    try {
      const progress = await TrackPlayer.getProgress();
      await TrackPlayer.seekTo(Math.max(0, progress.position - 10));
    } catch (error) {
      console.error('Error skipping backward:', error);
    }
  };

  const skipForward = async () => {
    try {
      const progress = await TrackPlayer.getProgress();
      await TrackPlayer.seekTo(
        Math.min(progress.duration, progress.position + 10),
      );
    } catch (error) {
      console.error('Error skipping forward:', error);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={skipBackward}>
        <Icon
          name="replay-10"
          type="material"
          size={moderateScale(40)}
          color={theme.colors.text}
        />
      </TouchableOpacity>
      <TouchableOpacity onPress={togglePlayback} style={styles.playPauseButton}>
        <Icon
          name={isPlaying ? 'pause' : 'play-arrow'}
          type="material"
          size={moderateScale(50)}
          color={theme.colors.text}
        />
      </TouchableOpacity>
      <TouchableOpacity onPress={skipForward}>
        <Icon
          name="forward-10"
          type="material"
          size={moderateScale(40)}
          color={theme.colors.text}
        />
      </TouchableOpacity>
    </View>
  );
};

const styles = ScaledSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    width: '100%',
  },
  playPauseButton: {
    backgroundColor: 'primary',
    borderRadius: 30,
    padding: 10,
  },
});

export default PlayerControls;
