import React, {useState, useCallback} from 'react';
import {View, StyleSheet} from 'react-native';
import {Header} from './Header';
import {QueueList} from './QueueList';
import {QuranView} from './QuranView';
import {TrackInfo} from './TrackInfo';
import {PlaybackControls} from './PlaybackControls';
import {ControlButtons} from './ControlButtons';
import {UploadPlaceholder} from './UploadPlaceholder';
import {moderateScale} from 'react-native-size-matters';
import {usePlayerActions} from '@/hooks/usePlayerActions';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {useTheme} from '@/hooks/useTheme';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

interface PlayerContentProps {
  onSpeedPress: () => void;
  onSleepTimerPress: () => void;
  onMushafLayoutPress: () => void;
  onOptionsPress: () => void;
}

const PlayerContent: React.FC<PlayerContentProps> = ({
  onSpeedPress,
  onSleepTimerPress,
  onMushafLayoutPress,
  onOptionsPress,
}) => {
  useTheme();
  const [showQueue, setShowQueue] = useState(false);
  const {updateQueue, removeFromQueue, play} = usePlayerActions();
  const queue = usePlayerStore(s => s.queue);
  const insets = useSafeAreaInsets();

  // Get mushaf settings from the store
  const {
    showTranslation,
    showTransliteration,
    arabicFontSize,
    translationFontSize,
    transliterationFontSize,
  } = useMushafSettingsStore();

  const handleQueuePress = useCallback(() => {
    setShowQueue(prev => !prev);
  }, []);

  const handleQueueItemPress = useCallback(
    async (index: number) => {
      try {
        await updateQueue(queue.tracks, index);
        await play();
      } catch (error) {
        console.error('Error skipping to track:', error);
      }
    },
    [queue.tracks, updateQueue, play],
  );

  const handleRemoveQueueItem = useCallback(
    async (index: number) => {
      try {
        await removeFromQueue([index]);
      } catch (error) {
        console.error('Error removing track:', error);
      }
    },
    [removeFromQueue],
  );

  const handleVersePress = useCallback(async (verseKey: string) => {
    const [surahId, verseNumber] = verseKey
      .split(':')
      .map(num => parseInt(num, 10));
    // TODO: Implement verse selection logic
    console.log('Selected verse:', surahId, verseNumber);
  }, []);

  const currentTrack = queue?.tracks?.[queue?.currentIndex ?? -1];
  const currentSurah = currentTrack?.surahId
    ? parseInt(currentTrack.surahId, 10)
    : undefined;
  const isUntaggedUpload = currentTrack?.isUserUpload && !currentTrack?.surahId;

  return (
    <View style={styles.container}>
      <Header onOptionsPress={onOptionsPress} />
      <View style={styles.viewsContainer}>
        {/* QuranView or UploadPlaceholder */}
        <View
          style={[
            styles.viewWrapper,
            showQueue ? styles.hidden : styles.visible,
          ]}>
          {isUntaggedUpload ? (
            <UploadPlaceholder currentTrack={currentTrack} />
          ) : (
            <QuranView
              currentSurah={currentSurah ?? 1}
              onVersePress={handleVersePress}
              showTranslation={showTranslation}
              showTransliteration={showTransliteration}
              transliterationFontSize={transliterationFontSize}
              translationFontSize={translationFontSize}
              arabicFontSize={arabicFontSize}
            />
          )}
        </View>
        {/* QueueList */}
        <View
          style={[
            styles.viewWrapper,
            showQueue ? styles.visible : styles.hidden,
          ]}>
          <QueueList
            onQueueItemPress={handleQueueItemPress}
            onRemoveQueueItem={handleRemoveQueueItem}
          />
        </View>
      </View>
      <View
        style={[
          styles.controlsContainer,
          {paddingBottom: insets.bottom || moderateScale(20)},
        ]}>
        <TrackInfo />
        <PlaybackControls />
        <ControlButtons
          onSpeedPress={onSpeedPress}
          onSleepTimerPress={onSleepTimerPress}
          onQueuePress={handleQueuePress}
          showQueue={showQueue}
          onMushafLayoutPress={onMushafLayoutPress}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  viewsContainer: {
    flex: 1,
    width: '100%',
    paddingHorizontal: moderateScale(20),
    marginTop: moderateScale(5),
    position: 'relative',
  },
  viewWrapper: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
    paddingHorizontal: moderateScale(20),
  },
  controlsContainer: {
    width: '100%',
    paddingHorizontal: moderateScale(20),
    paddingTop: moderateScale(10),
  },
  visible: {
    display: 'flex',
    opacity: 1,
    zIndex: 1,
  },
  hidden: {
    display: 'none',
    opacity: 0,
    zIndex: 0,
  },
});

export default PlayerContent;
