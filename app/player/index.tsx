import React, {useState, useEffect, useMemo} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale} from 'react-native-size-matters';
import PlayerControls from '@/components/player/PlayerControls';
import PlayerProgressBar from '@/components/player/PlayerProgressBar';
import {ReciterImage} from '@/components/ReciterImage';
import {usePlayerStore} from '@/store/playerStore';
import PlaybackSpeedModal from '@/components/player/PlaybackSpeedModal';
import SleepTimerModal from '@/components/player/SleepTimerModal';
import TrackPlayer, {Event} from 'react-native-track-player';
import {Icon} from '@rneui/themed';
import {useRouter} from 'expo-router';
import {EdgeInsets, useSafeAreaInsets} from 'react-native-safe-area-context';
import {surahGlyphMap} from '@/utils/surahGlyphMap';
import PlayerControlButtons from '@/components/player/PlayerControlButtons';
import TrackInfo from '@/components/player/TrackInfo';
import {Theme} from '@/utils/themeUtils';
import AdditionalControls from '@/components/player/AdditionalControls';
import {useTrackPlayerFavorite} from '@/hooks/usePlayerFavorite';
import PlayerOptionsModal from '@/components/player/PlayerOptionsModal';
import {MAX_PLAYER_CONTENT_HEIGHT} from '@/utils/constants';
import SurahSummary from '@/components/player/SurahSummary';
import QueueModal from '@/components/player/QueueModal';
import {useQueueManagement} from '@/hooks/useQueueManagement';

type SurahInfo = {
  [key: string]: {
    surah_number: number;
    surah_name: string;
    text: string;
    short_text: string;
  };
};

const surahInfo: SurahInfo = require('@/data/surahInfo.json');

// const {width: SCREEN_WIDTH, height: SCREEN_HEIGHT} = Dimensions.get('window');

