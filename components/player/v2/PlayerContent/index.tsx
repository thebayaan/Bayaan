import React, {useState, useCallback, useRef, useMemo} from 'react';
import {View, StyleSheet, Platform} from 'react-native';
import BottomSheet, {
  BottomSheetScrollView,
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import {Header} from './Header';
import {QueueList} from './QueueList';
import {QuranView} from './QuranView';
import {TrackInfo} from './TrackInfo';
import {PlaybackControls} from './PlaybackControls';
import {AdditionalControls} from './AdditionalControls';
import {ControlButtons} from './ControlButtons';
import {SurahSummary} from '../SurahSummary';
import {QuranViewOptionsMenu} from './QuranViewOptionsMenu';
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
}

const PlayerContent: React.FC<PlayerContentProps> = ({
  speedBottomSheetRef,
  sleepBottomSheetRef,
  queueBottomSheetRef,
  summaryBottomSheetRef,
}) => {
  const {theme} = useTheme();
  const [showQueue, setShowQueue] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);
  const [showTransliteration, setShowTransliteration] = useState(false);
  const {queue, updateQueue, removeFromQueue, play} = useUnifiedPlayer();

  // Ref for the Quran view options bottom sheet
  const quranOptionsSheetRef = useRef<BottomSheet>(null);

  // Snap points for the bottom sheet
  const snapPoints = useMemo(() => ['30%', '50%'], []); // Adjust snap points as needed

  const toggleTranslation = useCallback(() => {
    setShowTranslation(prev => !prev);
  }, []);

  const toggleTransliteration = useCallback(() => {
    setShowTransliteration(prev => !prev);
  }, []);

  const handleQueuePress = useCallback(() => {
    setShowQueue(prev => !prev);
  }, []);

  const handleOpenQuranOptions = useCallback(() => {
    quranOptionsSheetRef.current?.expand(); // Or snapToIndex(0)
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

  // Custom backdrop for the bottom sheet
  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0} // Appear at the first snap point
        disappearsOnIndex={-1} // Disappear when closed
        opacity={0.4} // Adjust opacity
      />
    ),
    [],
  );

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
                queueBottomSheetRef={queueBottomSheetRef}
                onQueuePress={handleQueuePress}
                showQueue={showQueue}
                onQuranOptionsPress={handleOpenQuranOptions}
              />
            </View>
            <SurahSummary
              surahInfo={surahInfo}
              summaryBottomSheetRef={summaryBottomSheetRef}
            />
          </View>
        </View>
      </BottomSheetScrollView>

      {/* Quran View Options Bottom Sheet */}
      <BottomSheet
        ref={quranOptionsSheetRef}
        index={-1} // Start closed
        snapPoints={snapPoints}
        enablePanDownToClose={true}
        backdropComponent={renderBackdrop}
        backgroundStyle={{backgroundColor: theme.colors.card}} // Match theme
        handleIndicatorStyle={{backgroundColor: theme.colors.border}} // Match theme
      >
        <QuranViewOptionsMenu
          showTranslation={showTranslation}
          toggleTranslation={toggleTranslation}
          showTransliteration={showTransliteration}
          toggleTransliteration={toggleTransliteration}
        />
      </BottomSheet>
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
