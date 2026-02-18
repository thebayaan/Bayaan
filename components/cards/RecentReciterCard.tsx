import React, {useCallback, useMemo} from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import {moderateScale, verticalScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {ReciterImage} from '@/components/ReciterImage';
import {PlayIcon} from '@/components/Icons';
import Color from 'color';
import {LinearGradient} from 'expo-linear-gradient';
import {Slider} from '@miblanchard/react-native-slider';
import {
  getReciterById,
  getSurahById,
  getAvailableSurahsForRewayat,
} from '@/services/dataService';
import {createTracksForReciter} from '@/utils/track';
import {usePlayerActions} from '@/hooks/usePlayerActions';
import {generateSmartAudioUrl} from '@/utils/audioUtils';
import {getReciterArtwork} from '@/utils/artworkUtils';
import {useRecentlyPlayedStore} from '@/services/player/store/recentlyPlayedStore';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import {Surah} from '@/data/surahData';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {shallow} from 'zustand/shallow';
import {NowPlayingIndicator} from '@/components/NowPlayingIndicator';
import {FollowAlongBadge} from '@/components/badges/FollowAlongBadge';
import {useRewayatFollowAlong} from '@/hooks/useFollowAlong';

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
  rewayatId?: string;
}

const AnimatedTouchableOpacity =
  Animated.createAnimatedComponent(TouchableOpacity);

export const RecentReciterCard = ({
  imageUrl,
  reciterName,
  surahName,
  reciterId,
  surahId,
  progress,
  duration,
  isRecent = false,
  rewayatId,
}: RecentReciterCardProps) => {
  const {theme} = useTheme();
  const {updateQueue} = usePlayerActions();
  const {addRecentTrack} = useRecentlyPlayedStore();
  const hasFollowAlong = useRewayatFollowAlong(rewayatId);

  // Single consolidated subscription with shallow equality
  const {playbackStatus, currentIndex, tracks, storePosition, storeDuration} =
    usePlayerStore(
      state => ({
        playbackStatus: state.playback.state,
        currentIndex: state.queue.currentIndex,
        tracks: state.queue.tracks,
        storePosition: state.playback.position,
        storeDuration: state.playback.duration,
      }),
      shallow,
    );

  // Check if this specific card represents the currently active track in the player
  const isCurrentlyPlaying = useMemo(() => {
    const currentTrack =
      tracks && currentIndex >= 0 && currentIndex < tracks.length
        ? tracks[currentIndex]
        : null;

    if (!reciterId || !currentTrack || !surahId) return false;

    const rewayatMatches =
      rewayatId && currentTrack.rewayatId
        ? rewayatId === currentTrack.rewayatId
        : !rewayatId && !currentTrack.rewayatId; // Match if both are undefined/null

    return (
      currentTrack.reciterId === reciterId &&
      currentTrack.surahId === surahId.toString() &&
      rewayatMatches
    );
  }, [reciterId, surahId, rewayatId, currentIndex, tracks]);

  // Animation values
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{scale: scale.value}],
    };
  });

  const handlePressIn = () => {
    scale.value = withSpring(0.95, {
      damping: 20,
      stiffness: 400,
      mass: 0.5,
    });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, {
      damping: 20,
      stiffness: 400,
      mass: 0.5,
    });
  };

  // Calculate time remaining
  const timeRemaining = useMemo(() => {
    const effectiveDuration =
      isCurrentlyPlaying && storeDuration > 0 ? storeDuration : duration;
    let remainingSeconds = effectiveDuration;

    if (effectiveDuration > 0) {
      if (isCurrentlyPlaying && storePosition >= 0) {
        remainingSeconds = effectiveDuration - storePosition;
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
  }, [isCurrentlyPlaying, storeDuration, storePosition, duration, progress]);

  // Calculate current progress value for the slider
  const currentSliderProgress =
    isCurrentlyPlaying && storeDuration > 0
      ? storePosition / storeDuration
      : progress;

  // Handle press
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

      const rewayatToUseId = rewayatId || reciter.rewayat[0]?.id;
      if (!rewayatToUseId) {
        console.error('Could not determine rewayat ID');
        return;
      }

      const availableSurahIds = await getAvailableSurahsForRewayat(
        rewayatToUseId,
      );

      const allSurahsForRewayat = availableSurahIds
        .map(id => getSurahById(id))
        .filter((s): s is Surah => s !== undefined);

      if (allSurahsForRewayat.length === 0) {
        console.error('No available surahs found for this rewayat');
        return;
      }

      const startIndex = allSurahsForRewayat.findIndex(s => s.id === surahId);

      // Calculate start position for resuming
      const startPosition =
        isCurrentlyPlaying && storePosition >= 0
          ? storePosition
          : progress * duration;

      if (startIndex === -1) {
        // Fallback: just play the selected surah
        const track = await createTracksForReciter(
          reciter,
          [surah],
          rewayatToUseId,
        );
        if (!track || track.length === 0) {
          console.error('Failed to create fallback track');
          return;
        }
        await updateQueue(track, 0, startPosition);
        await addRecentTrack(
          reciter,
          surah,
          progress,
          duration,
          rewayatToUseId,
        );
        return;
      }

      const artwork = getReciterArtwork(reciter);

      // Build all tracks with selected surah first
      const reorderedSurahs = [
        allSurahsForRewayat[startIndex],
        ...allSurahsForRewayat.slice(startIndex + 1),
        ...allSurahsForRewayat.slice(0, startIndex),
      ];

      const allTracks = reorderedSurahs.map(s => ({
        id: `${reciter.id}:${s.id}`,
        url: generateSmartAudioUrl(reciter, s.id.toString(), rewayatToUseId),
        title: s.name,
        artist: reciter.name,
        reciterId: reciter.id,
        artwork,
        surahId: s.id.toString(),
        reciterName: reciter.name,
        rewayatId: rewayatToUseId,
      }));

      await updateQueue(allTracks, 0, startPosition);
      addRecentTrack(reciter, surah, progress, duration, rewayatToUseId);
    } catch (error) {
      console.error('Error playing surah:', error);
    }
  }, [
    reciterId,
    surahId,
    isCurrentlyPlaying,
    storePosition,
    progress,
    duration,
    updateQueue,
    addRecentTrack,
    rewayatId,
  ]);

  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <AnimatedTouchableOpacity
      activeOpacity={0.99}
      style={[styles.container, animatedStyle]}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}>
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: theme.colors.card,
            opacity: 0.9,
          },
        ]}
      />
      <LinearGradient
        colors={[
          Color(theme.colors.textSecondary).alpha(0.03).toString(),
          Color(theme.colors.background).alpha(0.01).toString(),
          Color(theme.colors.textSecondary).alpha(0.05).toString(),
        ]}
        start={{x: 0, y: 0}}
        end={{x: 1, y: 1}}
        style={styles.gradient}
      />
      <View style={styles.content}>
        {/* Reciter Image */}
        <View style={styles.imageContainer}>
          <ReciterImage
            imageUrl={imageUrl}
            reciterName={reciterName}
            style={styles.image}
            profileIconSize={moderateScale(40)}
          />
        </View>

        <View style={styles.textContainer}>
          <Text style={styles.reciterName} numberOfLines={1}>
            {reciterName}
          </Text>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: moderateScale(4),
            }}>
            <Text style={styles.surahName} numberOfLines={1}>
              {surahName}
            </Text>
            {hasFollowAlong && <FollowAlongBadge size="small" />}
          </View>

          {/* Progress Section */}
          <View style={styles.progressSection}>
            <TouchableOpacity
              activeOpacity={0.99}
              style={styles.playButtonContainer}
              onPress={handlePress}>
              {isCurrentlyPlaying ? (
                <NowPlayingIndicator
                  isPlaying={
                    playbackStatus === 'playing' ||
                    playbackStatus === 'buffering'
                  }
                  surahId={surahId}
                  barCount={3}
                  barWidth={moderateScale(2.5)}
                  gap={moderateScale(1.5)}
                />
              ) : (
                <PlayIcon
                  color={theme.colors.text}
                  size={moderateScale(12)}
                  filled={false}
                />
              )}
            </TouchableOpacity>
            <Slider
              value={currentSliderProgress}
              disabled={true}
              minimumTrackTintColor={Color(theme.colors.textSecondary)
                .alpha(0.45)
                .toString()}
              maximumTrackTintColor={Color(theme.colors.border)
                .alpha(0.2)
                .toString()}
              trackStyle={{
                height: moderateScale(3.5),
                borderRadius: moderateScale(2),
              }}
              thumbStyle={{height: 0, width: 0}}
              containerStyle={styles.sliderContainer}
            />
            <Text style={styles.timeRemaining}>{timeRemaining}</Text>
          </View>
        </View>
      </View>
    </AnimatedTouchableOpacity>
  );
};

