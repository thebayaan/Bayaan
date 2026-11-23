import React, {useCallback, useMemo} from 'react';
import {View, Text, Pressable, StyleSheet} from 'react-native';
import {moderateScale} from '@/utils/scale';
import {useTheme} from '@/hooks/useTheme';
import {ReciterImage} from '@/components/ReciterImage';
import {PlayIcon} from '@/components/Icons';
import Color from 'color';
import {LinearGradient} from 'expo-linear-gradient';
import {GlassView} from 'expo-glass-effect';
import {
  USE_GLASS,
  useGlassColorScheme,
  useGlassTint, // @ai
} from '@/hooks/useGlassProps';
import {ProgressTrack} from '@/components/ProgressTrack'; // @ai
import {usePlayerActions} from '@/hooks/usePlayerActions';
import {useRecentlyPlayedStore} from '@/services/player/store/recentlyPlayedStore';
import {resumeRecent} from '@/services/player/utils/resumeRecent';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {useShownPlaybackTime} from '@/services/player/store/progressStore'; // @ai
import {shallow} from 'zustand/shallow';
import {NowPlayingIndicator} from '@/components/NowPlayingIndicator';
import {useRouter, Link} from 'expo-router';
import {showSheet} from '@/components/sheets/sheetControl'; // @ai
import {useUploadsStore} from '@/store/uploadsStore';
import {createUserUploadTrack} from '@/utils/track';
import {createStyles} from '@/components/cards/recentCardStyles';
import {findRecentIndex} from '@/components/cards/recentCardEntry'; // @ai
// @ai-start
import {forceLTR} from '@/utils/rtl';
import {useTranslation} from 'react-i18next';
// @ai-start
import {useNativeOptionsMenu} from '@/components/sheets/options/OptionsMenu';
import {
  HomeCardOptionsMenu,
  type HomeCardOptionsPayload,
} from '@/components/sheets/options/homeCardOptions';
// @ai-end
// @ai-end

interface RecentReciterCardProps {
  imageUrl?: string;
  reciterName: string;
  // @ai-start
  /**
   * The reciter's catalogue name, which the bundled photos are keyed by.
   * `reciterName` is what is shown and may be localised; an Arabic name
   * finds no photo. Falls back to `reciterName`.
   */
  imageName?: string;
  // @ai-end
  surahName: string;
  trackId: string;
  reciterId: string;
  surahId: number;
  progress: number;
  duration: number;
  isRecent?: boolean;
  rewayatId?: string;
  isUserUpload?: boolean;
  userRecitationId?: string;
  /** Card width. Defaults to RECENT_CARD_WIDTH; iPad shelves pass their own. */
  width?: number; // @ai
}

