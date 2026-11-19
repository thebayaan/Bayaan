import React, {useCallback, useState} from 'react';
import {View, Pressable, Text, StyleSheet} from 'react-native';
import {moderateScale} from '@/utils/scale';
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
// @ai-start
import {localizeDigits} from '@/i18n/format';
import {forceLTR} from '@/utils/rtl';
import {usePlayerA11y} from '@/hooks/usePlayerA11y'; // @ai
import {isActivelyPlaying} from '@/services/player/utils/isActivelyPlaying';
import {seekBy} from '@/components/player/v2/seekBy';
// @ai-end

const SEEK_INTERVAL = 15; // seconds

// @ai-start
export const Controls = () => {
  const {theme} = useTheme();
  const a11y = usePlayerA11y(); // @ai
  const {play, pause, skipToNext, skipToPrevious} = usePlayerActions();
  const playbackState = usePlayerStore(s => s.playback.state);
  const currentIndex = usePlayerStore(s => s.queue.currentIndex);
  const tracksLength = usePlayerStore(s => s.queue.tracks.length);
  const trackLoading = usePlayerStore(s => s.loading.trackLoading);
  const repeatMode = usePlayerStore(s => s.settings.repeatMode);
  // Next has nowhere to go from the last track, unless Repeat All takes it
  // round to the first one, as the end of a track and Previous already do.
  // It used to be greyed out on the last track with Repeat All on.
  const nextDisabled =
    trackLoading ||
    (currentIndex === tracksLength - 1 && repeatMode !== 'queue');

  // Optimistic state for play/pause. A stalled stream ('buffering') still
  // counts as playing, so the button shows Pause and the first tap pauses.
  const [optimisticIsPlaying, setOptimisticIsPlaying] = useState(() =>
    isActivelyPlaying(playbackState),
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
    setOptimisticIsPlaying(isActivelyPlaying(playbackState));
  }, [playbackState]);

  const handlePrevious = useCallback(async () => {
    if (trackLoading) return;
    await skipToPrevious();
  }, [trackLoading, skipToPrevious]);

  const handleNext = useCallback(async () => {
    if (nextDisabled) return;
    await skipToNext();
  }, [nextDisabled, skipToNext]);

  // @ai-start
  // seekBy() jumps from where the audio really is; the store's position can
  // be two seconds old. The position is read at the press, so the controls
  // do not render on every position tick.
  const handleSeekBackward = useCallback(async () => {
    if (trackLoading) return;
    await seekBy(-SEEK_INTERVAL);
  }, [trackLoading]);

  const handleSeekForward = useCallback(async () => {
    if (trackLoading) return;
    await seekBy(SEEK_INTERVAL);
  }, [trackLoading]);
  // @ai-end

  return (
    <View style={[styles.container, forceLTR]}>
      <Pressable
        onPress={handleSeekBackward}
        {...a11y.skipBack(SEEK_INTERVAL, trackLoading)}
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
            {localizeDigits(SEEK_INTERVAL)}
          </Text>
        </View>
      </Pressable>
      <View style={styles.centerControls}>
        <Pressable
          onPress={handlePrevious}
          {...a11y.previous(trackLoading)}
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
            {...a11y.playPause(optimisticIsPlaying, trackLoading)}
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
          {...a11y.next(nextDisabled)}
          style={[styles.sideButton, nextDisabled && styles.disabledButton]}
          disabled={nextDisabled}>
          <NextIcon
            color={
              nextDisabled ? theme.colors.textSecondary : theme.colors.text
            }
            size={moderateScale(16)}
          />
        </Pressable>
      </View>
      <Pressable
        onPress={handleSeekForward}
        {...a11y.skipForward(SEEK_INTERVAL, trackLoading)}
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
            {localizeDigits(SEEK_INTERVAL)}
          </Text>
        </View>
      </Pressable>
    </View>
  );
};
// @ai-end

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
