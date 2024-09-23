import React, {useState, useEffect} from 'react';
import {View, Text, TouchableOpacity} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale, ScaledSheet} from 'react-native-size-matters';
import PlayerControls from '@/components/player/PlayerControls';
import PlayerProgressBar from '@/components/player/PlayerProgressBar';
import {ReciterImage} from '@/components/ReciterImage';
import {usePlayerStore} from '@/store/playerStore';
import {Theme} from '@/utils/themeUtils';
import PlaybackSpeedModal from '@/components/player/PlaybackSpeedModal';
import SleepTimerModal from '@/components/player/SleepTimerModal';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import TrackPlayer, {Event} from 'react-native-track-player';

const PlayerScreen = () => {
  const {theme} = useTheme();
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
  }));
  const [isSpeedModalVisible, setIsSpeedModalVisible] = useState(false);
  const [isSleepModalVisible, setIsSleepModalVisible] = useState(false);

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

  return (
    <View style={styles(theme).container}>
      <View style={styles(theme).artworkContainer}>
        <ReciterImage
          imageUrl={activeTrack?.artwork}
          width={250}
          height={250}
        />
      </View>
      <View style={styles(theme).trackInfoContainer}>
        <Text style={styles(theme).surahName}>{activeTrack?.title}</Text>
        <Text style={styles(theme).reciterName}>{activeTrack?.artist}</Text>
      </View>
      <PlayerProgressBar />
      <PlayerControls />
      <View style={styles(theme).controlButtonsContainer}>
        <View>
          <TouchableOpacity
            style={styles(theme).speedButton}
            onPress={() => setIsSpeedModalVisible(true)}>
            <Text
              style={[
                styles(theme).speedButtonText,
                playbackSpeed !== 1 && {color: theme.colors.primary},
              ]}>
              {`${playbackSpeed}x`}
            </Text>
          </TouchableOpacity>
          {playbackSpeed !== 1 && <View style={styles(theme).activeDot} />}
        </View>
        <View>
          <TouchableOpacity
            style={styles(theme).repeatButton}
            onPress={toggleRepeatMode}>
            <MaterialCommunityIcons
              name={repeatMode === 'once' ? 'repeat-once' : 'repeat'}
              size={moderateScale(24)}
              color={
                repeatMode === 'off' ? theme.colors.text : theme.colors.primary
              }
            />
          </TouchableOpacity>
          {repeatMode !== 'off' && <View style={styles(theme).activeDot} />}
        </View>
        <View>
          <TouchableOpacity
            style={styles(theme).sleepButton}
            onPress={() => setIsSleepModalVisible(true)}>
            <MaterialCommunityIcons
              name={sleepTimer || isEndOfSurahTimer ? 'timer' : 'timer-outline'}
              size={moderateScale(24)}
              color={
                sleepTimer || isEndOfSurahTimer
                  ? theme.colors.primary
                  : theme.colors.text
              }
            />
          </TouchableOpacity>
          {(sleepTimer || isEndOfSurahTimer) && (
            <View style={styles(theme).activeDot} />
          )}
        </View>
      </View>
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
    </View>
  );
};

const styles = (theme: Theme) =>
  ScaledSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: moderateScale(20),
      backgroundColor: theme.colors.background,
    },
    artworkContainer: {
      width: moderateScale(250),
      height: moderateScale(250),
      marginBottom: moderateScale(20),
      justifyContent: 'center',
      alignItems: 'center',
    },
    trackInfoContainer: {
      alignSelf: 'stretch',
      marginBottom: moderateScale(20),
      marginLeft: moderateScale(20),
    },
    surahName: {
      fontSize: moderateScale(18),
      fontWeight: 'bold',
      color: theme.colors.text,
      marginBottom: moderateScale(5),
    },
    reciterName: {
      fontSize: moderateScale(16),
      color: theme.colors.textSecondary,
    },
    controlButtonsContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      width: '100%',
      paddingHorizontal: moderateScale(20),
      marginTop: moderateScale(10),
    },
    speedButton: {
      padding: moderateScale(3),
      backgroundColor: 'transparent',
      borderRadius: moderateScale(5),
    },
    speedButtonText: {
      color: theme.colors.text,
      fontSize: moderateScale(18),
      fontWeight: 'bold',
    },
    repeatButton: {
      padding: moderateScale(3),
      backgroundColor: 'transparent',
      borderRadius: moderateScale(5),
    },
    sleepButton: {
      padding: moderateScale(3),
      backgroundColor: 'transparent',
      borderRadius: moderateScale(5),
    },
    activeDot: {
      width: moderateScale(5),
      height: moderateScale(3),
      borderRadius: moderateScale(2),
      backgroundColor: theme.colors.primary,
      alignSelf: 'center',
    },
  });

export default PlayerScreen;
