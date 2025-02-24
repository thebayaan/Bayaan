import React, {useMemo, useCallback} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import {moderateScale, verticalScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {ReciterImage} from '@/components/ReciterImage';
import {PlayIcon} from '@/components/Icons';
import Color from 'color';
import {LinearGradient} from 'expo-linear-gradient';
import {useProgress, Progress} from 'react-native-track-player';
import {Slider} from '@miblanchard/react-native-slider';
import {useSharedValue} from 'react-native-reanimated';
import {getReciterById, getSurahById} from '@/services/dataService';
import {createTracksForReciter} from '@/utils/track';
import {useUnifiedPlayer} from '@/services/player/store/playerStore';
import {QueueContext} from '@/services/queue/QueueContext';
import TrackPlayer from 'react-native-track-player';
import {useRecentlyPlayedStore} from '@/services/player/store/recentlyPlayedStore';
import {BlurView} from 'expo-blur';
import {Theme} from '@/utils/themeUtils';

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

interface StylesType {
  container: ViewStyle;
  overlay: ViewStyle;
  gradient: ViewStyle;
  content: ViewStyle;
  imageContainer: ViewStyle;
  image: ViewStyle;
  textContainer: ViewStyle;
  reciterName: TextStyle;
  surahName: TextStyle;
  progressSection: ViewStyle;
  sliderContainer: ViewStyle;
  timeRemaining: TextStyle;
  playButton: ViewStyle;
}

interface MemoizedReciterImageProps {
  imageUrl?: string;
  reciterName: string;
  styles: StylesType;
}

// Memoize the ReciterImage component wrapper
const MemoizedReciterImage = React.memo(
  ({imageUrl, reciterName, styles}: MemoizedReciterImageProps) => (
    <View style={styles.imageContainer}>
      <ReciterImage
        imageUrl={imageUrl}
        reciterName={reciterName}
        style={styles.image}
      />
    </View>
  ),
  (prevProps, nextProps) =>
    prevProps.imageUrl === nextProps.imageUrl &&
    prevProps.reciterName === nextProps.reciterName,
);

MemoizedReciterImage.displayName = 'MemoizedReciterImage';

interface ProgressSectionProps {
  progress: number;
  duration: number;
  isCurrentTrack: boolean;
  trackProgress: Progress;
  theme: Theme;
  styles: StylesType;
  onPress: () => void;
}

// Memoize the progress section component
const ProgressSection = React.memo(
  ({
    progress,
    duration,
    isCurrentTrack,
    trackProgress,
    theme,
    styles,
    onPress,
  }: ProgressSectionProps) => {
    const animatedProgress = useSharedValue(progress);
    const isVisible = React.useRef(true);

    // Memoize time remaining calculation
    const timeRemaining = useMemo(() => {
      const effectiveDuration = isCurrentTrack
        ? trackProgress.duration
        : duration;
      let remainingSeconds = effectiveDuration;

      if (effectiveDuration > 0) {
        if (isCurrentTrack) {
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
      trackProgress.duration,
      trackProgress.position,
      duration,
      progress,
    ]);

    // Optimize animation frame updates
    React.useEffect(() => {
      if (!isCurrentTrack) {
        animatedProgress.value = progress;
        return;
      }

      let frameId: number;

      if (trackProgress.duration > 0 && isVisible.current) {
        frameId = requestAnimationFrame(() => {
          'worklet';
          animatedProgress.value =
            trackProgress.position / trackProgress.duration;
        });
      }

      return () => {
        if (frameId) {
          cancelAnimationFrame(frameId);
        }
      };
    }, [
      isCurrentTrack,
      trackProgress.position,
      trackProgress.duration,
      progress,
      animatedProgress,
    ]);

    return (
      <View style={styles.progressSection}>
        <TouchableOpacity
          activeOpacity={0.99}
          style={styles.playButton}
          onPress={onPress}>
          <PlayIcon
            color={theme.colors.text}
            size={moderateScale(12)}
            filled={isCurrentTrack}
          />
        </TouchableOpacity>
        <Slider
          value={animatedProgress.value}
          disabled={true}
          minimumTrackTintColor={Color(theme.colors.primary)
            .alpha(0.9)
            .toString()}
          maximumTrackTintColor={Color(theme.colors.primary)
            .alpha(0.1)
            .toString()}
          trackStyle={{
            height: moderateScale(2.5),
            borderRadius: moderateScale(2),
          }}
          thumbStyle={{height: 0, width: 0}}
          containerStyle={styles.sliderContainer}
        />
        <Text style={styles.timeRemaining}>{timeRemaining}</Text>
      </View>
    );
  },
  (prevProps, nextProps) =>
    prevProps.progress === nextProps.progress &&
    prevProps.duration === nextProps.duration &&
    prevProps.isCurrentTrack === nextProps.isCurrentTrack &&
    prevProps.trackProgress === nextProps.trackProgress &&
    prevProps.onPress === nextProps.onPress,
);

ProgressSection.displayName = 'ProgressSection';

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

    const trackProgress = useProgress(
      isCurrentTrack && isRecent ? 10000 : undefined,
    );

    // Memoize styles
    const styles = useMemo(
      () =>
        StyleSheet.create({
          container: {
            width: moderateScale(130),
            height: moderateScale(180),
            borderRadius: moderateScale(16),
            shadowColor: theme.colors.shadow,
            shadowOffset: {
              width: 0,
              height: moderateScale(8),
            },
            shadowOpacity: 0.25,
            shadowRadius: moderateScale(12),
            overflow: 'hidden',
            borderWidth: 0.5,
            borderColor: Color(theme.colors.border).alpha(0.15).toString(),
          },
          overlay: {
            ...StyleSheet.absoluteFillObject,
            opacity: 0.75,
          },
          gradient: {
            ...StyleSheet.absoluteFillObject,
            opacity: 0.8,
          },
          content: {
            flex: 1,
            padding: moderateScale(8),
            gap: moderateScale(4),
          },
          imageContainer: {
            width: '100%',
            height: moderateScale(90),
            borderRadius: moderateScale(12),
            marginBottom: verticalScale(4),
            overflow: 'hidden',
            shadowColor: theme.colors.shadow,
            shadowOffset: {width: 0, height: moderateScale(4)},
            shadowOpacity: 0.2,
            shadowRadius: moderateScale(8),
            backgroundColor: Color(theme.colors.card).alpha(0.5).toString(),
            borderWidth: 1,
            borderColor: Color(theme.colors.border).alpha(0.1).toString(),
          },
          image: {
            width: '100%',
            height: '100%',
            borderRadius: moderateScale(12),
          },
          textContainer: {
            flex: 1,
            gap: moderateScale(2),
          },
          reciterName: {
            fontSize: moderateScale(13),
            fontFamily: 'Manrope-SemiBold',
            color: theme.colors.text,
            letterSpacing: -0.3,
          },
          surahName: {
            fontSize: moderateScale(10),
            fontFamily: 'Manrope-Medium',
            color: Color(theme.colors.textSecondary).alpha(0.8).toString(),
            letterSpacing: -0.2,
          },
          progressSection: {
            flexDirection: 'row',
            alignItems: 'center',
            marginTop: 'auto',
            paddingTop: moderateScale(4),
            backgroundColor: Color(theme.colors.primary).alpha(0.08).toString(),
            borderRadius: moderateScale(20),
            paddingVertical: moderateScale(3),
            paddingHorizontal: moderateScale(6),
            gap: moderateScale(6),
            width: moderateScale(75),
            alignSelf: 'flex-start',
            borderWidth: 1,
            borderColor: Color(theme.colors.primary).alpha(0.1).toString(),
          },
          sliderContainer: {
            height: moderateScale(3),
            flex: 1,
            marginHorizontal: moderateScale(4),
          },
          timeRemaining: {
            fontSize: moderateScale(8),
            fontFamily: 'Manrope-Bold',
            color: Color(theme.colors.text).alpha(0.9).toString(),
            minWidth: moderateScale(16),
            textAlign: 'right',
          },
          playButton: {
            marginLeft: 0,
          },
        }),
      [theme],
    );

    // Memoize press handler
    const handlePress = useCallback(async () => {
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

    return (
      <TouchableOpacity
        activeOpacity={0.99}
        style={styles.container}
        onPress={handlePress}>
        <BlurView
          intensity={40}
          tint={theme.isDarkMode ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={[
            Color(theme.colors.primary).alpha(0.05).toString(),
            Color(theme.colors.background).alpha(0.02).toString(),
            Color(theme.colors.primary).alpha(0.08).toString(),
          ]}
          start={{x: 0, y: 0}}
          end={{x: 1, y: 1}}
          style={styles.gradient}
        />
        <View style={[styles.overlay, {backgroundColor: theme.colors.card}]} />
        <View style={styles.content}>
          <MemoizedReciterImage
            imageUrl={imageUrl}
            reciterName={reciterName}
            styles={styles}
          />
          <View style={styles.textContainer}>
            <Text style={styles.reciterName} numberOfLines={1}>
              {reciterName}
            </Text>
            <Text style={styles.surahName} numberOfLines={1}>
              {surahName}
            </Text>
            <ProgressSection
              progress={progress}
              duration={duration}
              isCurrentTrack={isCurrentTrack}
              trackProgress={trackProgress}
              theme={theme}
              styles={styles}
              onPress={handlePress}
            />
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
