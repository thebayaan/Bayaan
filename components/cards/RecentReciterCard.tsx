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
import {usePlayerActions} from '@/hooks/usePlayerActions';
import {useRecentlyPlayedStore} from '@/services/player/store/recentlyPlayedStore';
import {resumeRecent} from '@/services/player/utils/resumeRecent';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {shallow} from 'zustand/shallow';
import {NowPlayingIndicator} from '@/components/NowPlayingIndicator';
import {useRouter, Link} from 'expo-router';
import {SheetManager} from 'react-native-actions-sheet';
import {useUploadsStore} from '@/store/uploadsStore';
import {createUserUploadTrack} from '@/utils/track';
import {createStyles} from '@/components/cards/recentCardStyles';
// @ai-start
import {forceLTR} from '@/utils/rtl';
import {useTranslation} from 'react-i18next';
// @ai-end

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

// @ai-start
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
  const {t} = useTranslation('home');
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
  //
  // Two display states the old code conflated as `'0m'`:
  //   1. **Duration unknown** — `effectiveDuration` is 0 because the
  //      track's duration hasn't been measured yet, or we're paused on
  //      a track with no `duration` field. The old `'0m'` reads as
  //      "track ended" to the user. Now returns an em-dash so the user
  //      knows the time is genuinely unknown rather than zero.
  //   2. **Short tracks** — for any remaining duration under 60s,
  //      `Math.round(remainingSeconds / 60)` rounds to 0 → `'0m'`. Most
  //      visible on short surahs like Al-Fatihah (~50s total): every
  //      state past mid-track collapses to "0m". Now shows seconds for
  //      remaining < 60s, e.g. "20s".
  const timeRemaining = useMemo(() => {
    const effectiveDuration =
      isCurrentlyPlaying && storeDuration > 0 ? storeDuration : duration;

    // Duration unknown → em-dash placeholder rather than '0m'
    // which the user reads as "track ended".
    if (effectiveDuration <= 0) return '—';

    let remainingSeconds = effectiveDuration;
    if (isCurrentlyPlaying && storePosition >= 0) {
      remainingSeconds = effectiveDuration - storePosition;
    } else {
      remainingSeconds = effectiveDuration * (1 - progress);
    }

    if (remainingSeconds <= 0) return t('duration.seconds', {value: 0});

    // Under a minute → show seconds so short surahs (Al-Fatihah / An-Nas
    // / Al-Falaq / Al-Ikhlas) don't all collapse to "0m" near the end.
    if (remainingSeconds < 60) {
      return t('duration.seconds', {
        value: Math.max(1, Math.ceil(remainingSeconds)),
      });
    }

    const totalMinutes = Math.round(remainingSeconds / 60);
    if (totalMinutes >= 60) {
      const hours = Math.round(totalMinutes / 60);
      return t('duration.hours', {value: hours});
    }
    return t('duration.minutes', {value: totalMinutes});
  }, [isCurrentlyPlaying, storeDuration, storePosition, duration, progress, t]);

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

      await resumeRecent({
        reciterId,
        surahId,
        rewayatId,
        startPosition,
        recentIndex: index,
        updateQueue,
      });
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
            style={StyleSheet.absoluteFill}
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
        <View style={[styles.progressRow, forceLTR]}>
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
// @ai-end
