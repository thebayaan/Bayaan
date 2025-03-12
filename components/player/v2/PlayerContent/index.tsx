import React, {useState, useCallback} from 'react';
import {View, StyleSheet, Platform} from 'react-native';
import {BottomSheetScrollView} from '@gorhom/bottom-sheet';
import {Header} from './Header';
import {QueueList} from './QueueList';
import {QuranView} from './QuranView';
import {TrackInfo} from './TrackInfo';
import {PlaybackControls} from './PlaybackControls';
import {AdditionalControls} from './AdditionalControls';
import {ControlButtons} from './ControlButtons';
import {SurahSummary} from '../SurahSummary';
import {moderateScale} from 'react-native-size-matters';
import {MAX_PLAYER_CONTENT_HEIGHT} from '@/utils/constants';
import type BottomSheet from '@gorhom/bottom-sheet';
import {useUnifiedPlayer} from '@/hooks/useUnifiedPlayer';

// Import surah info data
const surahInfo = require('@/data/surahInfo.json');

interface PlayerContentProps {
  speedBottomSheetRef: React.RefObject<BottomSheet>;
  sleepBottomSheetRef: React.RefObject<BottomSheet>;
  queueBottomSheetRef: React.RefObject<BottomSheet>;
  summaryBottomSheetRef: React.RefObject<BottomSheet>;
}

const PlayerContent: React.FC<PlayerContentProps> = ({
  speedBottomSheetRef,
  sleepBottomSheetRef,
  queueBottomSheetRef,
  summaryBottomSheetRef,
}) => {
  const [showQueue, setShowQueue] = useState(false);
  const {queue, updateQueue, removeFromQueue, play} = useUnifiedPlayer();

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
    : 1;

  const renderContent = () => {
    if (showQueue) {
      return (
        <QueueList
          onQueueItemPress={handleQueueItemPress}
          onRemoveQueueItem={handleRemoveQueueItem}
        />
      );
    }
    return (
      <QuranView currentSurah={currentSurah} onVersePress={handleVersePress} />
    );
  };

  return (
    <View style={styles.container}>
      <BottomSheetScrollView
        contentContainerStyle={styles.scrollContent}
        bounces={false}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled={Platform.OS === 'android'}>
        <View style={styles.contentContainer}>
          <Header />
          <View style={styles.mainContent}>
            {renderContent()}
            <AdditionalControls />
            <View style={styles.controlsContainer}>
              <TrackInfo />
              <PlaybackControls />
              <ControlButtons
                speedBottomSheetRef={speedBottomSheetRef}
                sleepBottomSheetRef={sleepBottomSheetRef}
                queueBottomSheetRef={queueBottomSheetRef}
                onQueuePress={handleQueuePress}
                showQueue={showQueue}
              />
            </View>
            <SurahSummary
              surahInfo={surahInfo}
              summaryBottomSheetRef={summaryBottomSheetRef}
            />
          </View>
        </View>
      </BottomSheetScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: moderateScale(10),
  },
  contentContainer: {
    alignItems: 'center',
    width: '100%',
  },
  mainContent: {
    width: '100%',
    maxWidth: MAX_PLAYER_CONTENT_HEIGHT,
    paddingHorizontal: moderateScale(20),
    paddingTop: moderateScale(5),
    paddingBottom: moderateScale(20),
    alignItems: 'center',
  },
  controlsContainer: {
    width: '100%',
    marginTop: moderateScale(10),
  },
});

export default PlayerContent;
