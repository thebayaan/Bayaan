import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {View, Text, Pressable, StyleSheet, ScrollView} from 'react-native';
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

import {Header} from '@/components/player/v2/PlayerContent/Header';
import {FrostedView} from '@/components/FrostedView';
import {ReciterImage} from '@/components/ReciterImage';
import {USE_GLASS, useGlassColorScheme} from '@/hooks/useGlassProps';
import {moderateScale} from '@/utils/scale';
import {useTheme} from '@/hooks/useTheme';
import {useReadingThemeColors} from '@/hooks/useReadingThemeColors';
import {useLoved} from '@/hooks/useLoved';
import {useReciterNavigation} from '@/hooks/useReciterNavigation';
import {usePlayerActions} from '@/hooks/usePlayerActions';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {useProgress} from '@/services/player/store/progressStore';
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

interface TabletPlayerControlsColumnProps {
  onSpeedPress: () => void;
  onSleepTimerPress: () => void;
  onMushafLayoutPress: () => void;
  onAmbientPress: () => void;
  onOptionsPress: () => void;
  onFollowAlongPress: () => void;
  showQueue: boolean;
  onQueueToggle: () => void;
}

const ANIMATION_DURATION = 250;
const SEEK_INTERVAL = 15;

const formatTime = (s: number) => {
  if (!isFinite(s) || s < 0) return '0:00';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  const mm = m.toString().padStart(2, '0');
  const ss = sec.toString().padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
};

export const TabletPlayerControlsColumn: React.FC<
  TabletPlayerControlsColumnProps
