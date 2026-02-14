import React, {useState, useCallback, useEffect} from 'react';
import {View, StyleSheet, LayoutChangeEvent} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import {QueueList} from './QueueList';
import {QuranView} from './QuranView';
import {TrackInfo} from './TrackInfo';
import {PlaybackControls} from './PlaybackControls';
import {ControlButtons} from './ControlButtons';
import {UploadPlaceholder} from './UploadPlaceholder';
import {Header} from './Header';
import {moderateScale} from 'react-native-size-matters';
import {usePlayerActions} from '@/hooks/usePlayerActions';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {useVerseSelectionStore} from '@/store/verseSelectionStore';
import {useTheme} from '@/hooks/useTheme';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Color from 'color';

interface PlayerContentProps {
  onSpeedPress: () => void;
  onSleepTimerPress: () => void;
  onMushafLayoutPress: () => void;
  onAmbientPress: () => void;
  onOptionsPress: () => void;
}

const ANIMATION_DURATION = 300;
const DEFAULT_HEADER_HEIGHT = 100;
const DEFAULT_CONTROLS_HEIGHT = 250;

const PlayerContent: React.FC<PlayerContentProps> = ({
  onSpeedPress,
  onSleepTimerPress,
  onMushafLayoutPress,
  onAmbientPress,
  onOptionsPress,
}) => {
  const {theme} = useTheme();
  const [showQueue, setShowQueue] = useState(false);
  const {updateQueue, removeFromQueue, play, toggleImmersive, setImmersive} =
    usePlayerActions();
  const queue = usePlayerStore(s => s.queue);
  const isImmersive = usePlayerStore(s => s.isImmersive);
  const insets = useSafeAreaInsets();

  // Overlay height measurement
  const [headerHeight, setHeaderHeight] = useState(DEFAULT_HEADER_HEIGHT);
  const [controlsHeight, setControlsHeight] = useState(DEFAULT_CONTROLS_HEIGHT);

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

  // Reanimated shared value for overlay opacity
  const overlayOpacity = useSharedValue(1);

  // Animate overlay opacity when immersive state changes
  useEffect(() => {
    overlayOpacity.value = withTiming(isImmersive ? 0 : 1, {
      duration: ANIMATION_DURATION,
    });
  }, [isImmersive, overlayOpacity]);

  const overlayAnimatedStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  // Exit immersive when queue opens
  useEffect(() => {
    if (showQueue) {
      setImmersive(false);
    }
  }, [showQueue, setImmersive]);

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

  const handleVersePress = useCallback(() => {
    toggleImmersive();
  }, [toggleImmersive]);

  const handleHeaderLayout = useCallback((e: LayoutChangeEvent) => {
    setHeaderHeight(e.nativeEvent.layout.height);
  }, []);

  const handleControlsLayout = useCallback((e: LayoutChangeEvent) => {
    setControlsHeight(e.nativeEvent.layout.height);
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
      {/* QuranView / QueueList fills the entire area */}
      <View style={StyleSheet.absoluteFill}>
        {showQueue ? (
          <View style={styles.fullArea}>
            <QueueList
              onQueueItemPress={handleQueueItemPress}
              onRemoveQueueItem={handleRemoveQueueItem}
            />
          </View>
        ) : (
          <View style={styles.fullArea}>
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
                contentPaddingTop={headerHeight}
                contentPaddingBottom={controlsHeight}
              />
            )}
          </View>
        )}
      </View>

      {/* Header overlay — absolute positioned at top */}
      <Animated.View
        style={[
          styles.headerOverlay,
          overlayAnimatedStyle,
          {
            backgroundColor: theme.colors.background,
            paddingTop: insets.top + moderateScale(12),
          },
        ]}
        pointerEvents={isImmersive ? 'none' : 'auto'}
        onLayout={handleHeaderLayout}>
        <View style={styles.handleContainer}>
          <View
            style={[
              styles.handle,
              {
                backgroundColor: Color(theme.colors.text).alpha(0.2).toString(),
              },
            ]}
          />
        </View>
        <Header onOptionsPress={onOptionsPress} />
      </Animated.View>

      {/* Controls overlay — absolute positioned at bottom */}
      <Animated.View
        style={[
          styles.controlsOverlay,
          overlayAnimatedStyle,
          {
            backgroundColor: theme.colors.background,
            paddingBottom: insets.bottom || moderateScale(20),
          },
        ]}
        pointerEvents={isImmersive ? 'none' : 'auto'}
        onLayout={handleControlsLayout}>
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
      </Animated.View>

      {/* Rounded TV frame between header and controls */}
      <Animated.View
        style={[
          styles.tvFrame,
          overlayAnimatedStyle,
          {
            top: headerHeight,
            bottom: controlsHeight,
            borderColor: Color(theme.colors.text).alpha(0.08).toString(),
          },
        ]}
        pointerEvents="none"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  fullArea: {
    flex: 1,
    paddingHorizontal: moderateScale(20),
  },
  headerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingTop: 0,
  },
  handleContainer: {
    alignItems: 'center',
    width: '100%',
  },
  handle: {
    width: 40,
    height: 5,
    borderRadius: 3,
  },
  tvFrame: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  controlsOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: moderateScale(20),
    paddingTop: moderateScale(10),
  },
});

export default PlayerContent;