function createStyles(theme: {
  colors: {
    border: string;
    card: string;
    shadow: string;
    text: string;
    textSecondary: string;
  };
}) {
  return StyleSheet.create({
    container: {
      width: moderateScale(130),
      height: moderateScale(180),
      borderRadius: moderateScale(16),
      shadowColor: '#0D2750',
      shadowOffset: {
        width: 28,
        height: 28,
      },
      shadowOpacity: 0.16,
      shadowRadius: 50,
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
      backgroundColor: Color(theme.colors.textSecondary).alpha(0.06).toString(),
      borderRadius: moderateScale(8),
      paddingVertical: moderateScale(3),
      paddingHorizontal: moderateScale(6),
      gap: moderateScale(6),
      width: moderateScale(75),
      alignSelf: 'flex-start',
      borderWidth: 1,
      borderColor: Color(theme.colors.border).alpha(0.12).toString(),
    },
    sliderContainer: {
      height: moderateScale(5),
      flex: 1,
      marginHorizontal: moderateScale(2),
    },
    timeRemaining: {
      fontSize: moderateScale(8),
      fontFamily: 'Manrope-Bold',
      color: Color(theme.colors.text).alpha(0.9).toString(),
      minWidth: moderateScale(4),
      textAlign: 'right',
    },
    playButtonContainer: {
      width: moderateScale(14),
      height: moderateScale(14),
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 2,
    },
  });
}
