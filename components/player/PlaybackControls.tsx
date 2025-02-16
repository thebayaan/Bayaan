import React from 'react';
import {View, TouchableOpacity, Text} from 'react-native';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {State as TrackPlayerState} from 'react-native-track-player';
import {
  PlayIcon,
  PauseIcon,
  PreviousIcon,
  NextIcon,
  SeekForwardIcon,
  SeekBackwardIcon,
} from '@/components/Icons';
import {usePlayerColors} from '@/hooks/usePlayerColors';
import {useUnifiedPlayer} from '@/hooks/useUnifiedPlayer';

interface PlaybackControlsProps {
  seekSeconds?: number;
  isPlaying?: boolean;
  onPlayPause?: () => void;
  surahId?: string;
}

const PlaybackControls: React.FC<PlaybackControlsProps> = ({
  seekSeconds = 15,
  isPlaying: isPlayingProp,
  onPlayPause,
}) => {
  const {theme} = useTheme();
  const playerColors = usePlayerColors();
  const {
    playback,
    queue,
    loading,
    play,
    pause,
    skipToNext,
    skipToPrevious,
    seekTo,
  } = useUnifiedPlayer();

  const styles = createStyles();

  const handlePlayPause = () => {
    if (onPlayPause) {
      onPlayPause();
    } else if (playback.state === TrackPlayerState.Playing) {
      pause();
    } else {
      play();
    }
  };

  const handlePrevious = async () => {
    await skipToPrevious();
  };

  const handleNext = async () => {
    await skipToNext();
  };

  const handleSeekBackward = async () => {
    await seekTo(Math.max(0, playback.position - seekSeconds));
  };

  const handleSeekForward = async () => {
    await seekTo(playback.position + seekSeconds);
  };

  const isFirstTrack = queue.currentIndex === 0;
  const isLastTrack = queue.currentIndex === queue.tracks.length - 1;
  const isPlaying =
    isPlayingProp ?? playback.state === TrackPlayerState.Playing;

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={handleSeekBackward} activeOpacity={0.99}>
        <View style={styles.seekBackwardContainer}>
          <SeekBackwardIcon
            color={playerColors?.text || theme.colors.text}
            size={moderateScale(24)}
          />
          <Text
            style={[
              styles.seekBackwardText,
              {color: playerColors?.text || theme.colors.text},
            ]}>
            {seekSeconds}
          </Text>
        </View>
      </TouchableOpacity>
      <View style={styles.centerControls}>
        <TouchableOpacity
          onPress={handlePrevious}
          style={styles.sideButton}
          disabled={isFirstTrack || loading.trackLoading}
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
            disabled={loading.trackLoading}
            style={styles.playPauseButton}>
            {isPlaying ? (
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
          disabled={isLastTrack || loading.trackLoading}
          activeOpacity={0.99}>
          <NextIcon
            color={playerColors?.text || theme.colors.text}
            size={moderateScale(28)}
          />
        </TouchableOpacity>
      </View>
      <TouchableOpacity onPress={handleSeekForward} activeOpacity={0.99}>
        <View style={styles.seekForwardContainer}>
          <SeekForwardIcon
            color={playerColors?.text || theme.colors.text}
            size={moderateScale(24)}
          />
          <Text
            style={[
              styles.seekForwardText,
              {color: playerColors?.text || theme.colors.text},
            ]}>
            {seekSeconds}
          </Text>
        </View>
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
    seekForwardContainer: {
      position: 'relative',
      alignItems: 'flex-end',
      justifyContent: 'flex-end',
      paddingHorizontal: moderateScale(1),
    },
    seekForwardText: {
      position: 'absolute',
      fontSize: moderateScale(14),
      fontWeight: '700',
      bottom: moderateScale(-2),
      backgroundColor: 'transparent',
      lineHeight: moderateScale(14),
    },
    seekBackwardContainer: {
      position: 'relative',
      alignItems: 'flex-start',
      justifyContent: 'flex-end',
      paddingHorizontal: moderateScale(1),
    },
    seekBackwardText: {
      position: 'absolute',
      fontSize: moderateScale(13),
      fontWeight: '700',
      bottom: moderateScale(-2),
      backgroundColor: 'transparent',
      lineHeight: moderateScale(13),
      textAlign: 'center',
      paddingRight: moderateScale(4),
    },
  });

export default PlaybackControls;
