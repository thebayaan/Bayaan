import React, {useState, useCallback, useMemo} from 'react';
import {View, StyleSheet, Platform, useWindowDimensions} from 'react-native';
import {BottomSheetScrollView} from '@gorhom/bottom-sheet';
import {Header} from './Header';
import {QueueList} from './QueueList';
import {QuranView} from './QuranView';
import {TrackInfo} from './TrackInfo';
import {PlaybackControls} from './PlaybackControls';
import {ControlButtons} from './ControlButtons';
import {SurahSummary} from '../SurahSummary';
import {moderateScale} from 'react-native-size-matters';
import {useUnifiedPlayer} from '@/hooks/useUnifiedPlayer';
import {useTheme} from '@/hooks/useTheme';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';

// Import surah info data
const surahInfo = require('@/data/surahInfo.json');

interface PlayerContentProps {
  onSpeedPress: () => void;
  onSleepTimerPress: () => void;
  onMushafLayoutPress: () => void;
  onSummaryPress: () => void;
  onOptionsPress: () => void;
}

const PlayerContent: React.FC<PlayerContentProps> = ({
  onSpeedPress,
  onSleepTimerPress,
  onMushafLayoutPress,
  onSummaryPress,
  onOptionsPress,
}) => {
  useTheme();
  const [showQueue, setShowQueue] = useState(false);
  const {queue, updateQueue, removeFromQueue, play} = useUnifiedPlayer();
  const dimensions = useWindowDimensions();

  // Get mushaf settings from the store
  const {
    showTranslation,
    showTransliteration,
    arabicFontSize,
    translationFontSize,
    transliterationFontSize,
  } = useMushafSettingsStore();

  // Calculate dynamic heights based on screen size
  const layoutConfig = useMemo(() => {
    const isTablet = dimensions.width >= 768; // Common tablet breakpoint
    // Return different configurations based on device type
    return {
      quranQueueHeight: isTablet
        ? dimensions.height * 0.5 // 40% of screen height for tablets
        : dimensions.height * 0.5, // 40% of screen height for phones
    };
  }, [dimensions.height, dimensions.width]);

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

  return (
    <View style={styles.container}>
      <BottomSheetScrollView
        contentContainerStyle={styles.scrollContent}
        bounces={true}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled={Platform.OS === 'android'}>
        <View style={styles.contentContainer}>
          <Header onOptionsPress={onOptionsPress} />
          <View style={styles.mainContent}>
            {/* Container for QuranView and QueueList */}
            <View
              style={[
                styles.viewsContainer,
                {height: layoutConfig.quranQueueHeight},
              ]}>
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
            <View style={styles.controlsContainer}>
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
            <SurahSummary
              surahInfo={surahInfo}
              onReadMore={onSummaryPress}
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
    paddingHorizontal: moderateScale(20),
    paddingTop: moderateScale(5),
    paddingBottom: moderateScale(20),
    alignItems: 'center',
  },
  viewsContainer: {
    width: '100%',
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
    marginTop: moderateScale(20),
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
