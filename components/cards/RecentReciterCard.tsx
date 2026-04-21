import React, {useCallback, useMemo} from 'react';
import {View, Text, Pressable, StyleSheet} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {ReciterImage} from '@/components/ReciterImage';
import {PlayIcon} from '@/components/Icons';
import Color from 'color';
import {LinearGradient} from 'expo-linear-gradient';
import {GlassView} from 'expo-glass-effect';
import {USE_GLASS, useGlassColorScheme} from '@/hooks/useGlassProps';
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
import {Surah} from '@/data/surahData';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {shallow} from 'zustand/shallow';
import {NowPlayingIndicator} from '@/components/NowPlayingIndicator';
import {useRouter, Link} from 'expo-router';
import {SheetManager} from 'react-native-actions-sheet';
import {useUploadsStore} from '@/store/uploadsStore';
import {createUserUploadTrack} from '@/utils/track';

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
  index: number;
  isUserUpload?: boolean;
  userRecitationId?: string;
}

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
  index,
  isUserUpload,
  userRecitationId,
}: RecentReciterCardProps) => {
  const {theme} = useTheme();
  const {updateQueue} = usePlayerActions();
  const router = useRouter();
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

    if (!currentTrack) return false;

    // Upload track match by userRecitationId
    if (isUserUpload && userRecitationId) {
      return currentTrack.userRecitationId === userRecitationId;
    }

    if (!reciterId || !surahId) return false;

    const rewayatMatches =
      rewayatId && currentTrack.rewayatId
        ? rewayatId === currentTrack.rewayatId
        : !rewayatId && !currentTrack.rewayatId;

    return (
      currentTrack.reciterId === reciterId &&
      currentTrack.surahId === surahId.toString() &&
      rewayatMatches
    );
  }, [
    reciterId,
    surahId,
    rewayatId,
    currentIndex,
    tracks,
    isUserUpload,
    userRecitationId,
  ]);

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

  // Resume playback
  const handlePlayPress = useCallback(async () => {
    try {
      // Handle upload tracks
      if (isUserUpload && userRecitationId) {
        const recitation = useUploadsStore
          .getState()
          .recitations.find(r => r.id === userRecitationId);
        if (!recitation) {
          console.error('Could not find uploaded recitation');
          return;
        }
        const uploadTrack = createUserUploadTrack(recitation);
        const startPosition =
          isCurrentlyPlaying && storePosition >= 0
            ? storePosition
            : progress * duration;
        await updateQueue([uploadTrack], 0, startPosition);
        useRecentlyPlayedStore.getState().resumeChain(index);
        return;
      }

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

      const availableSurahIds =
        await getAvailableSurahsForRewayat(rewayatToUseId);

      const allSurahsForRewayat = availableSurahIds
        .map(id => getSurahById(id))
        .filter((s): s is Surah => s !== undefined);

      if (allSurahsForRewayat.length === 0) {
        console.error('No available surahs found for this rewayat');
        return;
      }

      const startIndex = allSurahsForRewayat.findIndex(s => s.id === surahId);

      const startPosition =
        isCurrentlyPlaying && storePosition >= 0
          ? storePosition
          : progress * duration;

      if (__DEV__)
        console.log('[RecentReciterCard] Resume debug:', {
          isCurrentlyPlaying,
          storePosition,
          progress,
          duration,
          startPosition,
        });

      if (startIndex === -1) {
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
        useRecentlyPlayedStore.getState().resumeChain(index);
        return;
      }

      const artwork = getReciterArtwork(reciter);

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
      useRecentlyPlayedStore.getState().resumeChain(index);
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
    index,
    rewayatId,
    isUserUpload,
    userRecitationId,
  ]);

  // Long press options
  const handleLongPress = useCallback(() => {
    SheetManager.show('home-card-options', {
      payload: {
        reciterId,
        reciterName,
        surahId,
        surahName,
        rewayatId,
        recentIndex: index,
        variant: 'recent',
        onContinuePlaying: handlePlayPress,
      },
    });
  }, [
    reciterId,
    reciterName,
    surahId,
    surahName,
    rewayatId,
    index,
    handlePlayPress,
  ]);

  const styles = useMemo(() => createStyles(theme), [theme]);
  const glassColorScheme = useGlassColorScheme();

  const CardWrapper = USE_GLASS ? GlassView : View;

  return (
    <CardWrapper
      style={[styles.container, USE_GLASS && styles.glassContainer]}
      {...(USE_GLASS
        ? {glassEffectStyle: 'regular', colorScheme: glassColorScheme}
        : {})}>
      {/* Background layers (fallback for non-glass) */}
      {!USE_GLASS && (
        <>
          <View
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: Color(theme.colors.text)
                  .alpha(0.04)
                  .toString(),
              },
            ]}
          />
          <LinearGradient
            colors={[
              Color(theme.colors.text).alpha(0.02).toString(),
              'transparent',
              Color(theme.colors.text).alpha(0.03).toString(),
            ]}
            start={{x: 0, y: 0}}
            end={{x: 1, y: 1}}
            style={StyleSheet.absoluteFillObject}
          />
        </>
      )}

      {/* Image box — matches playback zone spacing */}
      <View style={styles.imageContainer}>
        {isUserUpload ? (
          <Pressable onPress={handlePlayPress} onLongPress={handleLongPress}>
            <ReciterImage
              imageUrl={imageUrl}
              reciterName={reciterName}
              style={styles.image}
              profileIconSize={moderateScale(40)}
            />
          </Pressable>
        ) : (
          <Link
            href={{
              pathname: '/(tabs)/(a.home)/reciter/[id]',
              params: {id: reciterId},
            }}
            asChild>
            <Pressable onLongPress={handleLongPress}>
              {USE_GLASS ? (
                <Link.AppleZoom>
                  <ReciterImage
                    imageUrl={imageUrl}
                    reciterName={reciterName}
                    style={styles.image}
                    profileIconSize={moderateScale(40)}
                  />
                </Link.AppleZoom>
              ) : (
                <ReciterImage
                  imageUrl={imageUrl}
                  reciterName={reciterName}
                  style={styles.image}
                  profileIconSize={moderateScale(40)}
                />
              )}
            </Pressable>
          </Link>
        )}
      </View>

      {/* Reciter name */}
      <Text style={styles.reciterName} numberOfLines={1}>
        {reciterName}
      </Text>

      {/* Bottom zone: Playback controls — resumes audio */}
      <Pressable
        onPress={handlePlayPress}
        onLongPress={handleLongPress}
        style={({pressed}) => [
          styles.playbackZone,
          pressed && styles.playbackZonePressed,
        ]}>
        <View style={styles.playbackRow}>
          <Text style={styles.surahName} numberOfLines={1}>
            {surahName}
          </Text>
        </View>
        <View style={styles.progressRow}>
          <View style={styles.playButtonContainer}>
            {isCurrentlyPlaying &&
            (playbackStatus === 'playing' || playbackStatus === 'buffering') ? (
              <NowPlayingIndicator
                isPlaying={true}
                surahId={surahId}
                barCount={3}
                barWidth={moderateScale(2)}
                gap={moderateScale(1.5)}
              />
            ) : (
              <PlayIcon
                color={theme.colors.text}
                size={moderateScale(10)}
                filled={true}
              />
            )}
          </View>
          <Slider
            value={currentSliderProgress}
            disabled={true}
            minimumTrackTintColor={Color(theme.colors.text)
              .alpha(0.35)
              .toString()}
            maximumTrackTintColor={Color(theme.colors.text)
              .alpha(0.08)
              .toString()}
            trackStyle={{
              height: moderateScale(3),
              borderRadius: moderateScale(2),
            }}
            thumbStyle={{height: 0, width: 0}}
            containerStyle={styles.sliderContainer}
          />
          <Text style={styles.timeRemaining}>{timeRemaining}</Text>
        </View>
      </Pressable>
    </CardWrapper>
  );
};

