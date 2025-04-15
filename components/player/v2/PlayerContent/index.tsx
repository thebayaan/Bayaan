import React, {useState, useCallback} from 'react';
import {View, StyleSheet, Platform} from 'react-native';
import BottomSheet, {BottomSheetScrollView} from '@gorhom/bottom-sheet';
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
import {useUnifiedPlayer} from '@/hooks/useUnifiedPlayer';
import {useTheme} from '@/hooks/useTheme';

// Import surah info data
const surahInfo = require('@/data/surahInfo.json');

interface PlayerContentProps {
  speedBottomSheetRef: React.RefObject<BottomSheet>;
  sleepBottomSheetRef: React.RefObject<BottomSheet>;
  queueBottomSheetRef: React.RefObject<BottomSheet>;
  summaryBottomSheetRef: React.RefObject<BottomSheet>;
  mushafLayoutSheetRef: React.RefObject<BottomSheet>;
  showTranslation: boolean;
  showTransliteration: boolean;
  transliterationFontSize: number;
  translationFontSize: number;
  arabicFontSize: number;
}

const PlayerContent: React.FC<PlayerContentProps> = ({
  speedBottomSheetRef,
  sleepBottomSheetRef,
  summaryBottomSheetRef,
  mushafLayoutSheetRef,
  showTranslation,
  showTransliteration,
  transliterationFontSize,
  translationFontSize,
  arabicFontSize,
}) => {
  useTheme();
  const [showQueue, setShowQueue] = useState(false);
  const {queue, updateQueue, removeFromQueue, play} = useUnifiedPlayer();

  const handleQueuePress = useCallback(() => {
    setShowQueue(prev => !prev);
  }, []);

  const handleOpenMushafLayout = useCallback(() => {
    mushafLayoutSheetRef.current?.expand();
  }, [mushafLayoutSheetRef]);

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

  // Custom backdrop for the bottom sheet

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
            {/* Container for QuranView and QueueList */}
            <View style={styles.viewsContainer}>
              {/* QuranView */}
              <View
                style={[
                  styles.viewWrapper,
                  showQueue ? styles.hidden : styles.visible,
                ]}>
                <QuranView
                  currentSurah={currentSurah}
                  onVersePress={handleVersePress}
                  showTranslation={showTranslation}
                  showTransliteration={showTransliteration}
                  transliterationFontSize={transliterationFontSize}
                  translationFontSize={translationFontSize}
                  arabicFontSize={arabicFontSize}
                />
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
            <AdditionalControls />
            <View style={styles.controlsContainer}>
              <TrackInfo />
              <PlaybackControls />
              <ControlButtons
                speedBottomSheetRef={speedBottomSheetRef}
                sleepBottomSheetRef={sleepBottomSheetRef}
                onQueuePress={handleQueuePress}
                showQueue={showQueue}
                onMushafLayoutPress={handleOpenMushafLayout}
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
  viewsContainer: {
    width: '100%',
    aspectRatio: 1,
    maxWidth: MAX_PLAYER_CONTENT_HEIGHT,
    maxHeight: MAX_PLAYER_CONTENT_HEIGHT,
    marginTop: moderateScale(5),
    position: 'relative',
  },
  viewWrapper: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
  },
  controlsContainer: {
    width: '100%',
    marginTop: moderateScale(10),
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
