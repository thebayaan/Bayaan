import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import {moderateScale, verticalScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {ReciterImage} from '@/components/ReciterImage';
import {PlayIcon} from '@/components/Icons';
import Color from 'color';
import {LinearGradient} from 'expo-linear-gradient';
import {useProgress} from 'react-native-track-player';
import {Slider} from '@miblanchard/react-native-slider';
import {useSharedValue} from 'react-native-reanimated';
import {getReciterById, getSurahById} from '@/services/dataService';
import {createTracksForReciter} from '@/utils/track';
import {useUnifiedPlayer} from '@/services/player/store/playerStore';
import {QueueContext} from '@/services/queue/QueueContext';
import TrackPlayer from 'react-native-track-player';
import {useRecentlyPlayedStore} from '@/services/player/store/recentlyPlayedStore';

interface RecentReciterCardProps {
  imageUrl?: string;
  reciterName: string;
  surahName: string;
  trackId: string;
  reciterId: string;
  surahId: number;
  progress: number;
  duration: number;
  isRecent?: boolean;
}

export const RecentReciterCard = React.memo(
  ({
    imageUrl,
    reciterName,
    surahName,
    trackId,
    reciterId,
    surahId,
    progress,
    duration,
    isRecent = false,
  }: RecentReciterCardProps) => {
    const {theme} = useTheme();
    const {queue, updateQueue, play} = useUnifiedPlayer();
    const queueContext = QueueContext.getInstance();
    const {addRecentTrack} = useRecentlyPlayedStore();
    const isCurrentTrack = queue.tracks[queue.currentIndex]?.id === trackId;

    // Create animated shared value for progress
    const animatedProgress = useSharedValue(progress);
    const isVisible = React.useRef(true);

    // Only subscribe to progress updates for current track if it's the most recent card
    const trackProgress = useProgress(
      isCurrentTrack && isRecent ? 10000 : undefined,
    );

    // Memoize time remaining calculation
    const timeRemaining = React.useMemo(() => {
      const effectiveDuration = isCurrentTrack
        ? trackProgress.duration
        : duration;
      let remainingSeconds = effectiveDuration;

      if (effectiveDuration > 0) {
        if (isCurrentTrack && isRecent) {
          remainingSeconds = effectiveDuration - trackProgress.position;
        } else {
          remainingSeconds = effectiveDuration * (1 - progress);
        }
      }

      if (remainingSeconds <= 0) return '0m';

      const totalMinutes = Math.round(remainingSeconds / 60);
      if (totalMinutes >= 60) {
        const hours = Math.round(totalMinutes / 60);
        return `${hours}h`;
      }
      return `${totalMinutes}m`;
    }, [
      isCurrentTrack,
      isRecent,
      trackProgress.duration,
      trackProgress.position,
      duration,
      progress,
    ]);

    // Optimize animation frame updates - only animate for current & recent track
    React.useEffect(() => {
      // Skip animation frames for non-recent cards unless they're the current track
      if (!isRecent && !isCurrentTrack) {
        animatedProgress.value = progress;
        return;
      }

      let frameId: number;

      if (isCurrentTrack && trackProgress.duration > 0 && isVisible.current) {
        frameId = requestAnimationFrame(() => {
          'worklet';
          animatedProgress.value =
            trackProgress.position / trackProgress.duration;
        });
      } else {
        frameId = requestAnimationFrame(() => {
          'worklet';
          animatedProgress.value = progress;
        });
      }

      return () => {
        if (frameId) {
          cancelAnimationFrame(frameId);
        }
      };
    }, [
      isCurrentTrack,
      isRecent,
      trackProgress.position,
      trackProgress.duration,
      progress,
      animatedProgress,
    ]);

    // Memoize press handler
    const handlePress = React.useCallback(async () => {
      try {
        const [reciter, surah] = await Promise.all([
          getReciterById(reciterId),
          getSurahById(surahId),
        ]);

        if (!reciter || !surah) {
          console.error('Could not find reciter or surah');
          return;
        }

        const tracks = await createTracksForReciter(
          reciter,
          [surah],
          reciter.rewayat[0]?.id,
        );

        const startPosition = isCurrentTrack
          ? trackProgress.position
          : progress * duration;

        await updateQueue(tracks, 0);
        await play();
        await addRecentTrack(reciter, surah, progress, duration);

        queueContext.setCurrentReciter(reciter);

        if (startPosition > 0) {
          await TrackPlayer.seekTo(startPosition);
        }

        queueContext.batchLoader.loadNextBatchIfNeeded(reciter);
      } catch (error) {
        console.error('Error playing surah:', error);
      }
    }, [
      reciterId,
      surahId,
      isCurrentTrack,
      trackProgress.position,
      progress,
      duration,
      updateQueue,
      play,
      addRecentTrack,
      queueContext,
    ]);

    // Memoize styles
    const styles = React.useMemo(
      () =>
        StyleSheet.create({
          container: {
            width: moderateScale(200),
            height: moderateScale(280),
            borderRadius: moderateScale(20),
            shadowColor: theme.colors.shadow,
            overflow: 'hidden',
            backgroundColor: theme.colors.background,
          },
          gradient: {
            ...StyleSheet.absoluteFillObject,
          },
          content: {
            flex: 1,
            padding: moderateScale(16),
          },
          imageContainer: {
            width: '100%',
            height: moderateScale(160),
            borderRadius: moderateScale(16),
            marginBottom: verticalScale(12),
            overflow: 'hidden',
            shadowColor: theme.colors.shadow,
            shadowOffset: {width: 0, height: 4},
            shadowOpacity: 0.2,
            shadowRadius: 8,
          },
          image: {
            width: '100%',
            height: '100%',
            borderRadius: moderateScale(16),
          },
          textContainer: {
            flex: 1,
          },
          reciterName: {
            fontSize: moderateScale(18),
            fontWeight: '700',
            color: theme.colors.text,
            marginBottom: verticalScale(4),
          },
          surahName: {
            fontSize: moderateScale(14),
            color: theme.colors.textSecondary,
          },
          progressSection: {
            flexDirection: 'row',
            alignItems: 'center',
            marginTop: moderateScale(8),
            backgroundColor: Color(theme.colors.primary).alpha(0.1).toString(),
            borderRadius: moderateScale(20),
            paddingVertical: moderateScale(4),
            paddingHorizontal: moderateScale(8),
            gap: moderateScale(8),
            width: moderateScale(100),
            alignSelf: 'flex-start',
          },
          sliderContainer: {
            height: moderateScale(6),
            flex: 1,
          },
          timeRemaining: {
            fontSize: moderateScale(12),
            color: theme.colors.text,
            minWidth: moderateScale(30),
            fontWeight: 'bold',
          },
          playButton: {
            marginLeft: moderateScale(2),
          },
        }),
      [theme],
    );

    return (
      <TouchableOpacity
        activeOpacity={0.99}
        style={styles.container}
        onPress={handlePress}>
        <LinearGradient
          colors={[
            Color(theme.colors.primary).alpha(0.03).toString(),
            Color(theme.colors.primary).alpha(0.01).toString(),
          ]}
          style={styles.gradient}
        />
        <View style={styles.content}>
          <View style={styles.imageContainer}>
            <ReciterImage
              imageUrl={imageUrl}
              reciterName={reciterName}
              style={styles.image}
            />
          </View>
          <View style={styles.textContainer}>
            <Text style={styles.reciterName} numberOfLines={1}>
              {reciterName}
            </Text>
            <Text style={styles.surahName} numberOfLines={1}>
              {surahName}
            </Text>
            <View style={styles.progressSection}>
              <TouchableOpacity
                activeOpacity={0.99}
                style={styles.playButton}
                onPress={handlePress}>
                <PlayIcon
                  color={theme.colors.text}
                  size={moderateScale(16)}
                  filled={isCurrentTrack}
                />
              </TouchableOpacity>
              <Slider
                value={animatedProgress.value}
                disabled={true}
                minimumTrackTintColor={theme.colors.primary}
                maximumTrackTintColor={Color(theme.colors.primary)
                  .alpha(0.2)
                  .toString()}
                trackStyle={{
                  height: moderateScale(6),
                  borderRadius: moderateScale(3),
                }}
                thumbStyle={{height: 0, width: 0}}
                containerStyle={styles.sliderContainer}
              />
              <Text style={styles.timeRemaining}>{timeRemaining}</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.imageUrl === nextProps.imageUrl &&
      prevProps.reciterName === nextProps.reciterName &&
      prevProps.surahName === nextProps.surahName &&
      prevProps.trackId === nextProps.trackId &&
      prevProps.progress === nextProps.progress &&
      prevProps.duration === nextProps.duration &&
      prevProps.isRecent === nextProps.isRecent
    );
  },
);

RecentReciterCard.displayName = 'RecentReciterCard';
