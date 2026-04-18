import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import Slider from '@react-native-community/slider';
import {GlassView} from 'expo-glass-effect';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import {Gesture, GestureDetector} from 'react-native-gesture-handler';
import {
  useBottomSheetGestureHandlers,
  useBottomSheetInternal,
} from '@gorhom/bottom-sheet';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Ionicons} from '@expo/vector-icons';
import Color from 'color';

import {Header} from './PlayerContent/Header';
import {QueueList} from './PlayerContent/QueueList';
import {QuranView} from './PlayerContent/QuranView';
import {UploadPlaceholder} from './PlayerContent/UploadPlaceholder';

import {FrostedView} from '@/components/FrostedView';
import {ReciterImage} from '@/components/ReciterImage';
import {USE_GLASS, useGlassColorScheme} from '@/hooks/useGlassProps';
import {moderateScale} from '@/utils/scale';
import {useTheme} from '@/hooks/useTheme';
import {useReadingThemeColors} from '@/hooks/useReadingThemeColors';
import {useResponsive} from '@/hooks/useResponsive';
import {useLoved} from '@/hooks/useLoved';
import {useReciterNavigation} from '@/hooks/useReciterNavigation';
import {usePlayerActions} from '@/hooks/usePlayerActions';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {useProgress} from '@/services/player/store/progressStore';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import {useVerseSelectionStore} from '@/store/verseSelectionStore';
import {useTimestampLoader} from '@/hooks/useTimestampLoader';
import {useAyahTracker} from '@/hooks/useAyahTracker';
import {useTimestampStore} from '@/store/timestampStore';
import {useRewayatFollowAlong} from '@/hooks/useFollowAlong';
import {useAmbientStore} from '@/store/ambientStore';
import {getReciterById} from '@/services/dataService';
import type {Reciter, Rewayat} from '@/data/reciterData';
import {
  HeartIcon,
  MicrophoneIcon,
  PreviousIcon,
  NextIcon,
  PlayIcon,
  PauseIcon,
  SeekBackwardIcon,
  SeekForwardIcon,
  TimerIcon,
  RepeatIcon,
  RepeatOneIcon,
  QueueIcon,
  AmbientIcon,
} from '@/components/Icons';

interface TabletPlayerProps {
  onSpeedPress: () => void;
  onSleepTimerPress: () => void;
  onMushafLayoutPress: () => void;
  onAmbientPress: () => void;
  onOptionsPress: () => void;
  onFollowAlongPress: () => void;
  measuredParentWidth?: number;
  bodyOnly?: boolean;
  showQueue?: boolean;
  onQueueToggle?: () => void;
}

const ANIMATION_DURATION = 250;
const SEEK_INTERVAL = 15;
const SIDEBAR_WIDTH = 360;

const formatTime = (s: number) => {
  if (!isFinite(s) || s < 0) return '0:00';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  const mm = m.toString().padStart(2, '0');
  const ss = sec.toString().padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
};

