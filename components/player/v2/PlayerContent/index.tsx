import React, {useState, useCallback, useEffect} from 'react';
import {View, StyleSheet, LayoutChangeEvent} from 'react-native';
import {GlassView} from 'expo-glass-effect';
import {
  USE_GLASS,
  useGlassColorScheme,
  useGlassTint,
} from '@/hooks/useGlassProps';
import {FrostedView} from '@/components/FrostedView';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import {GestureDetector} from 'react-native-gesture-handler';
import {usePlayerDismissGesture} from '@/components/player/v2/PlayerDismissContext';
import {QueueList} from './QueueList';
import {QuranView} from './QuranView';
import {TrackInfo} from './TrackInfo';
import {PlaybackControls} from './PlaybackControls';
import {ControlButtons} from './ControlButtons';
import {UploadPlaceholder} from './UploadPlaceholder';
import {Header} from './Header';
import {moderateScale} from '@/utils/scale';
import {usePlayerActions} from '@/hooks/usePlayerActions';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {useVerseSelectionStore} from '@/store/verseSelectionStore';
import {useTheme} from '@/hooks/useTheme';
import {useReadingThemeColors} from '@/hooks/useReadingThemeColors';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Color from 'color';
import {LinearGradient} from 'expo-linear-gradient';
import {useTimestampLoader} from '@/hooks/useTimestampLoader';
import {useAyahTracker} from '@/hooks/useAyahTracker';
import {useTimestampStore} from '@/store/timestampStore';
import {findAyahTimestamp} from '@/utils/timestampUtils';
import {useRewayatFollowAlong} from '@/hooks/useFollowAlong';

interface PlayerContentProps {
  onSpeedPress: () => void;
  onSleepTimerPress: () => void;
  onMushafLayoutPress: () => void;
  onAmbientPress: () => void;
  onOptionsPress: () => void;
  onFollowAlongPress: () => void;
}

const ANIMATION_DURATION = 300;
const DEFAULT_HEADER_HEIGHT = 100;
const DEFAULT_CONTROLS_HEIGHT = 250;

