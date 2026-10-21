// @ai-start
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Platform, Pressable, StyleSheet, Text, View} from 'react-native';
import {BlurView} from 'expo-blur';
import {Gesture, GestureDetector} from 'react-native-gesture-handler';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import {Ionicons} from '@expo/vector-icons';
import {moderateScale} from 'react-native-size-matters';
import {useTranslation} from 'react-i18next';
import {ReciterImage} from '@/components/ReciterImage';
import {SURAHS} from '@/data/surahData';
import {getSurahDisplayName} from '@/i18n/format';
import type {MomentCardData} from '@/services/moments/useMomentsFeed';
import type {MomentsPlaybackState} from '@/services/moments/MomentsAudioService';
import {ayahAt} from '@/services/moments/buildMoment';
import {isWholeSurah} from '@/services/moments/passages';
import {cardPropsEqual} from '@/services/moments/feedPlayback';
import {getAyahArabic, getAyahTranslation} from '@/services/moments/verses';
import {
  cardGestureHitSlop,
  classifySwipe,
  DOUBLE_TAP_MAX_DELAY_MS,
  DOUBLE_TAP_MAX_DISTANCE,
  HOLD_MAX_DISTANCE,
  HOLD_MIN_DURATION_MS,
  HOLD_RATE,
  isHoldZone,
  SWIPE_ACTIVE_OFFSET_X,
  SWIPE_FAIL_OFFSET_Y,
  swipeFollowOffset,
  TAP_MAX_DISTANCE,
} from '@/services/moments/gestures';
import {lightHaptics} from '@/utils/haptics';
import {MomentScrubber} from './MomentScrubber';

interface MomentCardProps {
  card: MomentCardData;
  width: number;
  height: number;
  topInset: number;
  bottomInset: number;
  playback: MomentsPlaybackState | null;
  isLiked: boolean;
  isFavorite: boolean;
  onTogglePlay: () => void;
  onLike: () => void;
  onToggleFavorite: () => void;
  onShare: () => void;
  /** Gets the ayah on screen, for "Copy ayah text". */
  onMore: (ayah: number) => void;
  onContinue: () => void;
  onOpenProfile: () => void;
  onSeek: (positionMs: number) => void;
  onHoldSpeed: (held: boolean) => void;
}

const WHITE = '#FFFFFF';
const MUTED = 'rgba(255,255,255,0.62)';
const HEART_SIZE = moderateScale(96);
const PLAY_SIZE = moderateScale(76);

function RailButton({
  icon,
  label,
  color = WHITE,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={styles.railButton}>
      <Ionicons name={icon} size={moderateScale(30)} color={color} />
      <Text style={styles.railLabel}>{label}</Text>
    </Pressable>
  );
}