const TabletPlayer: React.FC<TabletPlayerProps> = ({
  onSpeedPress,
  onSleepTimerPress,
  onMushafLayoutPress,
  onAmbientPress,
  onOptionsPress,
  onFollowAlongPress,
  measuredParentWidth,
  bodyOnly = false,
  showQueue: showQueueProp,
  onQueueToggle,
}) => {
  const {theme} = useTheme();
  const readingColors = useReadingThemeColors();
  const glassColorScheme = useGlassColorScheme();
  const insets = useSafeAreaInsets();
  const {width: windowWidth} = useWindowDimensions();
  const {orientation} = useResponsive();

  const paneWidth = Math.max(measuredParentWidth ?? windowWidth, 1);
  // Use a sidebar layout only when the pane is wide enough for both the
  // sidebar AND a usable mushaf view. Otherwise fall back to a vertical
  // stack (portrait iPad, small split view, iPad mini portrait, etc.).
  const useSidebarLayout =
    orientation === 'landscape' && paneWidth >= SIDEBAR_WIDTH + 320;

  useTimestampLoader();
  useAyahTracker();

  const {
    updateQueue,
    removeFromQueue,
    play,
    pause,
    skipToNext,
    skipToPrevious,
    seekTo,
    toggleImmersive,
    setImmersive,
    updateSettings,
    setSheetMode,
  } = usePlayerActions();

  const queue = usePlayerStore(s => s.queue);
  const isImmersive = usePlayerStore(s => s.isImmersive);
  const playbackState = usePlayerStore(s => s.playback.state);
  const playbackRate = usePlayerStore(s => s.playback.rate);
  const settings = usePlayerStore(s => s.settings);
  const trackLoading = usePlayerStore(s => s.loading.trackLoading);
  const ambientEnabled = useAmbientStore(s => s.isEnabled);

  const progress = useProgress();

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

  const currentTrack = queue?.tracks?.[queue?.currentIndex ?? -1];
  const followAlongAvailable = useRewayatFollowAlong(currentTrack?.rewayatId);
  const followAlongEnabled = useTimestampStore(s => s.followAlongEnabled);
  const isLocked = useTimestampStore(s => s.isLocked);
  const followAlongActive =
    followAlongAvailable && followAlongEnabled && isLocked;

  const currentSurah = currentTrack?.surahId
    ? parseInt(currentTrack.surahId, 10)
    : undefined;
  const isUntaggedUpload = currentTrack?.isUserUpload && !currentTrack?.surahId;

  useEffect(() => {
    useVerseSelectionStore.getState().clearSelection();
  }, [currentSurah]);

  const [localShowQueue, setLocalShowQueue] = useState(false);
  const showQueue =
    showQueueProp !== undefined ? showQueueProp : localShowQueue;
  useEffect(() => {
    if (showQueue) setImmersive(false);
  }, [showQueue, setImmersive]);

  const handleQueueTap = useCallback(() => {
    if (onQueueToggle) {
      onQueueToggle();
    } else {
      setLocalShowQueue(prev => !prev);
    }
  }, [onQueueToggle]);

  const handleQueueItemPress = useCallback(
    async (index: number) => {
      try {
        await updateQueue(queue.tracks, index);
        await play();
      } catch (e) {
        console.error('TabletPlayer: skip failed', e);
      }
    },
    [queue.tracks, updateQueue, play],
  );

  const handleRemoveQueueItem = useCallback(
    async (index: number) => {
      try {
        await removeFromQueue([index]);
      } catch (e) {
        console.error('TabletPlayer: remove failed', e);
      }
    },
    [removeFromQueue],
  );

  const handleVersePress = useCallback(() => {
    toggleImmersive();
  }, [toggleImmersive]);

  const {handlePanGestureHandler} = useBottomSheetGestureHandlers();
  const {animatedPosition, animatedLayoutState} = useBottomSheetInternal();
  const syncSheetModeIfClosed = useCallback(() => {
    const {sheetMode} = usePlayerStore.getState();
    if (sheetMode !== 'hidden') setSheetMode('hidden');
  }, [setSheetMode]);

  const sheetDragGesture = useMemo(
    () =>
      Gesture.Pan()
        .onStart(handlePanGestureHandler.handleOnStart)
        .onChange(handlePanGestureHandler.handleOnChange)
        .onEnd(handlePanGestureHandler.handleOnEnd)
        .onFinalize(event => {
          'worklet';
          handlePanGestureHandler.handleOnFinalize(event);
          const containerHeight = animatedLayoutState.get().containerHeight;
          if (
            containerHeight > 0 &&
            animatedPosition.value >= containerHeight - 1
          ) {
            runOnJS(syncSheetModeIfClosed)();
          }
        })
        .shouldCancelWhenOutside(false)
        .runOnJS(false),
    [
      handlePanGestureHandler,
      animatedPosition,
      animatedLayoutState,
      syncSheetModeIfClosed,
    ],
  );

  const chromeOpacity = useSharedValue(1);
  useEffect(() => {
    chromeOpacity.value = withTiming(isImmersive ? 0 : 1, {
      duration: ANIMATION_DURATION,
    });
  }, [isImmersive, chromeOpacity]);
  const chromeStyle = useAnimatedStyle(() => ({
    opacity: chromeOpacity.value,
  }));

  const {navigateToReciterProfile} = useReciterNavigation();
  const [, setReciter] = useState<Reciter | null>(null);
  const [rewayat, setRewayat] = useState<Rewayat | null>(null);
  useEffect(() => {
    setRewayat(null);
    let alive = true;
    (async () => {
      if (!currentTrack?.reciterId) return;
      try {
        const r = await getReciterById(currentTrack.reciterId);
        if (!alive || !r) return;
        setReciter(r);
        if (currentTrack.rewayatId && r.rewayat) {
          const found = r.rewayat.find(x => x.id === currentTrack.rewayatId);
          if (found) setRewayat(found);
        }
      } catch (e) {
        console.error('TabletPlayer: load reciter failed', e);
      }
    })();
    return () => {
      alive = false;
    };
  }, [currentTrack]);

  const handleReciterPress = useCallback(() => {
    if (currentTrack && currentTrack.reciterId) {
      navigateToReciterProfile(currentTrack.reciterId);
    }
  }, [currentTrack, navigateToReciterProfile]);

  const {isTrackLoved, toggleTrackLoved} = useLoved();
  const isLoved = currentTrack ? isTrackLoved(currentTrack) : false;
  const loveScale = useSharedValue(1);
  const loveAnimStyle = useAnimatedStyle(() => ({
    transform: [{scale: loveScale.value}],
  }));
  const handleToggleLoved = useCallback(() => {
    if (!currentTrack) return;
    if (!USE_GLASS) {
      loveScale.value = withSpring(1.2, {}, () => {
        loveScale.value = withSpring(1);
      });
    }
    toggleTrackLoved(currentTrack);
  }, [currentTrack, loveScale, toggleTrackLoved]);

  const [optimisticIsPlaying, setOptimisticIsPlaying] = useState(
    () => playbackState === 'playing',
  );
  useEffect(() => {
    setOptimisticIsPlaying(playbackState === 'playing');
  }, [playbackState]);

  const handlePlayPause = useCallback(async () => {
    if (trackLoading) return;
    const next = !optimisticIsPlaying;
    setOptimisticIsPlaying(next);
    try {
      if (next) await play();
      else await pause();
    } catch (e) {
      setOptimisticIsPlaying(!next);
      console.error('TabletPlayer: toggle failed', e);
    }
  }, [trackLoading, optimisticIsPlaying, play, pause]);

  const isLastTrack = queue.currentIndex === queue.tracks.length - 1;
  const handlePrev = useCallback(async () => {
    if (trackLoading) return;
    await skipToPrevious();
  }, [trackLoading, skipToPrevious]);
  const handleNext = useCallback(async () => {
    if (trackLoading || isLastTrack) return;
    await skipToNext();
  }, [trackLoading, isLastTrack, skipToNext]);
  const handleSeekBack = useCallback(async () => {
    if (trackLoading) return;
    await seekTo(Math.max(0, progress.position - SEEK_INTERVAL));
  }, [trackLoading, progress.position, seekTo]);
  const handleSeekFwd = useCallback(async () => {
    if (trackLoading) return;
    await seekTo(progress.position + SEEK_INTERVAL);
  }, [trackLoading, progress.position, seekTo]);

  const [isSeeking, setIsSeeking] = useState(false);
  const [seekValue, setSeekValue] = useState(0);
  const displayTime = isSeeking
    ? seekValue
    : progress.seekPosition ?? progress.position;
  const handleSliderStart = useCallback(() => {
    setIsSeeking(true);
    setSeekValue(progress.seekPosition ?? progress.position);
  }, [progress.seekPosition, progress.position]);
  const handleSliderChange = useCallback((v: number) => setSeekValue(v), []);
  const handleSliderComplete = useCallback(
    async (v: number) => {
      try {
        progress.setPosition(v);
        await seekTo(v);
      } catch (e) {
        console.error('TabletPlayer: seek failed', e);
      } finally {
        setIsSeeking(false);
      }
    },
    [progress, seekTo],
  );

  const isTimerActive =
    settings.sleepTimerEnd !== null && settings.sleepTimerEnd > Date.now();
  const handleRepeatPress = useCallback(() => {
    const next = ({none: 'queue', queue: 'track', track: 'none'} as const)[
      settings.repeatMode
    ];
    updateSettings({repeatMode: next});
  }, [settings.repeatMode, updateSettings]);

  // Theme colors
  const textColor = theme.colors.text;
  const secondaryColor = theme.colors.textSecondary;
  const hairline = Color(textColor).alpha(0.1).toString();
  const toolActiveBg = Color(textColor).alpha(0.1).toString();
  const cardBg = Color(textColor).alpha(0.04).toString();

  const glassBackground = (style?: object) =>
    USE_GLASS ? (
      <GlassView
        style={[StyleSheet.absoluteFill, style]}
        glassEffectStyle="regular"
        colorScheme={glassColorScheme}
      />
    ) : (
      <FrostedView style={[StyleSheet.absoluteFill, style]} />
    );

  // Shared body (mushaf / queue / upload)
  const body = showQueue ? (
    <QueueList
      onQueueItemPress={handleQueueItemPress}
      onRemoveQueueItem={handleRemoveQueueItem}
    />
  ) : isUntaggedUpload ? (
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
      contentPaddingTop={moderateScale(12)}
      contentPaddingBottom={moderateScale(12)}
      parentContentWidth={
        !bodyOnly && useSidebarLayout
          ? measuredParentWidth
            ? measuredParentWidth - SIDEBAR_WIDTH
            : undefined
          : measuredParentWidth
      }
    />
  );

  // ==============================================================
  // BODY-ONLY: just render the mushaf pane (controls live in a
  // sibling column owned by PlayerSheet). Used in portrait split.
  // ==============================================================
  if (bodyOnly) {
    return (
      <View
        style={[styles.rootCol, {backgroundColor: readingColors.background}]}>
        <View style={styles.contentPane}>{body}</View>
      </View>
    );
  }

  // ==============================================================
  // REUSABLE CONTROL BLOCKS (rendered inline in each layout)
  // ==============================================================

  const renderTrackMeta = (artSize: number, stacked: boolean) => (
    <Pressable
      style={stacked ? styles.trackMetaStacked : styles.trackMetaRow}
      onPress={handleReciterPress}>
      {currentTrack?.isUserUpload && !currentTrack?.artwork ? (
        <View
          style={[
            styles.art,
            {
              width: artSize,
              height: artSize,
              borderRadius: moderateScale(12),
              backgroundColor: theme.colors.card,
            },
          ]}>
          <MicrophoneIcon
            size={moderateScale(artSize / 2.5)}
            color={secondaryColor}
          />
        </View>
      ) : (
        <ReciterImage
          imageUrl={currentTrack?.artwork}
          reciterName={currentTrack?.artist || ''}
          style={[
            styles.art,
            {
              width: artSize,
              height: artSize,
              borderRadius: moderateScale(stacked ? 18 : 12),
            },
          ]}
          profileIconSize={moderateScale(artSize / 2.5)}
        />
      )}
      <View style={stacked ? styles.trackTextStacked : styles.trackTextRow}>
        <Text
          style={[
            styles.trackTitle,
            stacked && styles.trackTitleStacked,
            {color: textColor},
          ]}
          numberOfLines={1}>
          {currentTrack?.title || ''}
        </Text>
        <Text
          style={[
            styles.trackArtist,
            stacked && styles.trackArtistStacked,
            {color: textColor},
          ]}
          numberOfLines={1}>
          {currentTrack?.artist || ''}
        </Text>
        {(rewayat || currentTrack?.rewayahName) && (
          <Text
            style={[styles.trackRewayat, {color: secondaryColor}]}
            numberOfLines={1}>
            {rewayat
              ? `${rewayat.name}${rewayat.style ? ` • ${rewayat.style}` : ''}`
              : currentTrack?.rewayahName}
          </Text>
        )}
      </View>
    </Pressable>
  );

  const renderHeart = () => (
    <Pressable onPress={handleToggleLoved} style={styles.heartBtn}>
      <Animated.View style={loveAnimStyle}>
        <HeartIcon
          size={moderateScale(22)}
          color={isLoved ? 'red' : textColor}
          filled={isLoved}
        />
      </Animated.View>
    </Pressable>
  );

  const renderScrubber = () => (
    <View style={styles.scrubber}>
      <Slider
        style={styles.slider}
        minimumValue={0}
        maximumValue={progress.duration || 1}
        tapToSeek
        value={displayTime}
        onSlidingStart={handleSliderStart}
        onValueChange={handleSliderChange}
        onSlidingComplete={handleSliderComplete}
        minimumTrackTintColor={textColor}
        maximumTrackTintColor={Color(textColor).alpha(0.25).toString()}
        thumbTintColor={isSeeking ? textColor : 'transparent'}
      />
      <View style={styles.timeRow}>
        <Text style={[styles.timeText, {color: textColor}]}>
          {formatTime(displayTime)}
        </Text>
        <Text style={[styles.timeText, {color: secondaryColor}]}>
          -{formatTime(Math.max(0, progress.duration - displayTime))}
        </Text>
      </View>
    </View>
  );

  const renderTransport = () => (
    <View style={styles.transport}>
      <Pressable
        onPress={handleSeekBack}
        disabled={trackLoading}
        style={[styles.transportSide, trackLoading && styles.disabled]}>
        <View style={styles.seekWrap}>
          <SeekBackwardIcon
            color={trackLoading ? secondaryColor : textColor}
            size={moderateScale(30)}
          />
          <Text
            style={[
              styles.seekLabel,
              styles.seekLabelLeft,
              {color: trackLoading ? secondaryColor : textColor},
            ]}>
            {SEEK_INTERVAL}
          </Text>
        </View>
      </Pressable>
      <Pressable
        onPress={handlePrev}
        disabled={trackLoading}
        style={[styles.transportSide, trackLoading && styles.disabled]}>
        <PreviousIcon
          color={trackLoading ? secondaryColor : textColor}
          size={moderateScale(24)}
        />
      </Pressable>
      <Pressable
        onPress={handlePlayPause}
        disabled={trackLoading}
        style={[
          styles.playButton,
          {backgroundColor: Color(textColor).alpha(0.08).toString()},
        ]}>
        {optimisticIsPlaying ? (
          <PauseIcon color={textColor} size={moderateScale(40)} />
        ) : (
          <PlayIcon color={textColor} size={moderateScale(40)} />
        )}
      </Pressable>
      <Pressable
        onPress={handleNext}
        disabled={trackLoading || isLastTrack}
        style={[
          styles.transportSide,
          (trackLoading || isLastTrack) && styles.disabled,
        ]}>
        <NextIcon
          color={isLastTrack ? secondaryColor : textColor}
          size={moderateScale(24)}
        />
      </Pressable>
      <Pressable
        onPress={handleSeekFwd}
        disabled={trackLoading}
        style={[styles.transportSide, trackLoading && styles.disabled]}>
        <View style={styles.seekWrap}>
          <SeekForwardIcon
            color={trackLoading ? secondaryColor : textColor}
            size={moderateScale(30)}
          />
          <Text
            style={[
              styles.seekLabel,
              styles.seekLabelRight,
              {color: trackLoading ? secondaryColor : textColor},
            ]}>
            {SEEK_INTERVAL}
          </Text>
        </View>
      </Pressable>
    </View>
  );

  const renderTools = () => (
    <View style={styles.tools}>
      <Pressable style={styles.tool} onPress={onMushafLayoutPress}>
        <Ionicons
          name="options-outline"
          size={moderateScale(20)}
          color={textColor}
        />
      </Pressable>
      <Pressable
        style={[
          styles.tool,
          playbackRate !== 1 && {backgroundColor: toolActiveBg},
        ]}
        onPress={onSpeedPress}>
        <Text style={[styles.toolLabel, {color: textColor}]}>
          {`${playbackRate}x`}
        </Text>
      </Pressable>
      <Pressable
        style={[
          styles.tool,
          settings.repeatMode !== 'none' && {backgroundColor: toolActiveBg},
        ]}
        onPress={handleRepeatPress}>
        {settings.repeatMode === 'track' ? (
          <RepeatOneIcon size={moderateScale(20)} color={textColor} />
        ) : (
          <RepeatIcon size={moderateScale(20)} color={textColor} />
        )}
      </Pressable>
      <Pressable
        style={[styles.tool, isTimerActive && {backgroundColor: toolActiveBg}]}
        onPress={onSleepTimerPress}>
        <TimerIcon
          size={moderateScale(20)}
          color={textColor}
          filled={isTimerActive}
        />
      </Pressable>
      <Pressable
        style={[styles.tool, ambientEnabled && {backgroundColor: toolActiveBg}]}
        onPress={onAmbientPress}>
        <AmbientIcon
          size={moderateScale(20)}
          color={textColor}
          filled={ambientEnabled}
        />
      </Pressable>
      <Pressable
        style={[
          styles.tool,
          followAlongActive && {backgroundColor: toolActiveBg},
          !followAlongAvailable && {opacity: 0.35},
        ]}
        onPress={onFollowAlongPress}
        disabled={!followAlongAvailable}>
        <Ionicons
          name="locate-outline"
          size={moderateScale(20)}
          color={textColor}
        />
      </Pressable>
      <Pressable
        style={[styles.tool, showQueue && {backgroundColor: toolActiveBg}]}
        onPress={handleQueueTap}>
        <QueueIcon size={moderateScale(20)} color={textColor} />
      </Pressable>
    </View>
  );

  // ==============================================================
  // LANDSCAPE: sidebar (left) + mushaf (right)
  // ==============================================================
  if (useSidebarLayout) {
    return (
      <View
        style={[styles.rootRow, {backgroundColor: readingColors.background}]}>
        {/* Left: Control sidebar */}
        <GestureDetector gesture={sheetDragGesture}>
          <Animated.View
            style={[
              styles.sidebar,
              {
                width: SIDEBAR_WIDTH,
                borderRightColor: hairline,
                paddingTop: insets.top + moderateScale(4),
                paddingBottom: insets.bottom + moderateScale(16),
                backgroundColor: cardBg,
              },
              chromeStyle,
            ]}
            pointerEvents={isImmersive ? 'none' : 'auto'}>
            {glassBackground()}
            <View style={styles.sidebarHeader}>
              <Header onOptionsPress={onOptionsPress} />
            </View>

            <ScrollView
              style={styles.sidebarScroll}
              contentContainerStyle={styles.sidebarContent}
              showsVerticalScrollIndicator={false}>
              {/* Big artwork + metadata (centered, stacked) */}
              <View style={styles.sidebarArtWrap}>
                {renderTrackMeta(moderateScale(200), true)}
                <View style={styles.sidebarHeartRow}>{renderHeart()}</View>
              </View>

              {/* Scrubber */}
              <View style={styles.sidebarBlock}>{renderScrubber()}</View>

              {/* Transport */}
              <View style={styles.sidebarBlock}>{renderTransport()}</View>

              {/* Tools grid */}
              <View style={styles.sidebarBlock}>{renderTools()}</View>
            </ScrollView>
          </Animated.View>
        </GestureDetector>

        {/* Right: Mushaf / Queue / Upload */}
        <View style={styles.contentPane}>{body}</View>
      </View>
    );
  }

  // ==============================================================
  // PORTRAIT / NARROW: header (top) + mushaf (middle) + floating card (bottom)
  // ==============================================================
  return (
    <View style={[styles.rootCol, {backgroundColor: readingColors.background}]}>
      {/* Top: Header (flexShrink: 0 — never squeezed) */}
      <GestureDetector gesture={sheetDragGesture}>
        <Animated.View
          style={[
            styles.pTopBar,
            {paddingTop: insets.top + moderateScale(4)},
            chromeStyle,
          ]}
          pointerEvents={isImmersive ? 'none' : 'auto'}>
          <Header onOptionsPress={onOptionsPress} />
        </Animated.View>
      </GestureDetector>

      {/* Middle: Mushaf body (flex: 1, shrinks to fit dock) */}
      <View style={styles.contentPane}>{body}</View>

      {/* Bottom: Floating Now-Playing card
         - flexShrink: 0 → can never be squeezed by the mushaf
         - ScrollView inside → if content ever overflows (rotation, font
           scaling), user can scroll rather than have rows disappear
         - Rounded card with glass bg, padded from pane edges */}
      <GestureDetector gesture={sheetDragGesture}>
        <Animated.View
          style={[
            styles.pDockWrapper,
            {paddingBottom: insets.bottom + moderateScale(8)},
            chromeStyle,
          ]}
          pointerEvents={isImmersive ? 'none' : 'auto'}>
          <View style={[styles.pDockCard, {borderColor: hairline}]}>
            {glassBackground()}
            <ScrollView
              style={styles.pDockScroll}
              contentContainerStyle={styles.pDockScrollContent}
              showsVerticalScrollIndicator={false}
              bounces={false}>
              {/* Row 1: track + heart */}
              <View style={styles.pTrackRow}>
                <View style={styles.pTrackMeta}>
                  {renderTrackMeta(moderateScale(52), false)}
                </View>
                {renderHeart()}
              </View>

              {/* Row 2: scrubber */}
              <View style={styles.pScrubberWrap}>{renderScrubber()}</View>

              {/* Row 3: transport */}
              <View style={styles.pTransportWrap}>{renderTransport()}</View>

              {/* Row 4: tools */}
              <View style={styles.pToolsWrap}>{renderTools()}</View>
            </ScrollView>
          </View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
};

const styles = StyleSheet.create({
  // Layout roots
  rootRow: {
    flex: 1,
    flexDirection: 'row',
  },
  rootCol: {
    flex: 1,
    flexDirection: 'column',
  },
  contentPane: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
  },

  // ─────── LANDSCAPE SIDEBAR ───────
  sidebar: {
    borderRightWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  sidebarHeader: {
    paddingHorizontal: moderateScale(4),
    paddingTop: moderateScale(4),
    paddingBottom: moderateScale(8),
  },
  sidebarScroll: {
    flex: 1,
  },
  sidebarContent: {
    paddingHorizontal: moderateScale(20),
    paddingBottom: moderateScale(16),
  },
  sidebarArtWrap: {
    alignItems: 'center',
    marginTop: moderateScale(12),
  },
  sidebarHeartRow: {
    marginTop: moderateScale(14),
  },
  sidebarBlock: {
    marginTop: moderateScale(22),
  },

  // ─────── PORTRAIT / NARROW: floating card design ───────
  pTopBar: {
    paddingHorizontal: moderateScale(4),
    paddingBottom: moderateScale(4),
    flexShrink: 0,
    flexGrow: 0,
  },
  pDockWrapper: {
    paddingHorizontal: moderateScale(12),
    paddingTop: moderateScale(8),
    flexShrink: 0,
    flexGrow: 0,
  },
  pDockCard: {
    borderRadius: moderateScale(22),
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  pDockScroll: {
    maxHeight: moderateScale(360),
  },
  pDockScrollContent: {
    paddingTop: moderateScale(12),
    paddingBottom: moderateScale(10),
    paddingHorizontal: moderateScale(14),
  },
  pTrackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  pTrackMeta: {
    flex: 1,
    minWidth: 0,
  },
  pScrubberWrap: {
    marginTop: moderateScale(8),
  },
  pTransportWrap: {
    marginTop: moderateScale(2),
  },
  pToolsWrap: {
    marginTop: moderateScale(8),
  },

  // ─────── TRACK META (row + stacked) ───────
  trackMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  trackMetaStacked: {
    flexDirection: 'column',
    alignItems: 'center',
    width: '100%',
  },
  art: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  trackTextRow: {
    flex: 1,
    minWidth: 0,
    marginLeft: moderateScale(12),
  },
  trackTextStacked: {
    width: '100%',
    alignItems: 'center',
    marginTop: moderateScale(18),
  },
  trackTitle: {
    fontSize: moderateScale(15),
    fontFamily: 'Manrope-Bold',
  },
  trackTitleStacked: {
    fontSize: moderateScale(20),
    textAlign: 'center',
  },
  trackArtist: {
    fontSize: moderateScale(12),
    fontFamily: 'Manrope-SemiBold',
    opacity: 0.75,
    marginTop: moderateScale(2),
  },
  trackArtistStacked: {
    fontSize: moderateScale(14),
    marginTop: moderateScale(4),
    textAlign: 'center',
  },
  trackRewayat: {
    fontSize: moderateScale(11),
    fontFamily: 'Manrope-Medium',
    textTransform: 'capitalize',
    marginTop: moderateScale(2),
    opacity: 0.85,
    textAlign: 'center',
  },

  // Heart
  heartBtn: {
    width: moderateScale(44),
    height: moderateScale(44),
    borderRadius: moderateScale(22),
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: moderateScale(8),
  },

  // Scrubber
  scrubber: {
    width: '100%',
  },
  slider: {
    width: '100%',
    height: moderateScale(32),
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: moderateScale(-4),
    paddingHorizontal: moderateScale(4),
  },
  timeText: {
    fontSize: moderateScale(11),
    fontFamily: 'Manrope-Medium',
  },

  // Transport
  transport: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: moderateScale(4),
  },
  transportSide: {
    width: moderateScale(52),
    height: moderateScale(52),
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabled: {
    opacity: 0.35,
  },
  playButton: {
    width: moderateScale(68),
    height: moderateScale(68),
    borderRadius: moderateScale(34),
    justifyContent: 'center',
    alignItems: 'center',
  },
  seekWrap: {
    position: 'relative',
    width: moderateScale(36),
    height: moderateScale(32),
    justifyContent: 'center',
    alignItems: 'center',
  },
  seekLabel: {
    position: 'absolute',
    fontSize: moderateScale(11),
    fontFamily: 'Manrope-Bold',
    lineHeight: moderateScale(11),
    bottom: 0,
  },
  seekLabelLeft: {
    left: moderateScale(5),
  },
  seekLabelRight: {
    right: moderateScale(5),
  },

  // Tools
  tools: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: moderateScale(12),
  },
  tool: {
    width: moderateScale(44),
    height: moderateScale(44),
    borderRadius: moderateScale(14),
    justifyContent: 'center',
    alignItems: 'center',
  },
  toolLabel: {
    fontSize: moderateScale(13),
    fontFamily: 'Manrope-SemiBold',
  },
});

export default TabletPlayer;
