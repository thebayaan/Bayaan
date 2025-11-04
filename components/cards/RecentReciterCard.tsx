import React, {useCallback, useMemo, useRef} from 'react';
import {View, Text, TouchableOpacity, StyleSheet, Platform} from 'react-native';
import {moderateScale, verticalScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {ReciterImage} from '@/components/ReciterImage';
import {PlayIcon} from '@/components/Icons';
import Color from 'color';
import {LinearGradient} from 'expo-linear-gradient';
import {useProgress} from 'react-native-track-player';
import {Slider} from '@miblanchard/react-native-slider';
import {
  getReciterById,
  getSurahById,
  getAvailableSurahsForRewayat,
} from '@/services/dataService';
import {createTracksForReciter} from '@/utils/track';
import {useUnifiedPlayer} from '@/services/player/store/playerStore';
import {QueueContext} from '@/services/queue/QueueContext';
import TrackPlayer, {
  State as TrackPlayerState,
} from 'react-native-track-player';
import {generateSmartAudioUrl} from '@/utils/audioUtils';
import {getReciterArtwork} from '@/utils/artworkUtils';
import {useRecentlyPlayedStore} from '@/services/player/store/recentlyPlayedStore';
import {BlurView} from '@react-native-community/blur';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import {Surah} from '@/data/surahData';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {NowPlayingIndicator} from '@/components/NowPlayingIndicator';

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
  const {updateQueue, play} = useUnifiedPlayer();
  const queueContext = QueueContext.getInstance();
  const {addRecentTrack} = useRecentlyPlayedStore();
  
  // Track current operation to prevent race conditions
  const currentOperationRef = useRef<string | null>(null);

  // Get necessary state slices from player store
  const playbackStatus = usePlayerStore(state => state.playback.state);
  const currentIndex = usePlayerStore(state => state.queue.currentIndex);
  const tracks = usePlayerStore(state => state.queue.tracks);

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
      damping: 15,
      stiffness: 300,
    });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, {
      damping: 15,
      stiffness: 300,
    });
  };

  const trackProgress = useProgress(
    isCurrentlyPlaying && isRecent ? 1000 : undefined,
  );

  // Calculate time remaining
  const timeRemaining = useMemo(() => {
    const effectiveDuration =
      isCurrentlyPlaying && trackProgress.duration > 0
        ? trackProgress.duration
        : duration;
    let remainingSeconds = effectiveDuration;

    if (effectiveDuration > 0) {
      if (isCurrentlyPlaying && trackProgress.position >= 0) {
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
    isCurrentlyPlaying,
    trackProgress.duration,
    trackProgress.position,
    duration,
    progress,
  ]);

  // Calculate current progress value for the slider
  const currentSliderProgress =
    isCurrentlyPlaying && trackProgress.duration > 0
      ? trackProgress.position / trackProgress.duration
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

      // Use the provided rewayatId if available, otherwise fallback to the first rewayat
      const rewayatToUseId = rewayatId || reciter.rewayat[0]?.id;
      if (!rewayatToUseId) {
        console.error('Could not determine rewayat ID');
        return;
      }

      // Fetch all available surah IDs for this rewayat
      const availableSurahIds =
        await getAvailableSurahsForRewayat(rewayatToUseId);

      // Convert IDs to Surah objects, filtering out any not found (shouldn't happen ideally)
      const allSurahsForRewayat = availableSurahIds
        .map(id => getSurahById(id))
        .filter((s): s is Surah => s !== undefined);

      if (allSurahsForRewayat.length === 0) {
        console.error('No available surahs found for this rewayat');
        return;
      }

      // Find the index of the selected surah in the full list
      const startIndex = allSurahsForRewayat.findIndex(s => s.id === surahId);
      if (startIndex === -1) {
        console.error(
          'Selected surah not found in the available list for rewayat',
        );
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
        await updateQueue(track, 0);
        const startPosition = progress * duration;
        if (startPosition > 0) {
          await TrackPlayer.seekTo(startPosition);
        }
        await play();
        await addRecentTrack(
          reciter,
          surah,
          progress,
          duration,
          rewayatToUseId,
        );
        queueContext.setCurrentReciter(reciter);
        return; // Exit after fallback
      }

      // OPTIMIZED: Use hybrid approach - create first track, play immediately
      // Then create remaining tracks in background (same as ReciterProfile)
      
      // Generate unique operation ID to prevent race conditions
      const operationId = `${Date.now()}-${reciter.id}-${surah.id}`;
      currentOperationRef.current = operationId;
      
      // Get artwork once (same for all tracks)
      const artwork = getReciterArtwork(reciter);
      
      // Create ONLY first track (instant!)
      const firstTrack = {
        id: `${reciter.id}:${surah.id}`,
        url: generateSmartAudioUrl(reciter, surah.id.toString(), rewayatToUseId),
        title: surah.name,
        artist: reciter.name,
        reciterId: reciter.id,
        artwork,
        surahId: surah.id.toString(),
        reciterName: reciter.name,
        rewayatId: rewayatToUseId,
      };
      
      const startPosition =
        isCurrentlyPlaying && trackProgress.position >= 0
          ? trackProgress.position
          : progress * duration;
      
      // Add first track and play IMMEDIATELY (fast path - no blocking!)
      try {
        await TrackPlayer.reset();
        currentOperationRef.current = operationId; // Re-set after reset
        await TrackPlayer.add(firstTrack);
        if (startPosition > 0) {
          await TrackPlayer.seekTo(startPosition);
        }
        await TrackPlayer.play();
      } catch (error) {
        console.error('Error starting playback:', error);
        currentOperationRef.current = null; // Clear on error
        throw error;
      }
      
      // Update store state IMMEDIATELY (synchronous, fast)
      const store = usePlayerStore.getState();
      store.updateQueueState({
        tracks: [firstTrack],
        currentIndex: 0,
        total: 1, // Start with actual track count
        loading: false,
        endReached: false,
      });
      
      // Get remaining surahs (reordered so selected is first)
      const remainingSurahs = [
        ...allSurahsForRewayat.slice(startIndex + 1),
        ...allSurahsForRewayat.slice(0, startIndex),
      ];
      
      // Create remaining tracks in parallel (background - doesn't block playback!)
      if (remainingSurahs.length > 0) {
        Promise.all(
          remainingSurahs.map(async s => {
            const url = generateSmartAudioUrl(reciter, s.id.toString(), rewayatToUseId);
            return {
              id: `${reciter.id}:${s.id}`,
              url,
              title: s.name,
              artist: reciter.name,
              reciterId: reciter.id,
              artwork, // Reuse pre-computed artwork
              surahId: s.id.toString(),
              reciterName: reciter.name,
              rewayatId: rewayatToUseId,
            };
          }),
        )
          .then(remainingTracks => {
            // FIX: Check if operation is still valid (prevents race conditions)
            if (currentOperationRef.current !== operationId) {
              console.log('[RecentReciterCard] Operation cancelled, skipping track addition');
              return;
            }
            
            // Add remaining tracks to TrackPlayer (non-blocking)
            TrackPlayer.add(remainingTracks)
              .then(() => {
                // FIX: Double-check operation is still valid before updating store
                if (currentOperationRef.current !== operationId) {
                  console.log('[RecentReciterCard] Operation cancelled, skipping store update');
                  return;
                }
                
                // Update store with complete queue (non-blocking)
                const completeQueue = [firstTrack, ...remainingTracks];
                store.updateQueueState({
                  tracks: completeQueue,
                  total: completeQueue.length, // Update total to match actual tracks
                });
              })
              .catch(error => {
                console.error('Error adding tracks to TrackPlayer:', error);
              });
          })
          .catch(error => {
            console.error('Error creating remaining tracks:', error);
          });
      }
      
      // Add to recently played AFTER playback starts (non-blocking)
      addRecentTrack(reciter, surah, progress, duration, rewayatToUseId);

      queueContext.setCurrentReciter(reciter);
    } catch (error) {
      console.error('Error playing surah:', error);
      currentOperationRef.current = null; // Clear on error
    }
  }, [
    reciterId,
    surahId,
    isCurrentlyPlaying,
    trackProgress.position,
    progress,
    duration,
    updateQueue,
    play,
    addRecentTrack,
    queueContext,
    rewayatId,
  ]);

  const styles = StyleSheet.create({
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

  return (
    <AnimatedTouchableOpacity
      activeOpacity={0.99}
      style={[styles.container, animatedStyle]}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}>
      {Platform.OS === 'ios' ? (
        <BlurView
          blurAmount={40}
          blurType={theme.isDarkMode ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />
      ) : (
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: theme.colors.card,
              opacity: 0.9,
            },
          ]}
        />
      )}
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
          <Text style={styles.surahName} numberOfLines={1}>
            {surahName}
          </Text>

          {/* Progress Section */}
          <View style={styles.progressSection}>
            <TouchableOpacity
              activeOpacity={0.99}
              style={styles.playButtonContainer}
              onPress={handlePress}>
              {isCurrentlyPlaying ? (
                <NowPlayingIndicator
                  isPlaying={
                    playbackStatus === TrackPlayerState.Playing ||
                    playbackStatus === TrackPlayerState.Buffering
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
