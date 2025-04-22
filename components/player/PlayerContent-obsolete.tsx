import React, {useState, useEffect, useMemo, useCallback, useRef} from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale} from 'react-native-size-matters';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import PlaybackControls from '@/components/player/PlaybackControls-obsolete';
import PlayerProgressBar from '@/components/player/PlayerProgressBar-obsolete';
import {ReciterImage} from '@/components/ReciterImage';
import {usePlayerStore} from '@/store/playerStore';
import PlaybackSpeedModal from '@/components/player/PlaybackSpeedModal-obsolete';
import SleepTimerModal from '@/components/player/SleepTimerModal-obsolete';
import TrackPlayer, {Event} from 'react-native-track-player';
import {Icon} from '@rneui/themed';
import {surahGlyphMap} from '@/utils/surahGlyphMap';
import PlayerControlButtons from '@/components/player/PlayerControlButtons-obsolete';
import TrackInfo from '@/components/player/TrackInfo-obsolete';
import AdditionalControls from '@/components/player/AdditionalControls-obsolete';
import {useTrackPlayerFavorite} from '@/hooks/usePlayerFavorite';
import {MAX_PLAYER_CONTENT_HEIGHT} from '@/utils/constants';
import SurahSummary from '@/components/player/SurahSummary-obsolete';
import {useReciterNavigation} from '@/hooks/useReciterNavigation';
import QueueModal from '@/components/player/QueueModal-obsolete';
import Color from 'color';
import BottomSheet from '@gorhom/bottom-sheet';
import {Theme} from '@/utils/themeUtils';
import {usePlayerBackground} from '@/hooks/usePlayerBackground';
import {LinearGradient} from 'expo-linear-gradient';
import {BottomSheetScrollView} from '@gorhom/bottom-sheet';

type SurahInfo = {
  [key: string]: {
    surah_number: number;
    surah_name: string;
    text: string;
    short_text: string;
  };
};

const surahInfo: SurahInfo = require('@/data/surahInfo.json');

