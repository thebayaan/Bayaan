/**
 * MushafPlayerBar - Dual-mode bottom bar for mushaf audio playback
 *
 * Idle state:   [Search] ---- [Play] ---- [...]
 * Active state: [Stop]  ---- [Prev] [Play/Pause] [Next] ---- [...]
 *                           Surah Name S:A (centered below)
 *
 * The verse reference comes from the store's currentVerseLabel, which is in
 * the numbering of the mushaf on screen (a Warsh reciter in a Warsh mushaf
 * shows Warsh numbers). Surahs whose timing numbering is unknown show no
 * verse and disable previous / next ayah; when such a surah was asked to
 * start at a later verse, a notice says it plays from the beginning.
 */

import React, {useCallback, useEffect} from 'react'; // @ai
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
import Color from 'color';
import {useTheme} from '@/hooks/useTheme';
import {
  formatPlaybackInfo, // @ai
  getPlayerBarNotice, // @ai
  useMushafPlayerStore,
} from '@/store/mushafPlayerStore';
import {mushafAudioService} from '@/services/audio/MushafAudioService';
import {SURAHS} from '@/data/surahData';
import {PlayIcon, PauseIcon} from '@/components/Icons';
import {showToast} from '@/utils/toastUtils'; // @ai

// @ai-start
const surahNameOf = (surah: number): string =>
  surah >= 1 && surah <= 114 ? SURAHS[surah - 1].name : '';
// @ai-end

interface MushafPlayerBarProps {
  currentPage: number;
  onSearch?: () => void;
}