function MomentCardView({
  card,
  width,
  height,
  topInset,
  bottomInset,
  playback,
  isLiked,
  isFavorite,
  onTogglePlay,
  onLike,
  onToggleFavorite,
  onShare,
  onMore,
  onContinue,
  onOpenProfile,
  onSeek,
  onHoldSpeed,
}: MomentCardProps) {
  const {t} = useTranslation('home');
  const {clip, passage, reciter, rewayat} = card;
  const surah = SURAHS.find(s => s.id === passage.surah);
  const surahName = surah ? getSurahDisplayName(surah) : '';

  const positionMs = playback?.positionMs ?? clip.startMs;
  // The caption follows the finger while scrubbing.
  const [scrubAyah, setScrubAyah] = useState<number | null>(null);
  const ayah = scrubAyah ?? ayahAt(clip, positionMs);
  const arabic = useMemo(
    () => getAyahArabic(passage.surah, ayah),
    [passage.surah, ayah],
  );
  const translation = useMemo(
    () => getAyahTranslation(passage.surah, ayah),
    [passage.surah, ayah],
  );
  const paused = playback !== null && !playback.playing && !playback.buffering;

  // The parent hands in new callbacks on every playback tick. The gestures
  // read the latest ones from here, so they aren't rebuilt (and their UI
  // thread worklets re-sent) ten times a second, or swapped mid-gesture.
  const latest = useRef({
    isLiked,
    onLike,
    onTogglePlay,
    onOpenProfile,
    onHoldSpeed,
    playing: !!playback?.playing,
  });
  latest.current = {
    isLiked,
    onLike,
    onTogglePlay,
    onOpenProfile,
    onHoldSpeed,
    playing: !!playback?.playing,
  };
  const togglePlay = useCallback(() => latest.current.onTogglePlay(), []);
  const openProfile = useCallback(() => latest.current.onOpenProfile(), []);

  // Play badge: pops in with a slight scale when pausing, fades on resume.
  // Mounted only while visible, so idle cards don't each keep a live blur.
  const pauseAnim = useSharedValue(paused ? 1 : 0);
  const [badgeMounted, setBadgeMounted] = useState(paused);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const unmountBadge = useCallback(() => {
    // A late fade-out callback must not hide a badge that was re-shown.
    if (!pausedRef.current) setBadgeMounted(false);
  }, []);
  useEffect(() => {
    if (paused) {
      setBadgeMounted(true);
      pauseAnim.value = withTiming(1, {
        duration: 180,
        easing: Easing.out(Easing.back(1.6)),
      });
    } else {
      pauseAnim.value = withTiming(
        0,
        {duration: 140, easing: Easing.in(Easing.quad)},
        finished => {
          if (finished) runOnJS(unmountBadge)();
        },
      );
    }
  }, [paused, pauseAnim, unmountBadge]);
  const pauseStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, pauseAnim.value),
    transform: [{scale: 0.82 + 0.18 * pauseAnim.value}],
  }));

  // Heart that pops where the double tap landed
  const heartScale = useSharedValue(0);
  const heartX = useSharedValue(0);
  const heartY = useSharedValue(0);
  const heartTilt = useSharedValue(0);
  const heartStyle = useAnimatedStyle(() => ({
    opacity: heartScale.value > 0 ? 1 : 0,
    left: heartX.value - HEART_SIZE / 2,
    top: heartY.value - HEART_SIZE / 2,
    transform: [{rotate: `${heartTilt.value}deg`}, {scale: heartScale.value}],
  }));

  const handleDoubleTap = useCallback(
    (x: number, y: number) => {
      heartX.value = x;
      heartY.value = y;
      heartTilt.value = Math.random() * 30 - 15;
      heartScale.value = withSequence(
        withTiming(1.2, {duration: 160}),
        withTiming(1, {duration: 120}),
        withTiming(0, {duration: 260}),
      );
      if (!latest.current.isLiked) latest.current.onLike();
    },
    [heartScale, heartX, heartY, heartTilt],
  );

  // Hold an outer third for 2x; only a hold that sped up gets a release.
  const [holding, setHolding] = useState(false);
  const holdingRef = useRef(false);
  const held = useSharedValue(false);
  const startHold = useCallback(() => {
    // A paused moment has nothing to speed up.
    if (holdingRef.current || !latest.current.playing) return;
    holdingRef.current = true;
    setHolding(true);
    lightHaptics();
    latest.current.onHoldSpeed(true);
  }, []);
  const endHold = useCallback(() => {
    if (!holdingRef.current) return;
    holdingRef.current = false;
    setHolding(false);
    latest.current.onHoldSpeed(false);
  }, []);
  // Don't leave the feed at 2x if the card unmounts mid-hold.
  useEffect(
    () => () => {
      if (holdingRef.current) latest.current.onHoldSpeed(false);
    },
    [],
  );

  // The card slides a little with a leftward drag.
  const followX = useSharedValue(0);
  const followStyle = useAnimatedStyle(() => ({
    transform: [{translateX: followX.value}],
  }));

  const gesture = useMemo(() => {
    // Leave the header band to the profile and filter buttons.
    const hitSlop = cardGestureHitSlop(topInset);
    // Taps fail once the finger moves, so a vertical swipe only scrolls.
    const doubleTap = Gesture.Tap()
      .numberOfTaps(2)
      .maxDelay(DOUBLE_TAP_MAX_DELAY_MS)
      .maxDistance(DOUBLE_TAP_MAX_DISTANCE)
      .hitSlop(hitSlop)
      .runOnJS(true)
      .onEnd((e, success) => {
        if (success) handleDoubleTap(e.x, e.y);
      });
    const singleTap = Gesture.Tap()
      .maxDistance(TAP_MAX_DISTANCE)
      .hitSlop(hitSlop)
      .runOnJS(true)
      .onEnd((_e, success) => {
        if (success) togglePlay();
      });
    // Hold the left or right third for 2x, like Reels. A hold in the middle
    // fails right away, so a slow tap there still pauses. Runs on the UI
    // thread, since only a worklet can fail a gesture by hand.
    const hold = Gesture.LongPress()
      .minDuration(HOLD_MIN_DURATION_MS)
      .maxDistance(HOLD_MAX_DISTANCE)
      .hitSlop(hitSlop)
      .onTouchesDown((e, manager) => {
        const touch = e.allTouches[0];
        if (touch && !isHoldZone(touch.x, width)) manager.fail();
      })
      .onStart(e => {
        if (!isHoldZone(e.x, width)) return;
        held.value = true;
        runOnJS(startHold)();
      })
      .onFinalize(() => {
        if (!held.value) return;
        held.value = false;
        runOnJS(endHold)();
      });
    // Drag left for the reciter's profile. Runs on the UI thread so the card
    // can follow the finger.
    const swipeLeft = Gesture.Pan()
      .activeOffsetX(SWIPE_ACTIVE_OFFSET_X)
      .failOffsetY([-SWIPE_FAIL_OFFSET_Y, SWIPE_FAIL_OFFSET_Y])
      .hitSlop(hitSlop)
      .onUpdate(e => {
        followX.value = swipeFollowOffset(e.translationX);
      })
      .onEnd((e, success) => {
        if (success && classifySwipe(e) === 'profile') {
          runOnJS(openProfile)();
        }
      })
      .onFinalize(() => {
        followX.value = withSpring(0, {damping: 18, stiffness: 220});
      });
    return Gesture.Race(
      swipeLeft,
      hold,
      Gesture.Exclusive(doubleTap, singleTap),
    );
  }, [
    width,
    topInset,
    followX,
    held,
    handleDoubleTap,
    togglePlay,
    startHold,
    endHold,
    openProfile,
  ]);

  return (
    <Animated.View style={[styles.card, {width, height}, followStyle]}>
      <GestureDetector gesture={gesture}>
        <View style={[styles.stage, {paddingTop: topInset + 56}]}>
          <Text
            style={styles.arabic}
            numberOfLines={8}
            adjustsFontSizeToFit
            minimumFontScale={0.5}>
            {arabic}
          </Text>
          <Text style={styles.reference}>
            {`${surahName} ${passage.surah}:${ayah} · ${rewayat.name}`}
          </Text>
          <Animated.View
            style={[styles.heart, heartStyle]}
            pointerEvents="none">
            <Ionicons name="heart" size={HEART_SIZE} color="#FF3B5C" />
          </Animated.View>
          {holding && (
            <Animated.View
              entering={FadeIn.duration(120)}
              exiting={FadeOut.duration(120)}
              style={[styles.speedBadge, {top: topInset + 64}]}
              pointerEvents="none">
              <Ionicons
                name="play-forward"
                size={moderateScale(12)}
                color={WHITE}
              />
              <Text style={styles.speedText}>
                {t('moments.holdRate', {rate: HOLD_RATE})}
              </Text>
            </Animated.View>
          )}
        </View>
      </GestureDetector>

      <View style={[styles.bottom, {paddingBottom: bottomInset + 12}]}>
        <View style={styles.bottomRow}>
          <View style={styles.meta}>
            {!!translation && (
              <Text
                style={styles.caption}
                numberOfLines={9}
                adjustsFontSizeToFit
                minimumFontScale={0.85}>
                {translation}
              </Text>
            )}
            <View style={styles.reciterRow}>
              <Pressable onPress={onOpenProfile} hitSlop={6}>
                <ReciterImage
                  imageUrl={reciter.image_url || undefined}
                  reciterName={reciter.name}
                  style={styles.avatar}
                  profileIconSize={moderateScale(16)}
                />
              </Pressable>
              <View style={styles.reciterText}>
                <View style={styles.nameRow}>
                  <Pressable onPress={onOpenProfile} style={styles.nameButton}>
                    <Text style={styles.name} numberOfLines={1}>
                      {reciter.name}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={onToggleFavorite}
                    accessibilityRole="button"
                    style={[styles.pill, isFavorite && styles.pillActive]}>
                    <Text
                      style={[
                        styles.pillText,
                        isFavorite && styles.pillTextActive,
                      ]}>
                      {isFavorite
                        ? t('moments.favorited')
                        : t('moments.favorite')}
                    </Text>
                  </Pressable>
                </View>
                <Pressable
                  onPress={onContinue}
                  hitSlop={6}
                  accessibilityRole="button"
                  style={styles.continuePill}>
                  <Text style={styles.continue} numberOfLines={1}>
                    {isWholeSurah(passage)
                      ? t('moments.playInFull', {surah: surahName})
                      : t('moments.continue', {surah: surahName})}
                    {' ›'}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
          <View style={styles.rail}>
            <RailButton
              icon={isLiked ? 'heart' : 'heart-outline'}
              color={isLiked ? '#FF3B5C' : WHITE}
              label={t('moments.like')}
              onPress={onLike}
            />
            <RailButton
              icon="paper-plane-outline"
              label={t('moments.share')}
              onPress={onShare}
            />
            <RailButton
              icon="ellipsis-horizontal"
              label={t('moments.more')}
              onPress={() => onMore(ayah)}
            />
          </View>
        </View>

        <MomentScrubber
          clip={clip}
          positionMs={positionMs}
          playing={!!playback?.playing}
          enabled={playback !== null}
          onSeek={onSeek}
          onScrubAyah={setScrubAyah}
        />
      </View>

      {/* Centered on the whole (full-screen) card, not the stage above the
          caption. The circle itself resumes, since on short screens it can
          sit over the caption, which has no tap gesture. */}
      {badgeMounted && (
        <View
          style={styles.pauseOverlay}
          pointerEvents="box-none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants">
          <Animated.View style={[styles.playShadow, pauseStyle]}>
            <Pressable onPress={togglePlay} hitSlop={12}>
              {Platform.OS === 'ios' ? (
                <BlurView intensity={28} tint="dark" style={styles.playButton}>
                  <Ionicons
                    name="play"
                    size={moderateScale(34)}
                    color={WHITE}
                    style={styles.playGlyph}
                  />
                </BlurView>
              ) : (
                <View style={[styles.playButton, styles.playButtonSolid]}>
                  <Ionicons
                    name="play"
                    size={moderateScale(34)}
                    color={WHITE}
                    style={styles.playGlyph}
                  />
                </View>
              )}
            </Pressable>
          </Animated.View>
        </View>
      )}
    </Animated.View>
  );
}