// @ai-start
const PlayerContent: React.FC<PlayerContentProps> = ({
  onSpeedPress,
  onSleepTimerPress,
  onMushafLayoutPress,
  onAmbientPress,
  onOptionsPress,
  onFollowAlongPress,
}) => {
  const {theme} = useTheme();
  const readingColors = useReadingThemeColors();
  const glassColorScheme = useGlassColorScheme();
  const glassTint = useGlassTint(); // @ai
  const [showQueue, setShowQueue] = useState(false);
  const {
    updateQueue,
    removeFromQueue,
    play,
    seekTo,
    toggleImmersive,
    setImmersive,
  } = usePlayerActions();

  // Mount ayah timestamp hooks
  useTimestampLoader();
  useAyahTracker();
  const queue = usePlayerStore(s => s.queue);
  const isImmersive = usePlayerStore(s => s.isImmersive);
  const insets = useSafeAreaInsets();

  // One gesture per GestureDetector: Gesture Handler can't share one.
  const headerDragGesture = usePlayerDismissGesture();
  const controlsDragGesture = usePlayerDismissGesture();

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

  const seekToAyah = useCallback(
    (verseKey: string) => {
      const [, ayahStr] = verseKey.split(':');
      const ayahNumber = parseInt(ayahStr, 10);

      const timestamps = useTimestampStore.getState().currentSurahTimestamps;
      if (!timestamps) return;

      const ts = findAyahTimestamp(timestamps, ayahNumber);
      if (!ts) return;

      seekTo(ts.timestampFrom / 1000); // ms → seconds
      useTimestampStore.getState().setCurrentAyah({
        surahNumber: ts.surahNumber,
        ayahNumber: ts.ayahNumber,
        verseKey,
        timestampFrom: ts.timestampFrom,
        timestampTo: ts.timestampTo,
      });
    },
    [seekTo],
  );

  // Keep seekToAyah available for future UI interaction
  void seekToAyah;

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

  // Follow Along state
  const followAlongAvailable = useRewayatFollowAlong(currentTrack?.rewayatId);
  const followAlongEnabled = useTimestampStore(s => s.followAlongEnabled);
  const isLocked = useTimestampStore(s => s.isLocked);

  // Clear verse selection when surah changes
  useEffect(() => {
    useVerseSelectionStore.getState().clearSelection();
  }, [currentSurah]);

  return (
    <View style={styles.container}>
      {/* QuranView / QueueList fills the entire area */}
      <View
        style={[
          StyleSheet.absoluteFill,
          {backgroundColor: readingColors.background},
        ]}>
        {showQueue ? (
          <View style={styles.fullArea}>
            <QueueList
              onQueueItemPress={handleQueueItemPress}
              onRemoveQueueItem={handleRemoveQueueItem}
              contentPaddingTop={insets.top + moderateScale(4) + headerHeight}
              contentPaddingBottom={controlsHeight}
            />
            {/* Fades rows out under the status bar as the queue scrolls. */}
            <LinearGradient
              pointerEvents="none"
              colors={[
                readingColors.background,
                Color(readingColors.background).alpha(0).toString(),
              ]}
              style={[
                styles.statusBarScrim,
                {height: insets.top + moderateScale(12)},
              ]}
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
                contentPaddingTop={insets.top + moderateScale(4) + headerHeight}
                contentPaddingBottom={controlsHeight}
              />
            )}
          </View>
        )}
      </View>

      {/* Header overlay — floating glass card */}
      <GestureDetector gesture={headerDragGesture}>
        <Animated.View
          style={[
            styles.headerOverlay,
            overlayAnimatedStyle,
            {
              top: insets.top + moderateScale(4),
              borderColor: Color(theme.colors.text).alpha(0.1).toString(),
            },
          ]}
          pointerEvents={isImmersive ? 'none' : 'auto'}
          onLayout={handleHeaderLayout}>
          {/* Glass/blur background */}
          {USE_GLASS ? (
            <GlassView
              style={styles.cardGlass}
              glassEffectStyle="regular"
              colorScheme={glassColorScheme}
              tintColor={glassTint}
            />
          ) : (
            <FrostedView style={StyleSheet.absoluteFill} />
          )}
          <Header onOptionsPress={onOptionsPress} />
        </Animated.View>
      </GestureDetector>

      {/* Controls overlay — floating glass card */}
      <GestureDetector gesture={controlsDragGesture}>
        <Animated.View
          style={[
            styles.controlsOverlay,
            overlayAnimatedStyle,
            {
              borderColor: Color(theme.colors.text).alpha(0.1).toString(),
            },
          ]}
          pointerEvents={isImmersive ? 'none' : 'auto'}
          onLayout={handleControlsLayout}>
          {/* Glass/blur background */}
          {USE_GLASS ? (
            <GlassView
              style={styles.cardGlass}
              glassEffectStyle="regular"
              colorScheme={glassColorScheme}
              tintColor={glassTint}
            />
          ) : (
            <FrostedView style={StyleSheet.absoluteFill} />
          )}
          <TrackInfo />
          <PlaybackControls />
          <ControlButtons
            onSpeedPress={onSpeedPress}
            onSleepTimerPress={onSleepTimerPress}
            onQueuePress={handleQueuePress}
            showQueue={showQueue}
            onMushafLayoutPress={onMushafLayoutPress}
            onAmbientPress={onAmbientPress}
            onFollowAlongPress={onFollowAlongPress}
            followAlongActive={
              followAlongAvailable && followAlongEnabled && isLocked
            }
            followAlongAvailable={followAlongAvailable}
          />
        </Animated.View>
      </GestureDetector>
    </View>
  );
};
// @ai-end

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  fullArea: {
    flex: 1,
    paddingHorizontal: moderateScale(8),
  },
  statusBarScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  headerOverlay: {
    position: 'absolute',
    top: moderateScale(20),
    left: moderateScale(16),
    right: moderateScale(16),
    alignItems: 'center',
    borderRadius: moderateScale(38),
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  // The glass gets the card's shape itself: UIGlassEffect draws its own
  // edge, which the card's clipping alone doesn't round.
  cardGlass: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: moderateScale(38),
    borderCurve: 'continuous',
  },
  controlsOverlay: {
    position: 'absolute',
    bottom: moderateScale(20),
    left: moderateScale(16),
    right: moderateScale(16),
    borderRadius: moderateScale(38),
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    paddingHorizontal: moderateScale(14),
    paddingTop: moderateScale(14),
  },
});

export default PlayerContent;