export const MushafPlayerBar: React.FC<MushafPlayerBarProps> = ({
  currentPage,
  onSearch,
}) => {
  const {theme} = useTheme();

  const playbackState = useMushafPlayerStore(s => s.playbackState);
  const currentSurah = useMushafPlayerStore(s => s.currentSurah);
  const currentVerseLabel = useMushafPlayerStore(s => s.currentVerseLabel);
  const numberingMode = useMushafPlayerStore(s => s.numberingMode); // @ai
  const verseTrackingUnavailable = numberingMode === 'disabled'; // @ai
  const timestampError = useMushafPlayerStore(s => s.timestampError);
  const isIdle = playbackState === 'idle';
  const isLoading = playbackState === 'loading';
  const isPlaying = playbackState === 'playing';

  const surahName =
    currentSurah >= 1 && currentSurah <= 114
      ? SURAHS[currentSurah - 1].name
      : '';

  // @ai-start
  // Refusals and "Verse tracking unavailable" are shown inline below; a
  // requested start verse that was skipped (the surah plays from its
  // beginning without verse tracking) needs a notice.
  useEffect(
    () =>
      useMushafPlayerStore.subscribe((state, prev) => {
        const notice = getPlayerBarNotice(prev, state, surahNameOf);
        if (notice) showToast(notice.title, notice.message, notice.preset);
      }),
    [],
  );
  // @ai-end

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

  const handleChangeReciter = useCallback(() => {
    useMushafPlayerStore.setState({timestampError: null, currentPage});
    SheetManager.show('mushaf-player-options', {
      payload: {currentPage},
    });
  }, [currentPage]);

  // ── Error state: show message + change reciter button ────
  if (isIdle && timestampError) {
    return (
      <View style={styles.errorContainer}>
        <Text
          style={[
            styles.errorText,
            {color: Color(theme.colors.text).alpha(0.7).toString()},
          ]}
          numberOfLines={1}>
          {timestampError}
        </Text>
        <Pressable
          style={[
            styles.changeReciterButton,
            {backgroundColor: Color(theme.colors.text).alpha(0.08).toString()},
          ]}
          onPress={handleChangeReciter}
          accessibilityRole="button"
          accessibilityLabel="Change reciter">
          <Text style={[styles.changeReciterText, {color: theme.colors.text}]}>
            Change Reciter
          </Text>
        </Pressable>
      </View>
    );
  }

  // ── Idle state: [Search] — spacer — [Play] — spacer — [Options] ────
  if (isIdle) {
    return (
      <View style={styles.idleRow}>
        <Pressable
          style={styles.edgeButton}
          onPress={onSearch}
          accessibilityRole="button"
          accessibilityLabel="Search">
          <Feather
            name="search"
            size={moderateScale(20)}
            color={theme.colors.text}
          />
        </Pressable>

        <View style={styles.controlsCenter}>
          <Pressable
            style={[
              styles.playButtonRect,
              {backgroundColor: Color(theme.colors.text).alpha(0.1).toString()},
            ]}
            onPress={handlePlayPress}
            accessibilityRole="button"
            accessibilityLabel="Play">
            <PlayIcon color={theme.colors.text} size={moderateScale(16)} />
          </Pressable>
        </View>

        <Pressable
          style={styles.edgeButton}
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
  // Same text as the iOS 26 toolbar (formatPlaybackInfo).
  const infoText = formatPlaybackInfo(surahName, {
    currentVerseLabel,
    numberingMode,
  }); // @ai
  const verseNavDisabled = verseTrackingUnavailable;
  const chevronColor = verseNavDisabled
    ? Color(theme.colors.text).alpha(0.3).toString()
    : theme.colors.text;

  return (
    <View style={styles.activeContainer}>
      {/* Row 1: [Stop] ---- [Prev] [Play/Pause] [Next] ---- [Options] */}
      <View style={styles.activeRow}>
        <Pressable
          style={styles.edgeButton}
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
            disabled={verseNavDisabled}
            accessibilityRole="button"
            accessibilityLabel="Previous ayah"
            accessibilityState={{disabled: verseNavDisabled}}>
            <Feather
              name="chevrons-left"
              size={moderateScale(22)}
              color={chevronColor}
            />
          </Pressable>

          <Pressable
            style={styles.playPauseButton}
            onPress={handlePlayPause}
            disabled={isLoading}
            accessibilityRole="button"
            accessibilityLabel={isPlaying ? 'Pause' : 'Play'}>
            {isLoading ? (
              <ActivityIndicator size="small" color={theme.colors.text} />
            ) : isPlaying ? (
              <PauseIcon color={theme.colors.text} size={moderateScale(22)} />
            ) : (
              <View style={styles.playIconOffset}>
                <PlayIcon color={theme.colors.text} size={moderateScale(22)} />
              </View>
            )}
          </Pressable>

          <Pressable
            style={styles.chevronButton}
            onPress={handleNextAyah}
            disabled={verseNavDisabled}
            accessibilityRole="button"
            accessibilityLabel="Next ayah"
            accessibilityState={{disabled: verseNavDisabled}}>
            <Feather
              name="chevrons-right"
              size={moderateScale(22)}
              color={chevronColor}
            />
          </Pressable>
        </View>

        <Pressable
          style={styles.edgeButton}
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
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: moderateScale(52),
    paddingHorizontal: moderateScale(12),
    gap: moderateScale(10),
  },
  errorText: {
    flex: 1,
    fontSize: moderateScale(11.5),
    fontFamily: 'Manrope-Regular',
  },
  changeReciterButton: {
    paddingHorizontal: moderateScale(14),
    paddingVertical: moderateScale(8),
    borderRadius: moderateScale(10),
  },
  changeReciterText: {
    fontSize: moderateScale(12),
    fontFamily: 'Manrope-SemiBold',
  },
  idleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: moderateScale(52),
    paddingHorizontal: moderateScale(8),
  },
  playButtonRect: {
    width: moderateScale(42),
    height: moderateScale(42),
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: moderateScale(12),
    paddingLeft: moderateScale(3),
  },
  edgeButton: {
    width: moderateScale(36),
    height: moderateScale(36),
    justifyContent: 'center',
    alignItems: 'center',
  },
  playPauseButton: {
    width: moderateScale(38),
    height: moderateScale(38),
    justifyContent: 'center',
    alignItems: 'center',
  },
  playIconOffset: {
    marginLeft: moderateScale(3),
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
