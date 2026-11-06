// @ai-generated
import React, {useCallback, useMemo} from 'react';
import {View, Text, StyleSheet, Pressable, type ViewStyle} from 'react-native';
import {shallow} from 'zustand/shallow';
import {useTranslation} from 'react-i18next';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale} from '@/utils/scale';
import {ReciterImage} from '@/components/ReciterImage';
import {PauseIcon, PlayIcon} from '@/components/Icons';
import {usePlayerActions} from '@/hooks/usePlayerActions';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {
  useRecentlyPlayedStore,
  type RecentlyPlayedTrack,
} from '@/services/player/store/recentlyPlayedStore';
import {resumeRecent} from '@/services/player/utils/resumeRecent';
import {getReciterDisplayName, getSurahDisplayName} from '@/i18n/format';
import {latinLetterSpacing} from '@/utils/rtl';
import {Theme} from '@/utils/themeUtils';
import {
  getTextColors,
  renderFullWidthBackground,
} from './random-recitation/backgrounds';

/**
 * Index of the most recent recitation that can be resumed from here.
 * Uploads are left out: they resume from the Home shelf.
 */
export function findResumableIndex(tracks: RecentlyPlayedTrack[]): number {
  return tracks.findIndex(
    track =>
      !track.isUserUpload &&
      !!track.reciter?.id &&
      !!track.reciter?.name &&
      !!track.surah?.id &&
      !!track.surah?.name,
  );
}

interface ContinueListeningHeroProps {
  style?: ViewStyle;
}

/**
 * The last surah you listened to, with its reciter and how far you got.
 * Tapping it carries on from there. Renders nothing until something has
 * been played.
 */
export function ContinueListeningHero({style}: ContinueListeningHeroProps) {
  const {theme} = useTheme();
  const {t} = useTranslation('home');
  const {updateQueue, play, pause} = usePlayerActions();
  const recentTracks = useRecentlyPlayedStore(state => state.recentTracks);
  const recentIndex = findResumableIndex(recentTracks);
  const track = recentIndex >= 0 ? recentTracks[recentIndex] : null;

  const {currentTrack, storePosition, playbackState} = usePlayerStore(
    state => ({
      currentTrack:
        state.queue.currentIndex >= 0
          ? state.queue.tracks[state.queue.currentIndex]
          : undefined,
      storePosition: state.playback.position,
      playbackState: state.playback.state,
    }),
    shallow,
  );
  const isCurrentTrack =
    !!track &&
    currentTrack?.reciterId === track.reciter.id &&
    currentTrack?.surahId === track.surah.id.toString();
  // Already in the player: the card plays and pauses it, like the mini
  // player, instead of loading it again.
  const isPlaying = isCurrentTrack && playbackState === 'playing';

  const handlePress = useCallback(() => {
    if (!track) {
      return;
    }
    if (isCurrentTrack) {
      (isPlaying ? pause() : play()).catch(error => {
        console.error('Error toggling playback:', error);
      });
      return;
    }
    const startPosition =
      isCurrentTrack && storePosition >= 0
        ? storePosition
        : track.progress * track.duration;
    resumeRecent({
      reciterId: track.reciter.id,
      surahId: track.surah.id,
      rewayatId: track.rewayatId,
      startPosition,
      recentIndex,
      updateQueue,
    }).catch(error => {
      console.error('Error resuming recitation:', error);
    });
  }, [
    track,
    isCurrentTrack,
    isPlaying,
    storePosition,
    recentIndex,
    updateQueue,
    play,
    pause,
  ]);

  const styles = useMemo(() => createStyles(theme), [theme]);
  const textColors = getTextColors('fw-ribbon', theme);

  if (!track) {
    return null;
  }

  const label = t('hero.continueListening');
  const surahName = getSurahDisplayName(track.surah);
  const reciterName = getReciterDisplayName(track.reciter);
  const progress = Math.min(Math.max(track.progress, 0), 1);

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${surahName}, ${reciterName}`}
      style={({pressed}) => [styles.card, style, pressed && styles.pressed]}>
      {renderFullWidthBackground('fw-ribbon', theme)}
      <View style={styles.content}>
        <Text style={[styles.label, {color: textColors.labelColor}]}>
          {label}
        </Text>
        <View style={styles.row}>
          <ReciterImage
            imageUrl={track.reciter.image_url ?? undefined}
            reciterName={track.reciter.name}
            style={styles.avatar}
          />
          <View style={styles.names}>
            <Text
              numberOfLines={1}
              style={[styles.surah, {color: textColors.subtitleColor}]}>
              {surahName}
            </Text>
            <Text
              numberOfLines={1}
              style={[styles.reciter, {color: textColors.labelColor}]}>
              {reciterName}
            </Text>
          </View>
          <View style={styles.playButton}>
            {isPlaying ? (
              <PauseIcon
                color={theme.colors.background}
                size={moderateScale(18)}
              />
            ) : (
              <PlayIcon
                color={theme.colors.background}
                size={moderateScale(18)}
              />
            )}
          </View>
        </View>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              {width: `${Math.round(progress * 100)}%`},
            ]}
          />
        </View>
      </View>
    </Pressable>
  );
}

const AVATAR_SIZE = moderateScale(56);
const PLAY_SIZE = moderateScale(48);

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      borderRadius: moderateScale(20),
      overflow: 'hidden',
    },
    pressed: {
      opacity: 0.85,
    },
    content: {
      flex: 1,
      padding: moderateScale(14),
      justifyContent: 'space-between',
    },
    label: {
      fontFamily: 'Manrope-Bold',
      fontSize: moderateScale(10),
      letterSpacing: latinLetterSpacing(moderateScale(0.8)),
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: moderateScale(12),
    },
    avatar: {
      width: AVATAR_SIZE,
      height: AVATAR_SIZE,
      borderRadius: AVATAR_SIZE / 2,
      overflow: 'hidden',
    },
    names: {
      flex: 1,
      minWidth: 0,
    },
    surah: {
      fontFamily: 'Manrope-Bold',
      fontSize: moderateScale(18),
    },
    reciter: {
      fontFamily: 'Manrope-Medium',
      fontSize: moderateScale(13),
      marginTop: moderateScale(2),
    },
    playButton: {
      width: PLAY_SIZE,
      height: PLAY_SIZE,
      borderRadius: PLAY_SIZE / 2,
      backgroundColor: theme.colors.text,
      alignItems: 'center',
      justifyContent: 'center',
    },
    progressTrack: {
      height: moderateScale(4),
      borderRadius: moderateScale(2),
      backgroundColor: theme.isDarkMode
        ? 'rgba(255,255,255,0.15)'
        : 'rgba(0,0,0,0.1)',
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: theme.colors.text,
    },
  });