// @ai-start
export const RecentReciterCard = ({
  imageUrl,
  reciterName,
  imageName = reciterName,
  surahName,
  reciterId,
  surahId,
  progress,
  duration,
  isRecent = false,
  rewayatId,
  isUserUpload,
  userRecitationId,
  width,
}: RecentReciterCardProps) => {
  const {theme} = useTheme();
  const {t} = useTranslation('home');
  const {updateQueue, play, pause} = usePlayerActions();
  const router = useRouter();
  // Single consolidated subscription with shallow equality
  const {playbackStatus, currentIndex, tracks} = usePlayerStore(
    state => ({
      playbackStatus: state.playback.state,
      currentIndex: state.queue.currentIndex,
      tracks: state.queue.tracks,
    }),
    shallow,
  );
  // @ai-start
  // Held at the shown values in the background (see useShownPlaybackTime).
  const {position: storePosition, duration: storeDuration} =
    useShownPlaybackTime();
  // @ai-end

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

  // Resume playback. A tap on the card may pause; the menu's "Continue
  // playing" never does.
  const resume = useCallback(
    async (pauseIfPlaying: boolean) => {
      try {
        // Already in the player: the card plays and pauses it, like the mini
        // player and the iPad hero. Resuming it again reloaded the stream (an
        // audible gap) and replaced the queue it was playing from, a playlist
        // say, with this reciter's whole list.
        if (isCurrentlyPlaying) {
          const audible =
            playbackStatus === 'playing' || playbackStatus === 'buffering';
          if (!audible) await play();
          else if (pauseIfPlaying) await pause();
          return;
        }

        const startPosition = progress * duration;

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
          await updateQueue([uploadTrack], 0, startPosition);
          // @ai-start
          // The entry's place in the full recents list. The card's place on
          // Home is not it when the list holds an entry Home leaves out.
          useRecentlyPlayedStore
            .getState()
            .resumeChain(findRecentIndex({reciterId, userRecitationId}));
          // @ai-end
          return;
        }

        if (__DEV__)
          console.log('[RecentReciterCard] Resume debug:', {
            progress,
            duration,
            startPosition,
          });

        await resumeRecent({
          reciterId,
          surahId,
          rewayatId,
          startPosition,
          recentIndex: findRecentIndex({reciterId, surahId, rewayatId}), // @ai
          updateQueue,
        });
      } catch (error) {
        console.error('Error playing surah:', error);
      }
    },
    [
      reciterId,
      surahId,
      isCurrentlyPlaying,
      playbackStatus,
      progress,
      duration,
      updateQueue,
      play,
      pause,
      rewayatId,
      isUserUpload,
      userRecitationId,
    ],
  );
  const handlePlayPress = useCallback(() => resume(true), [resume]);
  const handleContinuePlaying = useCallback(() => resume(false), [resume]);

  // Long press options
  // @ai-start
  const optionsPayload = useMemo<HomeCardOptionsPayload>(
    () => ({
      reciterId,
      reciterName,
      surahId,
      surahName,
      rewayatId,
      userRecitationId: isUserUpload ? userRecitationId : undefined, // @ai
      variant: 'recent',
      onContinuePlaying: handleContinuePlaying,
    }),
    [
      reciterId,
      reciterName,
      surahId,
      surahName,
      rewayatId,
      isUserUpload,
      userRecitationId,
      handleContinuePlaying,
    ],
  );
  // On iPad the card is a context menu (long press or secondary click).
  const contextMenu = useNativeOptionsMenu('longPress');
  const handleLongPress = useCallback(() => {
    showSheet('home-card-options', {payload: optionsPayload});
  }, [optionsPayload]);
  const onLongPress = contextMenu ? undefined : handleLongPress;
  // @ai-end

  const styles = useMemo(() => createStyles(theme), [theme]);
  const glassColorScheme = useGlassColorScheme();
  const glassTint = useGlassTint(); // @ai

  const CardWrapper = USE_GLASS ? GlassView : View;

  const card = (
    <CardWrapper
      style={[
        styles.container,
        USE_GLASS && styles.glassContainer,
        width != null && {width},
      ]}
      {...(USE_GLASS
        ? {
            glassEffectStyle: 'regular',
            colorScheme: glassColorScheme,
            tintColor: glassTint, // @ai
          }
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
          <Pressable onPress={handlePlayPress} onLongPress={onLongPress}>
            <ReciterImage
              imageUrl={imageUrl}
              reciterName={imageName}
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
            <Pressable onLongPress={onLongPress}>
              {USE_GLASS ? (
                <Link.AppleZoom>
                  <ReciterImage
                    imageUrl={imageUrl}
                    reciterName={imageName}
                    style={styles.image}
                    profileIconSize={moderateScale(40)}
                  />
                </Link.AppleZoom>
              ) : (
                <ReciterImage
                  imageUrl={imageUrl}
                  reciterName={imageName}
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
        onLongPress={onLongPress}
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
          <ProgressTrack
            value={currentSliderProgress}
            fillColor={Color(theme.colors.text).alpha(0.35).toString()}
            trackColor={Color(theme.colors.text).alpha(0.08).toString()}
            style={styles.sliderContainer}
          />
          <Text style={styles.timeRemaining}>{timeRemaining}</Text>
        </View>
      </Pressable>
    </CardWrapper>
  );

  // @ai-start
  return contextMenu ? (
    <HomeCardOptionsMenu
      payload={optionsPayload}
      style={width != null ? {width} : undefined}>
      {card}
    </HomeCardOptionsMenu>
  ) : (
    card
  );
  // @ai-end
};
// @ai-end