const PlayerScreen = () => {
  const {theme} = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const activeTrack = usePlayerStore(state => state.activeTrack);
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
    activeTrack: state.activeTrack,
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
    isPlaying: state.isPlaying,
    togglePlayback: state.togglePlayback,
    seekTo: state.seekTo,
    skipToNext: state.skipToNext,
  }));
  const {isFavorite, toggleFavorite} = useTrackPlayerFavorite();
  const [isSpeedModalVisible, setIsSpeedModalVisible] = useState(false);
  const [isSleepModalVisible, setIsSleepModalVisible] = useState(false);
  const [isOptionsModalVisible, setIsOptionsModalVisible] = useState(false);
  const [isFavoriteTrack, setIsFavoriteTrack] = useState(false);
  const [isQueueModalVisible, setIsQueueModalVisible] = useState(false);

  const {queue, handleQueuePress, handleTrackPress, handleRemoveTrack} =
    useQueueManagement();

  const handleSpeedChange = async (speed: number) => {
    setPlaybackSpeed(speed);
    setIsSpeedModalVisible(false);
  };

  const handleSleepTimerChange = (minutes: number | 'END_OF_SURAH') => {
    setSleepTimer(minutes);
    setIsSleepModalVisible(false);
  };

  const handleTurnOffTimer = () => {
    clearSleepTimer();
  };

  const handleClose = () => {
    router.back();
  };

  const handleToggleFavorite = () => {
    if (activeTrack) {
      toggleFavorite(activeTrack.reciterId, activeTrack.id);
      setIsFavoriteTrack(!isFavoriteTrack);
    }
  };

  const handleOpenOptions = () => {
    setIsOptionsModalVisible(true);
  };

  const handleOpenQueue = async () => {
    await handleQueuePress();
    setIsQueueModalVisible(true);
  };

  useEffect(() => {
    return () => {
      if (sleepTimer) {
        clearTimeout(sleepTimer);
      }
    };
  }, [sleepTimer]);

  useEffect(() => {
    const listener = TrackPlayer.addEventListener(
      Event.PlaybackQueueEnded,
      handleTrackEnd,
    );
    return () => listener.remove();
  }, [handleTrackEnd]);

  useEffect(() => {
    if (activeTrack) {
      const isFav = isFavorite(activeTrack.reciterId, activeTrack.id);
      setIsFavoriteTrack(isFav);
    }
  }, [activeTrack, isFavorite]);

  const surahNumber = activeTrack?.id
    ? parseInt(activeTrack.id, 10)
    : undefined;
  const surahGlyph = surahNumber
    ? surahGlyphMap[surahNumber] + surahGlyphMap[0]
    : '';

  const styles = useMemo(() => createStyles(theme, insets), [theme, insets]);

  // const albumArtSize = useMemo(() => {
  //   const availableHeight = SCREEN_HEIGHT - insets.top - insets.bottom - 400; // Adjust 400 based on the total height of other components
  //   return Math.min(availableHeight, SCREEN_WIDTH * 0.8);
  // }, [SCREEN_HEIGHT, SCREEN_WIDTH, insets.top, insets.bottom]);
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
          <Icon
            name="chevron-down"
            type="feather"
            size={moderateScale(24)}
            color={theme.colors.text}
          />
        </TouchableOpacity>
        <Text style={styles.arabicSurahName}>{surahGlyph}</Text>
      </View>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <View style={styles.contentContainer}>
          <View style={styles.albumArtContainer}>
            <ReciterImage
              imageUrl={activeTrack?.artwork}
              style={styles.reciterImage}
            />
          </View>
          <View style={styles.additionalControlsContainer}>
            <AdditionalControls
              isFavorite={isFavoriteTrack}
              onToggleFavorite={handleToggleFavorite}
              onOpenOptions={handleOpenOptions}
            />
          </View>
          <View style={styles.controlsContainer}>
            <View style={styles.progressBarContainer}>
              <PlayerProgressBar />
            </View>
            <View style={styles.trackInfoContainer}>
              <TrackInfo
                surahName={activeTrack?.title || ''}
                reciterName={activeTrack?.artist || ''}
              />
            </View>
            <View style={styles.playerControlsContainer}>
              <PlayerControls />
            </View>
            <View style={styles.playerControlButtonsContainer}>
              <PlayerControlButtons
                playbackSpeed={playbackSpeed}
                repeatMode={repeatMode}
                sleepTimer={sleepTimer}
                isEndOfSurahTimer={isEndOfSurahTimer}
                onSpeedPress={() => setIsSpeedModalVisible(true)}
                onRepeatPress={toggleRepeatMode}
                onSleepTimerPress={() => setIsSleepModalVisible(true)}
                onQueuePress={handleOpenQueue}
              />
            </View>
          </View>
          <SurahSummary surahNumber={surahNumber} surahInfo={surahInfo} />
        </View>
      </ScrollView>
      <PlaybackSpeedModal
        isVisible={isSpeedModalVisible}
        onClose={() => setIsSpeedModalVisible(false)}
        onSpeedChange={handleSpeedChange}
      />
      <SleepTimerModal
        isVisible={isSleepModalVisible}
        onClose={() => setIsSleepModalVisible(false)}
        onTimerChange={handleSleepTimerChange}
        onTurnOffTimer={handleTurnOffTimer}
        sleepTimer={sleepTimer}
        remainingTime={
          sleepTimerEnd ? Math.ceil((sleepTimerEnd - Date.now()) / 60000) : null
        }
      />
      <PlayerOptionsModal
        isVisible={isOptionsModalVisible}
        onClose={() => setIsOptionsModalVisible(false)}
      />
      <QueueModal
        isVisible={isQueueModalVisible}
        onClose={() => setIsQueueModalVisible(false)}
        queue={queue}
        currentTrackId={activeTrack?.id}
        onTrackPress={handleTrackPress}
        onRemoveTrack={handleRemoveTrack}
      />
    </View>
  );
};

const createStyles = (theme: Theme, insets: EdgeInsets) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
      paddingTop: insets.top,
      borderTopLeftRadius: moderateScale(12),
      borderTopRightRadius: moderateScale(12),
      marginTop: moderateScale(-20),
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: moderateScale(16),
      paddingHorizontal: moderateScale(16),
    },
    closeButton: {
      position: 'absolute',
      left: moderateScale(16),
      zIndex: 1,
    },
    arabicSurahName: {
      fontFamily: 'SurahNames',
      fontSize: moderateScale(24),
      color: theme.colors.text,
    },
    scrollContent: {
      flexGrow: 1,
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
      shadowColor: theme.colors.shadow,
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 5,
      marginTop: moderateScale(5),
      borderRadius: moderateScale(20),
    },
    reciterImage: {
      width: '100%',
      height: '100%',
    },
    controlsContainer: {
      width: '100%',
      marginTop: moderateScale(16),
    },
    additionalControlsContainer: {
      alignItems: 'center',
    },
    trackInfoContainer: {
      marginBottom: moderateScale(16),
    },
    progressBarContainer: {
      marginBottom: moderateScale(16),
    },
    playerControlsContainer: {
      marginBottom: moderateScale(16),
    },
    playerControlButtonsContainer: {
      marginBottom: moderateScale(16),
    },
  });

export default PlayerScreen;