// A playback tick with nothing new for the card does not re-render it.
export const MomentCard = React.memo(MomentCardView, cardPropsEqual);

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#000000',
  },
  stage: {
    flex: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: moderateScale(28),
  },
  arabic: {
    fontFamily: 'Uthmani',
    fontSize: moderateScale(34),
    lineHeight: moderateScale(62),
    color: WHITE,
    textAlign: 'center',
    writingDirection: 'rtl',
    // Keep long ayat a comfortable measure on tablets.
    maxWidth: 640,
    // Bounded by the stage, so a long ayah shrinks instead of pushing the
    // reference line down into the caption.
    flexShrink: 1,
  },
  reference: {
    flexShrink: 0,
    marginTop: moderateScale(18),
    fontFamily: 'Manrope-Medium',
    fontSize: moderateScale(12),
    letterSpacing: 0.2,
    color: MUTED,
  },
  pauseOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playShadow: {
    width: PLAY_SIZE,
    height: PLAY_SIZE,
    borderRadius: PLAY_SIZE / 2,
    shadowColor: '#000000',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: {width: 0, height: 4},
  },
  playButton: {
    width: PLAY_SIZE,
    height: PLAY_SIZE,
    borderRadius: PLAY_SIZE / 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.28)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  playButtonSolid: {
    backgroundColor: 'rgba(30,30,30,0.62)',
  },
  playGlyph: {
    // The triangle's visual mass sits left of its box; nudge it right.
    marginLeft: moderateScale(4),
  },
  heart: {
    position: 'absolute',
  },
  speedBadge: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: moderateScale(4),
    paddingHorizontal: moderateScale(10),
    paddingVertical: moderateScale(4),
    borderRadius: moderateScale(12),
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  speedText: {
    fontFamily: 'Manrope-Bold',
    fontSize: moderateScale(12),
    color: WHITE,
  },
  bottom: {
    paddingHorizontal: moderateScale(16),
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  meta: {
    flex: 1,
    paddingRight: moderateScale(12),
  },
  caption: {
    fontFamily: 'Manrope-Medium',
    fontSize: moderateScale(14),
    lineHeight: moderateScale(21),
    // A step below the ayah so the Arabic leads.
    color: 'rgba(255,255,255,0.9)',
    marginBottom: moderateScale(14),
  },
  reciterRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: moderateScale(40),
    height: moderateScale(40),
    borderRadius: moderateScale(20),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  reciterText: {
    flex: 1,
    marginLeft: moderateScale(10),
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nameButton: {
    flexShrink: 1,
  },
  name: {
    fontFamily: 'Manrope-Bold',
    fontSize: moderateScale(15),
    color: WHITE,
  },
  pill: {
    marginLeft: moderateScale(8),
    paddingHorizontal: moderateScale(10),
    paddingVertical: moderateScale(3),
    borderRadius: moderateScale(8),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  pillActive: {
    backgroundColor: WHITE,
    borderColor: WHITE,
  },
  pillText: {
    fontFamily: 'Manrope-SemiBold',
    fontSize: moderateScale(12),
    color: WHITE,
  },
  pillTextActive: {
    color: '#000000',
  },
  continuePill: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    marginTop: moderateScale(6),
    paddingHorizontal: moderateScale(10),
    paddingVertical: moderateScale(3),
    borderRadius: moderateScale(999),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  continue: {
    fontFamily: 'Manrope-SemiBold',
    fontSize: moderateScale(12),
    color: 'rgba(255,255,255,0.85)',
  },
  rail: {
    alignItems: 'center',
    gap: moderateScale(20),
    // Sit the last label level with the reciter row's bottom edge.
    paddingBottom: moderateScale(2),
  },
  railButton: {
    alignItems: 'center',
    minWidth: moderateScale(48),
  },
  railLabel: {
    marginTop: moderateScale(4),
    fontFamily: 'Manrope-SemiBold',
    fontSize: moderateScale(11),
    color: WHITE,
  },
});
// @ai-end
