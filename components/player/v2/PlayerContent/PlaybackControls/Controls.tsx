import React, {useCallback, useState} from 'react';
import {View, Pressable, Text, StyleSheet} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {usePlayerActions} from '@/hooks/usePlayerActions';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {
  PlayIcon,
  PauseIcon,
  PreviousIcon,
  NextIcon,
  SeekForwardIcon,
  SeekBackwardIcon,
} from '@/components/Icons';

const SEEK_INTERVAL = 15; // seconds

export const Controls = () => {
  const {theme} = useTheme();
  const {play, pause, skipToNext, skipToPrevious, seekTo} = usePlayerActions();
  const playbackState = usePlayerStore(s => s.playback.state);
  const playbackPosition = usePlayerStore(s => s.playback.position);
  const currentIndex = usePlayerStore(s => s.queue.currentIndex);
  const tracksLength = usePlayerStore(s => s.queue.tracks.length);
  const trackLoading = usePlayerStore(s => s.loading.trackLoading);

  // Optimistic state for play/pause
  const [optimisticIsPlaying, setOptimisticIsPlaying] = useState(
    () => playbackState === 'playing',
  );

  const handlePlayPause = useCallback(async () => {
    if (trackLoading) return;

    // Update optimistic state immediately
    const newIsPlaying = !optimisticIsPlaying;
    setOptimisticIsPlaying(newIsPlaying);

    try {
      // Perform the actual action
      if (newIsPlaying) {
        await play();
      } else {
        await pause();
      }
    } catch (error) {
      // Revert optimistic update on error
      setOptimisticIsPlaying(!newIsPlaying);
      console.error('Error toggling play/pause:', error);
    }
  }, [trackLoading, optimisticIsPlaying, pause, play]);

  // Update optimistic state when actual state changes
  React.useEffect(() => {
    setOptimisticIsPlaying(playbackState === 'playing');
  }, [playbackState]);

  const handlePrevious = useCallback(async () => {
    if (trackLoading) return;
    await skipToPrevious();
  }, [trackLoading, skipToPrevious]);

  const handleNext = useCallback(async () => {
    if (trackLoading || currentIndex === tracksLength - 1) return;
    await skipToNext();
  }, [trackLoading, currentIndex, tracksLength, skipToNext]);

  const handleSeekBackward = useCallback(async () => {
    if (trackLoading) return;
    await seekTo(Math.max(0, playbackPosition - SEEK_INTERVAL));
  }, [trackLoading, playbackPosition, seekTo]);

  const handleSeekForward = useCallback(async () => {
    if (trackLoading) return;
    await seekTo(playbackPosition + SEEK_INTERVAL);
  }, [trackLoading, playbackPosition, seekTo]);

  const isLastTrack = currentIndex === tracksLength - 1;

  return (
    <View style={styles.container}>
      <Pressable
        onPress={handleSeekBackward}
        disabled={trackLoading}
        style={trackLoading && styles.disabledButton}>
        <View style={styles.seekBackwardContainer}>
          <SeekBackwardIcon
            color={
              trackLoading ? theme.colors.textSecondary : theme.colors.text
            }
            size={moderateScale(24)}
          />
          <Text
            style={[
              styles.seekBackwardText,
              {
                color: trackLoading
                  ? theme.colors.textSecondary
                  : theme.colors.text,
              },
            ]}>
            {SEEK_INTERVAL}
          </Text>
        </View>
      </Pressable>
      <View style={styles.centerControls}>
        <Pressable
          onPress={handlePrevious}
          style={[styles.sideButton, trackLoading && styles.disabledButton]}
          disabled={trackLoading}>
          <PreviousIcon
            color={
              trackLoading ? theme.colors.textSecondary : theme.colors.text
            }
            size={moderateScale(16)}
          />
        </Pressable>
        <View style={styles.playPauseContainer}>
          <Pressable
            onPress={handlePlayPause}
            disabled={trackLoading}
            style={styles.playPauseButton}>
            {optimisticIsPlaying ? (
              <PauseIcon color={theme.colors.text} size={moderateScale(32)} />
            ) : (
              <PlayIcon color={theme.colors.text} size={moderateScale(32)} />
            )}
          </Pressable>
        </View>
        <Pressable
          onPress={handleNext}
          style={[styles.sideButton, isLastTrack && styles.disabledButton]}
          disabled={isLastTrack || trackLoading}>
          <NextIcon
            color={isLastTrack ? theme.colors.textSecondary : theme.colors.text}
            size={moderateScale(16)}
          />
        </Pressable>
      </View>
      <Pressable
        onPress={handleSeekForward}
        disabled={trackLoading}
        style={trackLoading && styles.disabledButton}>
        <View style={styles.seekForwardContainer}>
          <SeekForwardIcon
            color={
              trackLoading ? theme.colors.textSecondary : theme.colors.text
            }
            size={moderateScale(24)}
          />
          <Text
            style={[
              styles.seekForwardText,
              {
                color: trackLoading
                  ? theme.colors.textSecondary
                  : theme.colors.text,
              },
            ]}>
            {SEEK_INTERVAL}
          </Text>
        </View>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
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
    marginHorizontal: moderateScale(12),
    marginLeft: moderateScale(20),
  },
  playPauseButton: {
    padding: moderateScale(8),
  },
  sideButton: {
    padding: moderateScale(8),
  },
  disabledButton: {
    opacity: 0.5,
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
