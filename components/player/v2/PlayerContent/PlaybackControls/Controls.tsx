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
  const playback = usePlayerStore(s => s.playback);
  const queue = usePlayerStore(s => s.queue);
  const loading = usePlayerStore(s => s.loading);

  // Optimistic state for play/pause
  const [optimisticIsPlaying, setOptimisticIsPlaying] = useState(
    () => playback.state === 'playing',
  );

  const handlePlayPause = useCallback(async () => {
    if (loading.trackLoading) return;

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
  }, [loading.trackLoading, optimisticIsPlaying, pause, play]);

  // Update optimistic state when actual state changes
  React.useEffect(() => {
    setOptimisticIsPlaying(playback.state === 'playing');
  }, [playback.state]);

  const handlePrevious = useCallback(async () => {
    if (loading.trackLoading || queue.currentIndex === 0) return;
    await skipToPrevious();
  }, [loading.trackLoading, queue.currentIndex, skipToPrevious]);

  const handleNext = useCallback(async () => {
    if (loading.trackLoading || queue.currentIndex === queue.tracks.length - 1)
      return;
    await skipToNext();
  }, [
    loading.trackLoading,
    queue.currentIndex,
    queue.tracks.length,
    skipToNext,
  ]);

  const handleSeekBackward = useCallback(async () => {
    if (loading.trackLoading) return;
    await seekTo(Math.max(0, playback.position - SEEK_INTERVAL));
  }, [loading.trackLoading, playback.position, seekTo]);

  const handleSeekForward = useCallback(async () => {
    if (loading.trackLoading) return;
    await seekTo(playback.position + SEEK_INTERVAL);
  }, [loading.trackLoading, playback.position, seekTo]);

  const isFirstTrack = queue.currentIndex === 0;
  const isLastTrack = queue.currentIndex === queue.tracks.length - 1;

  return (
    <View style={styles.container}>
      <Pressable
        onPress={handleSeekBackward}
        disabled={loading.trackLoading}
        style={loading.trackLoading && styles.disabledButton}>
        <View style={styles.seekBackwardContainer}>
          <SeekBackwardIcon
            color={
              loading.trackLoading
                ? theme.colors.textSecondary
                : theme.colors.text
            }
            size={moderateScale(24)}
          />
          <Text
            style={[
              styles.seekBackwardText,
              {
                color: loading.trackLoading
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
          style={[styles.sideButton, isFirstTrack && styles.disabledButton]}
          disabled={isFirstTrack || loading.trackLoading}>
          <PreviousIcon
            color={
              isFirstTrack ? theme.colors.textSecondary : theme.colors.text
            }
            size={moderateScale(16)}
          />
        </Pressable>
        <View style={styles.playPauseContainer}>
          <Pressable
            onPress={handlePlayPause}
            disabled={loading.trackLoading}
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
          disabled={isLastTrack || loading.trackLoading}>
          <NextIcon
            color={isLastTrack ? theme.colors.textSecondary : theme.colors.text}
            size={moderateScale(16)}
          />
        </Pressable>
      </View>
      <Pressable
        onPress={handleSeekForward}
        disabled={loading.trackLoading}
        style={loading.trackLoading && styles.disabledButton}>
        <View style={styles.seekForwardContainer}>
          <SeekForwardIcon
            color={
              loading.trackLoading
                ? theme.colors.textSecondary
                : theme.colors.text
            }
            size={moderateScale(24)}
          />
          <Text
            style={[
              styles.seekForwardText,
              {
                color: loading.trackLoading
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