export const PlayerContent = () => {
  const {theme, isDarkMode} = useTheme();
  const insets = useSafeAreaInsets();
  const currentTrack = usePlayerStore(state => state.currentTrack);
  const updateCurrentTrack = usePlayerStore(state => state.updateCurrentTrack);
  const setPlayerSheetVisible = usePlayerStore(
    state => state.setPlayerSheetVisible,
  );
  const {gradientColors} = usePlayerBackground(theme, isDarkMode);
  const {
    setSleepTimer,
    clearSleepTimer,
    sleepTimer,
    sleepTimerEnd,
    playbackSpeed,
    setPlaybackSpeed,
    repeatMode,
    toggleRepeatMode,
    handleTrackEnd,
    isEndOfSurahTimer,
  } = usePlayerStore(state => ({
    setSleepTimer: state.setSleepTimer,
    clearSleepTimer: state.clearSleepTimer,
    sleepTimer: state.sleepTimer,
    sleepTimerEnd: state.sleepTimerEnd,
    playbackSpeed: state.playbackSpeed,
    setPlaybackSpeed: state.setPlaybackSpeed,
    repeatMode: state.repeatMode,
    toggleRepeatMode: state.toggleRepeatMode,
    handleTrackEnd: state.handleTrackEnd,
    isEndOfSurahTimer: state.isEndOfSurahTimer,
  }));

  const {isFavorite, toggleFavorite} = useTrackPlayerFavorite();
  const [isFavoriteTrack, setIsFavoriteTrack] = useState(false);

  const bottomSheetRef = useRef<BottomSheet>(null);
  const playbackSpeedBottomSheetRef = useRef<BottomSheet>(null);
  const queueBottomSheetRef = useRef<BottomSheet>(null);

  const [remainingTime, setRemainingTime] = useState<number | null>(null);
  const {navigateToReciterProfile} = useReciterNavigation();

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (sleepTimerEnd && typeof sleepTimerEnd === 'number') {
      interval = setInterval(() => {
        const remaining = Math.max(
          0,
          Math.ceil((sleepTimerEnd - Date.now()) / 60000),
        );
        setRemainingTime(remaining);
        if (remaining === 0) {
          clearInterval(interval);
        }
      }, 1000);
    } else {
      setRemainingTime(null);
    }
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [sleepTimerEnd]);

  const handleSpeedChange = async (speed: number) => {
    setPlaybackSpeed(speed);
    playbackSpeedBottomSheetRef.current?.close();
  };

  const handleSleepTimerChange = (minutes: number | 'END_OF_SURAH') => {
    setSleepTimer(minutes);
  };

  const handleTurnOffTimer = () => {
    clearSleepTimer();
  };

  const handleClose = () => {
    setPlayerSheetVisible(false);
  };

  const handleToggleFavorite = () => {
    if (currentTrack) {
      toggleFavorite(currentTrack.reciterId, currentTrack.id);
      setIsFavoriteTrack(!isFavoriteTrack);
    }
  };

  const handleOpenQueue = () => {
    queueBottomSheetRef.current?.expand();
  };

  const handleCloseQueue = () => {
    queueBottomSheetRef.current?.close();
  };

  const handleSleepTimerPress = () => {
    bottomSheetRef.current?.expand();
  };

  const handleSpeedPress = () => {
    playbackSpeedBottomSheetRef.current?.expand();
  };

  useEffect(() => {
    return () => {
      if (sleepTimer) {
        clearTimeout(sleepTimer);
        clearSleepTimer();
      }
    };
  }, [sleepTimer, clearSleepTimer]);

  useEffect(() => {
    const listener = TrackPlayer.addEventListener(
      Event.PlaybackQueueEnded,
      handleTrackEnd,
    );
    return () => listener.remove();
  }, [handleTrackEnd]);

  useEffect(() => {
    if (currentTrack) {
      const isFav = isFavorite(currentTrack.reciterId, currentTrack.id);
      setIsFavoriteTrack(isFav);
    }
  }, [currentTrack, isFavorite]);

  useEffect(() => {
    updateCurrentTrack();
  }, [updateCurrentTrack]);

  const surahNumber = currentTrack?.surahId
    ? parseInt(currentTrack.surahId, 10)
    : undefined;
  const surahGlyph =
    surahNumber && surahGlyphMap[surahNumber]
      ? surahGlyphMap[surahNumber] + surahGlyphMap[0]
      : '';

  const handleReciterPress = useCallback(() => {
    if (currentTrack) {
      navigateToReciterProfile(currentTrack.reciterId);
    }
  }, [currentTrack, navigateToReciterProfile]);

  const baseColor = Color(gradientColors[0]);
  const contrastColor = baseColor.isLight()
    ? baseColor.darken(0.8).saturate(0.2)
    : baseColor.lighten(4.8).saturate(0.2);

  const styles = useMemo(
    () => createStyles(theme, contrastColor.string(), insets),
    [theme, contrastColor, insets],
  );

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={gradientColors as [string, string, ...string[]]}
        style={StyleSheet.absoluteFill}
      />

      <BottomSheetScrollView
        contentContainerStyle={styles.scrollContent}
        bounces={false}
        showsVerticalScrollIndicator={false}>
        <View style={[styles.header]}>
          <TouchableOpacity
            activeOpacity={0.99}
            style={styles.closeButton}
            onPress={handleClose}>
            <Icon
              name="chevron-thin-down"
              type="entypo"
              size={moderateScale(22)}
              color={contrastColor.string()}
            />
          </TouchableOpacity>
          <Text
            style={[styles.arabicSurahName, {color: contrastColor.string()}]}>
            {surahGlyph}
          </Text>
        </View>
        <View style={styles.contentContainer}>
          <View style={styles.albumArtContainer}>
            <ReciterImage
              imageUrl={currentTrack?.artwork}
              reciterName={currentTrack?.artist || ''}
              style={styles.reciterImage}
            />
          </View>
          <View style={styles.additionalControlsContainer}>
            <AdditionalControls
              isFavorite={isFavoriteTrack}
              onToggleFavorite={handleToggleFavorite}
            />
          </View>
          <View style={styles.controlsContainer}>
            <View style={styles.progressBarContainer}>
              <PlayerProgressBar />
            </View>
            <View style={styles.trackInfoContainer}>
              <TrackInfo
                surahName={currentTrack?.title || ''}
                reciterName={currentTrack?.artist || ''}
                onReciterPress={handleReciterPress}
              />
            </View>
            <View style={styles.playbackControlsContainer}>
              <PlaybackControls />
            </View>
            <View style={styles.playerControlButtonsContainer}>
              <PlayerControlButtons
                playbackSpeed={playbackSpeed}
                repeatMode={repeatMode}
                sleepTimer={sleepTimer}
                isEndOfSurahTimer={isEndOfSurahTimer}
                onSpeedPress={handleSpeedPress}
                onRepeatPress={toggleRepeatMode}
                onSleepTimerPress={handleSleepTimerPress}
                onQueuePress={handleOpenQueue}
              />
            </View>
          </View>
          <SurahSummary surahNumber={surahNumber} surahInfo={surahInfo} />
        </View>
      </BottomSheetScrollView>
      <PlaybackSpeedModal
        bottomSheetRef={playbackSpeedBottomSheetRef}
        onSpeedChange={handleSpeedChange}
        currentSpeed={playbackSpeed}
      />
      <SleepTimerModal
        bottomSheetRef={bottomSheetRef}
        onTimerChange={handleSleepTimerChange}
        onTurnOffTimer={handleTurnOffTimer}
        sleepTimer={sleepTimer}
        remainingTime={remainingTime}
        currentTimer={sleepTimerEnd}
      />
      <QueueModal
        bottomSheetRef={queueBottomSheetRef}
        onClose={handleCloseQueue}
      />
    </View>
  );
};