> = ({
  onSpeedPress,
  onSleepTimerPress,
  onMushafLayoutPress,
  onAmbientPress,
  onOptionsPress,
  onFollowAlongPress,
  showQueue,
  onQueueToggle,
}) => {
  const {theme} = useTheme();
  const readingColors = useReadingThemeColors();
  const glassColorScheme = useGlassColorScheme();
  const insets = useSafeAreaInsets();

  const {
    play,
    pause,
    skipToNext,
    skipToPrevious,
    seekTo,
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

  const currentTrack = queue?.tracks?.[queue?.currentIndex ?? -1];
  const followAlongAvailable = useRewayatFollowAlong(currentTrack?.rewayatId);
  const followAlongEnabled = useTimestampStore(s => s.followAlongEnabled);
  const isLocked = useTimestampStore(s => s.isLocked);
  const followAlongActive =
    followAlongAvailable && followAlongEnabled && isLocked;

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
        console.error('TabletPlayerControlsColumn: load reciter failed', e);
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
      console.error('TabletPlayerControlsColumn: toggle failed', e);
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
        console.error('TabletPlayerControlsColumn: seek failed', e);
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

  const textColor = theme.colors.text;
  const secondaryColor = theme.colors.textSecondary;
  const hairline = Color(textColor).alpha(0.1).toString();
  const toolActiveBg = Color(textColor).alpha(0.1).toString();
  const cardBg = Color(textColor).alpha(0.04).toString();

  const glassBackground = () =>
    USE_GLASS ? (
      <GlassView
        style={StyleSheet.absoluteFill}
        glassEffectStyle="regular"
        colorScheme={glassColorScheme}
      />
    ) : (
      <FrostedView style={StyleSheet.absoluteFill} />
    );

  return (
    <GestureDetector gesture={sheetDragGesture}>
      <Animated.View
        style={[
          styles.root,
          {
            borderLeftColor: hairline,
            paddingTop: insets.top + moderateScale(4),
            paddingBottom: insets.bottom + moderateScale(16),
            backgroundColor: readingColors.background,
          },
          chromeStyle,
        ]}
        pointerEvents={isImmersive ? 'none' : 'auto'}>
        <View style={[StyleSheet.absoluteFill, {backgroundColor: cardBg}]} />
        {glassBackground()}

        <View style={styles.headerWrap}>
          <Header onOptionsPress={onOptionsPress} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          <Pressable style={styles.trackMeta} onPress={handleReciterPress}>
            {currentTrack?.isUserUpload && !currentTrack?.artwork ? (
              <View style={[styles.art, {backgroundColor: theme.colors.card}]}>
                <MicrophoneIcon
                  size={moderateScale(80)}
                  color={secondaryColor}
                />
              </View>
            ) : (
              <ReciterImage
                imageUrl={currentTrack?.artwork}
                reciterName={currentTrack?.artist || ''}
                style={styles.art}
                profileIconSize={moderateScale(80)}
              />
            )}
            <View style={styles.trackText}>
              <Text
                style={[styles.trackTitle, {color: textColor}]}
                numberOfLines={1}>
                {currentTrack?.title || ''}
              </Text>
              <Text
                style={[styles.trackArtist, {color: textColor}]}
                numberOfLines={1}>
                {currentTrack?.artist || ''}
              </Text>
              {(rewayat || currentTrack?.rewayahName) && (
                <Text
                  style={[styles.trackRewayat, {color: secondaryColor}]}
                  numberOfLines={1}>
                  {rewayat
                    ? `${rewayat.name}${
                        rewayat.style ? ` • ${rewayat.style}` : ''
                      }`
                    : currentTrack?.rewayahName}
                </Text>
              )}
            </View>
          </Pressable>

          <View style={styles.heartRow}>
            <Pressable onPress={handleToggleLoved} style={styles.heartBtn}>
              <Animated.View style={loveAnimStyle}>
                <HeartIcon
                  size={moderateScale(22)}
                  color={isLoved ? 'red' : textColor}
                  filled={isLoved}
                />
              </Animated.View>
            </Pressable>
          </View>

          <View style={styles.block}>
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

          <View style={styles.block}>
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
          </View>

          <View style={styles.block}>
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
                  settings.repeatMode !== 'none' && {
                    backgroundColor: toolActiveBg,
                  },
                ]}
                onPress={handleRepeatPress}>
                {settings.repeatMode === 'track' ? (
                  <RepeatOneIcon size={moderateScale(20)} color={textColor} />
                ) : (
                  <RepeatIcon size={moderateScale(20)} color={textColor} />
                )}
              </Pressable>
              <Pressable
                style={[
                  styles.tool,
                  isTimerActive && {backgroundColor: toolActiveBg},
                ]}
                onPress={onSleepTimerPress}>
                <TimerIcon
                  size={moderateScale(20)}
                  color={textColor}
                  filled={isTimerActive}
                />
              </Pressable>
              <Pressable
                style={[
                  styles.tool,
                  ambientEnabled && {backgroundColor: toolActiveBg},
                ]}
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
                style={[
                  styles.tool,
                  showQueue && {backgroundColor: toolActiveBg},
                ]}
                onPress={onQueueToggle}>
                <QueueIcon size={moderateScale(20)} color={textColor} />
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </Animated.View>
    </GestureDetector>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    borderLeftWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  headerWrap: {
    paddingHorizontal: moderateScale(4),
    paddingTop: moderateScale(4),
    paddingBottom: moderateScale(8),
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: moderateScale(20),
    paddingBottom: moderateScale(16),
    alignItems: 'center',
  },
  trackMeta: {
    flexDirection: 'column',
    alignItems: 'center',
    width: '100%',
    marginTop: moderateScale(12),
  },
  art: {
    width: moderateScale(200),
    height: moderateScale(200),
    borderRadius: moderateScale(18),
    justifyContent: 'center',
    alignItems: 'center',
  },
  trackText: {
    width: '100%',
    alignItems: 'center',
    marginTop: moderateScale(18),
  },
  trackTitle: {
    fontSize: moderateScale(20),
    fontFamily: 'Manrope-Bold',
    textAlign: 'center',
  },
  trackArtist: {
    fontSize: moderateScale(14),
    fontFamily: 'Manrope-SemiBold',
    opacity: 0.75,
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
  heartRow: {
    marginTop: moderateScale(14),
  },
  heartBtn: {
    width: moderateScale(44),
    height: moderateScale(44),
    borderRadius: moderateScale(22),
    justifyContent: 'center',
    alignItems: 'center',
  },
  block: {
    marginTop: moderateScale(22),
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
  transport: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
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
  tools: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
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
