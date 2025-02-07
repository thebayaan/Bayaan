import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import {moderateScale, verticalScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {ReciterImage} from '@/components/ReciterImage';
import {PlayIcon} from '@/components/Icons';
import Color from 'color';
import {LinearGradient} from 'expo-linear-gradient';
import {usePlayerStore} from '@/store/playerStore';
import {useProgress} from 'react-native-track-player';
import {Slider} from '@miblanchard/react-native-slider';
import {usePlayback} from '@/hooks/usePlayback';
import {useSharedValue} from 'react-native-reanimated';
import {
  getReciterById,
  getAllSurahs,
  getSurahById,
} from '@/services/dataService';

interface RecentReciterCardProps {
  imageUrl?: string;
  reciterName: string;
  surahName: string;
  trackId: string;
  reciterId: string;
  surahId: number;
  progress: number;
  duration: number;
}

export const RecentReciterCard: React.FC<RecentReciterCardProps> = ({
  imageUrl,
  reciterName,
  surahName,
  trackId,
  reciterId,
  surahId,
  progress,
  duration,
}) => {
  const {theme} = useTheme();
  const {activeTrackId} = usePlayerStore();
  const isCurrentTrack = activeTrackId === trackId;

  // Create animated shared value for progress
  const animatedProgress = useSharedValue(progress);

  // Only subscribe to progress updates for current track
  const trackProgress = useProgress(isCurrentTrack ? 1000 : undefined);

  // Update animated progress when needed
  React.useEffect(() => {
    if (isCurrentTrack && trackProgress.duration > 0) {
      requestAnimationFrame(() => {
        'worklet';
        animatedProgress.value =
          trackProgress.position / trackProgress.duration;
      });
    } else {
      requestAnimationFrame(() => {
        'worklet';
        animatedProgress.value = progress;
      });
    }
  }, [
    isCurrentTrack,
    trackProgress.position,
    trackProgress.duration,
    progress,
    animatedProgress,
  ]);

  // Calculate time remaining in minutes/hours
  const getTimeRemaining = React.useCallback(() => {
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

  const {playFromSurah} = usePlayback();

  // Calculate the position to start playback from and play the track
  const handlePress = async () => {
    try {
      const [reciter, surah, allSurahs] = await Promise.all([
        getReciterById(reciterId),
        getSurahById(surahId),
        getAllSurahs(),
      ]);

      if (!reciter || !surah) {
        console.error('Could not find reciter or surah');
        return;
      }

      const startPosition = isCurrentTrack
        ? trackProgress.position
        : progress * duration;
      await playFromSurah(reciter, surah, allSurahs, startPosition);
    } catch (error) {
      console.error('Error playing surah:', error);
    }
  };

  const styles = StyleSheet.create({
    container: {
      width: moderateScale(200),
      height: moderateScale(280),
      borderRadius: moderateScale(20),
      overflow: 'hidden',
    },
    gradient: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: Color(theme.colors.primary).alpha(0.03).toString(),
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
    playButton: {},
  });

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
                size={moderateScale(20)}
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
            <Text style={styles.timeRemaining}>{getTimeRemaining()}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};