const createStyles = (theme: Theme, textColor: string, insets: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: 'transparent',
      overflow: 'hidden',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: moderateScale(16),
      marginTop: insets.top,
    },
    closeButton: {
      position: 'absolute',
      left: moderateScale(16),
      zIndex: 1,
      padding: moderateScale(10),
      width: moderateScale(44),
      height: moderateScale(44),
      justifyContent: 'center',
      alignItems: 'center',
    },
    arabicSurahName: {
      fontFamily: 'SurahNames',
      fontSize: moderateScale(24),
      color: textColor,
    },
    scrollContent: {
      flexGrow: 1,
      paddingBottom: moderateScale(30),
    },
    contentContainer: {
      alignItems: 'center',
      paddingHorizontal: moderateScale(20),
      paddingBottom: moderateScale(16),
      maxWidth: MAX_PLAYER_CONTENT_HEIGHT,
      width: '100%',
      alignSelf: 'center',
    },
    albumArtContainer: {
      width: '100%',
      aspectRatio: 1,
      maxWidth: MAX_PLAYER_CONTENT_HEIGHT,
      maxHeight: MAX_PLAYER_CONTENT_HEIGHT,
      marginTop: moderateScale(25),
    },
    reciterImage: {
      width: '100%',
      height: '100%',
      borderRadius: moderateScale(15),
    },
    additionalControlsContainer: {
      width: '100%',
      flexDirection: 'row',
      justifyContent: 'flex-end',
      marginTop: moderateScale(10),
    },
    controlsContainer: {
      width: '100%',
      marginTop: moderateScale(10),
    },
    progressBarContainer: {
      width: '100%',
      marginBottom: moderateScale(10),
    },
    trackInfoContainer: {
      width: '100%',
      marginBottom: moderateScale(16),
    },
    playbackControlsContainer: {
      width: '100%',
      marginBottom: moderateScale(16),
    },
    playerControlButtonsContainer: {
      width: '100%',
      marginBottom: moderateScale(16),
    },
  });
