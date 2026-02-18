/**
 * MushafPlayerBar - Dual-mode bottom bar for mushaf audio playback
 *
 * Idle state:  [Play]  ----  Reciter Name  ----  [...]
 * Active state: [Stop]  ---- [Prev] [Play/Pause] [Next] ---- [...]
 *                           Surah Name S:A (centered below)
 */

import React, {useCallback} from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import {Feather, Ionicons} from '@expo/vector-icons';
import {moderateScale} from 'react-native-size-matters';
import {SheetManager} from 'react-native-actions-sheet';
import {useTheme} from '@/hooks/useTheme';
import {useMushafPlayerStore} from '@/store/mushafPlayerStore';
import {mushafAudioService} from '@/services/audio/MushafAudioService';
import {SURAHS} from '@/data/surahData';
import {PlayIcon, PauseIcon} from '@/components/Icons';

interface MushafPlayerBarProps {
  currentPage: number;
}

export const MushafPlayerBar: React.FC<MushafPlayerBarProps> = ({
  currentPage,
}) => {
  const {theme} = useTheme();

  const playbackState = useMushafPlayerStore(s => s.playbackState);
  const currentSurah = useMushafPlayerStore(s => s.currentSurah);
  const currentAyah = useMushafPlayerStore(s => s.currentAyah);
  const reciterName = useMushafPlayerStore(s => s.reciterName);

  const isIdle = playbackState === 'idle';
  const isLoading = playbackState === 'loading';
  const isPlaying = playbackState === 'playing';

  const surahName =
    currentSurah >= 1 && currentSurah <= 114
      ? SURAHS[currentSurah - 1].name
      : '';

  const handlePlayPress = useCallback(() => {
    const store = useMushafPlayerStore.getState();
    if (store.rewayatId) {
      // Reset repeat settings so previous loop mode doesn't carry over
      store.setVerseRepeatCount(1);
      store.setRangeRepeatCount(1);
      useMushafPlayerStore.setState({currentPage});
      store.startPlayback(currentPage);
    } else {
      useMushafPlayerStore.setState({currentPage});
      SheetManager.show('mushaf-player-options', {
        payload: {currentPage},
      });
    }
  }, [currentPage]);

  const handlePlayPause = useCallback(() => {
    if (isPlaying) {
      mushafAudioService.pause();
      useMushafPlayerStore.getState().setPlaybackState('paused');
    } else {
      mushafAudioService.play();
      useMushafPlayerStore.getState().setPlaybackState('playing');
    }
  }, [isPlaying]);

  const handleStop = useCallback(() => {
    useMushafPlayerStore.getState().stop();
  }, []);

  const handlePrevAyah = useCallback(() => {
    mushafAudioService.seekToPreviousAyah();
  }, []);

  const handleNextAyah = useCallback(() => {
    mushafAudioService.seekToNextAyah();
  }, []);

  const handleOptions = useCallback(() => {
    useMushafPlayerStore.setState({currentPage});
    SheetManager.show('mushaf-player-options', {
      payload: {currentPage},
    });
  }, [currentPage]);

  // ── Idle state ──────────────────────────────────────────────────────
  if (isIdle) {
    return (
      <View style={styles.content}>
        <Pressable
          style={[styles.playButtonRect, {backgroundColor: theme.colors.text}]}
          onPress={handlePlayPress}
          accessibilityRole="button"
          accessibilityLabel="Play">
          <PlayIcon color={theme.colors.background} size={moderateScale(16)} />
        </Pressable>

        <Text
          style={[styles.reciterText, {color: theme.colors.textSecondary}]}
          numberOfLines={1}>
          {reciterName || ''}
        </Text>

        <Pressable
          style={styles.iconButton}
          onPress={handleOptions}
          accessibilityRole="button"
          accessibilityLabel="Playback options">
          <Ionicons
            name="ellipsis-horizontal"
            size={moderateScale(20)}
            color={theme.colors.text}
          />
        </Pressable>
      </View>
    );
  }

  // ── Active state (playing / paused / loading) ───────────────────────
  const infoText = `${surahName} ${currentSurah}:${currentAyah}`;

  return (
    <View style={styles.activeContainer}>
      {/* Row 1: [Stop] ---- [Prev] [Play/Pause] [Next] ---- [Options] */}
      <View style={styles.activeRow}>
        <Pressable
          style={styles.iconButton}
          onPress={handleStop}
          accessibilityRole="button"
          accessibilityLabel="Stop">
          <Ionicons
            name="stop"
            size={moderateScale(20)}
            color={theme.colors.text}
          />
        </Pressable>

        <View style={styles.controlsCenter}>
          <Pressable
            style={styles.chevronButton}
            onPress={handlePrevAyah}
            accessibilityRole="button"
            accessibilityLabel="Previous ayah">
            <Feather
              name="chevron-left"
              size={moderateScale(22)}
              color={theme.colors.text}
            />
          </Pressable>

          <Pressable
            style={[
              styles.iconButton,
              !isPlaying && !isLoading && {paddingLeft: moderateScale(11)},
            ]}
            onPress={handlePlayPause}
            disabled={isLoading}
            accessibilityRole="button"
            accessibilityLabel={isPlaying ? 'Pause' : 'Play'}>
            {isLoading ? (
              <ActivityIndicator size="small" color={theme.colors.text} />
            ) : isPlaying ? (
              <PauseIcon color={theme.colors.text} size={moderateScale(22)} />
            ) : (
              <PlayIcon color={theme.colors.text} size={moderateScale(22)} />
            )}
          </Pressable>

          <Pressable
            style={styles.chevronButton}
            onPress={handleNextAyah}
            accessibilityRole="button"
            accessibilityLabel="Next ayah">
            <Feather
              name="chevron-right"
              size={moderateScale(22)}
              color={theme.colors.text}
            />
          </Pressable>
        </View>

        <Pressable
          style={styles.iconButton}
          onPress={handleOptions}
          accessibilityRole="button"
          accessibilityLabel="Playback options">
          <Ionicons
            name="ellipsis-horizontal"
            size={moderateScale(20)}
            color={theme.colors.text}
          />
        </Pressable>
      </View>

      {/* Row 2: verse info */}
      <Text
        style={[styles.verseInfo, {color: theme.colors.textSecondary}]}
        numberOfLines={1}>
        {infoText}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    height: moderateScale(52),
    paddingHorizontal: moderateScale(8),
    gap: moderateScale(4),
  },
  playButtonRect: {
    width: moderateScale(42),
    height: moderateScale(42),
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: moderateScale(12),
    paddingLeft: moderateScale(3),
  },
  reciterText: {
    flex: 1,
    textAlign: 'center',
    fontSize: moderateScale(13),
    fontFamily: 'Manrope-Medium',
    marginHorizontal: moderateScale(4),
  },
  iconButton: {
    padding: moderateScale(8),
  },
  chevronButton: {
    paddingVertical: moderateScale(8),
    paddingHorizontal: moderateScale(12),
  },
  activeContainer: {
    height: moderateScale(52),
    paddingHorizontal: moderateScale(8),
    justifyContent: 'center',
  },
  activeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  controlsCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: moderateScale(8),
  },
  verseInfo: {
    fontSize: moderateScale(11),
    fontFamily: 'Manrope-Medium',
    textAlign: 'center',
    marginTop: moderateScale(1),
  },
});