function createStyles(theme: {
  colors: {
    border: string;
    card: string;
    shadow: string;
    text: string;
    textSecondary: string;
    background: string;
  };
}) {
  return StyleSheet.create({
    container: {
      width: moderateScale(120),
      borderRadius: moderateScale(14),
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: Color(theme.colors.text).alpha(0.06).toString(),
      padding: moderateScale(6),
      gap: moderateScale(4),
    },
    glassContainer: {
      borderWidth: 0,
    },
    imageContainer: {
      aspectRatio: 1,
      borderRadius: moderateScale(8),
      overflow: 'hidden',
      backgroundColor: Color(theme.colors.text).alpha(0.06).toString(),
    },
    image: {
      width: '100%',
      height: '100%',
    },
    reciterName: {
      fontSize: moderateScale(11.5),
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.text,
      letterSpacing: -0.3,
    },
    // Bottom zone: surah + playback controls
    playbackZone: {
      backgroundColor: Color(theme.colors.text).alpha(0.06).toString(),
      borderRadius: moderateScale(8),
      paddingHorizontal: moderateScale(6),
      paddingVertical: moderateScale(5),
      gap: moderateScale(4),
    },
    playbackZonePressed: {
      backgroundColor: Color(theme.colors.text).alpha(0.1).toString(),
    },
    playbackRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    surahName: {
      fontSize: moderateScale(9.5),
      fontFamily: 'Manrope-Medium',
      color: Color(theme.colors.text).alpha(0.7).toString(),
      letterSpacing: -0.2,
    },
    progressRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: moderateScale(4),
    },
    playButtonContainer: {
      width: moderateScale(12),
      height: moderateScale(12),
      justifyContent: 'center',
      alignItems: 'center',
    },
    sliderContainer: {
      height: moderateScale(4),
      flex: 1,
    },
    timeRemaining: {
      fontSize: moderateScale(7.5),
      fontFamily: 'Manrope-Bold',
      color: Color(theme.colors.text).alpha(0.5).toString(),
      minWidth: moderateScale(12),
      textAlign: 'right',
    },
  });
}
