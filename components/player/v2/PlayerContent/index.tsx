import React, {useState, useCallback, useEffect} from 'react';
import {View, StyleSheet} from 'react-native';
import {QueueList} from './QueueList';
import {QuranView} from './QuranView';
import {TrackInfo} from './TrackInfo';
import {PlaybackControls} from './PlaybackControls';
import {ControlButtons} from './ControlButtons';
import {UploadPlaceholder} from './UploadPlaceholder';
import {moderateScale} from 'react-native-size-matters';
import {usePlayerActions} from '@/hooks/usePlayerActions';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {useVerseSelectionStore} from '@/store/verseSelectionStore';
import {useTheme} from '@/hooks/useTheme';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

interface PlayerContentProps {
  onSpeedPress: () => void;
  onSleepTimerPress: () => void;
  onMushafLayoutPress: () => void;
  onAmbientPress: () => void;
}

const PlayerContent: React.FC<PlayerContentProps> = ({
  onSpeedPress,
  onSleepTimerPress,
  onMushafLayoutPress,
  onAmbientPress,
}) => {
  useTheme();
  const [showQueue, setShowQueue] = useState(false);
  const {updateQueue, removeFromQueue, play} = usePlayerActions();
  const queue = usePlayerStore(s => s.queue);
  const insets = useSafeAreaInsets();

  // Granular mushaf settings selectors (avoid full-store subscription)
  const showTranslation = useMushafSettingsStore(s => s.showTranslation);
  const showTransliteration = useMushafSettingsStore(
    s => s.showTransliteration,
  );
  const arabicFontSize = useMushafSettingsStore(s => s.arabicFontSize);
  const translationFontSize = useMushafSettingsStore(
    s => s.translationFontSize,
  );
  const transliterationFontSize = useMushafSettingsStore(
    s => s.transliterationFontSize,
  );

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

  // Clear verse selection when surah changes
  useEffect(() => {
    useVerseSelectionStore.getState().clearSelection();
  }, [currentSurah]);

  return (
    <View style={styles.container}>
      <View style={styles.viewsContainer}>
        {showQueue ? (
          <View style={styles.viewWrapper}>
            <QueueList
              onQueueItemPress={handleQueueItemPress}
              onRemoveQueueItem={handleRemoveQueueItem}
            />
          </View>
        ) : (
          <View style={styles.viewWrapper}>
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
        )}
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
          onAmbientPress={onAmbientPress}
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
    marginTop: moderateScale(5),
    position: 'relative',
  },
  viewWrapper: {
    height: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: moderateScale(20),
  },
  controlsContainer: {
    width: '100%',
    paddingHorizontal: moderateScale(20),
    paddingTop: moderateScale(10),
  },
});

export default PlayerContent;
