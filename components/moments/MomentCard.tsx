// @ai-start
import React, {useCallback, useMemo} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {Gesture, GestureDetector} from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
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
import {getAyahArabic, getAyahTranslation} from '@/services/moments/verses';

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
  onMore: () => void;
  onContinue: () => void;
  onOpenProfile: () => void;
  onSeek: (positionMs: number) => void;
  onHoldSpeed: (held: boolean) => void;
}

const WHITE = '#FFFFFF';
const MUTED = 'rgba(255,255,255,0.62)';
const TRACK = 'rgba(255,255,255,0.22)';

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
      <Ionicons name={icon} size={moderateScale(28)} color={color} />
      <Text style={styles.railLabel}>{label}</Text>
    </Pressable>
  );
}

export const MomentCard = React.memo(function MomentCard({
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
  const ayah = ayahAt(clip, positionMs);
  const arabic = useMemo(
    () => getAyahArabic(passage.surah, ayah),
    [passage.surah, ayah],
  );
  const translation = useMemo(
    () => getAyahTranslation(passage.surah, ayah),
    [passage.surah, ayah],
  );
  const progress = Math.min(
    1,
    Math.max(0, (positionMs - clip.startMs) / (clip.endMs - clip.startMs)),
  );
  const paused = playback !== null && !playback.playing && !playback.buffering;

  // Heart that pops on double tap
  const heartScale = useSharedValue(0);
  const heartStyle = useAnimatedStyle(() => ({
    opacity: heartScale.value > 0 ? 1 : 0,
    transform: [{scale: heartScale.value}],
  }));

  const handleDoubleTap = useCallback(() => {
    heartScale.value = withSequence(
      withTiming(1.2, {duration: 160}),
      withTiming(1, {duration: 120}),
      withTiming(0, {duration: 260}),
    );
    if (!isLiked) onLike();
  }, [heartScale, isLiked, onLike]);

  const seekFromX = useCallback(
    (x: number) => {
      const ratio = Math.min(1, Math.max(0, x / width));
      onSeek(clip.startMs + ratio * (clip.endMs - clip.startMs));
    },
    [width, clip, onSeek],
  );

  const gesture = useMemo(() => {
    const doubleTap = Gesture.Tap()
      .numberOfTaps(2)
      .runOnJS(true)
      .onEnd(handleDoubleTap);
    const singleTap = Gesture.Tap().runOnJS(true).onEnd(onTogglePlay);
    // Hold the left or right third for 2x, like Reels.
    const hold = Gesture.LongPress()
      .minDuration(300)
      .runOnJS(true)
      .onStart(e => {
        if (e.x < width / 3 || e.x > (width * 2) / 3) onHoldSpeed(true);
      })
      .onFinalize(() => onHoldSpeed(false));
    // Drag left for the reciter's profile.
    const swipeLeft = Gesture.Pan()
      .activeOffsetX(-30)
      .failOffsetY([-15, 15])
      .runOnJS(true)
      .onEnd(e => {
        if (e.translationX < -60) onOpenProfile();
      });
    return Gesture.Race(
      swipeLeft,
      hold,
      Gesture.Exclusive(doubleTap, singleTap),
    );
  }, [width, handleDoubleTap, onTogglePlay, onHoldSpeed, onOpenProfile]);

  const seekGesture = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(0)
        .runOnJS(true)
        .onBegin(e => seekFromX(e.x))
        .onUpdate(e => seekFromX(e.x)),
    [seekFromX],
  );

  return (
    <View style={[styles.card, {width, height}]}>
      <GestureDetector gesture={gesture}>
        <View style={[styles.stage, {paddingTop: topInset + 56}]}>
          <Text style={styles.arabic} numberOfLines={8} adjustsFontSizeToFit>
            {arabic}
          </Text>
          <Text style={styles.reference}>
            {`${surahName} ${passage.surah}:${ayah} · ${rewayat.name}`}
          </Text>
          {paused && (
            <View style={styles.pauseBadge} pointerEvents="none">
              <Ionicons name="play" size={moderateScale(34)} color={WHITE} />
            </View>
          )}
          <Animated.View
            style={[styles.heart, heartStyle]}
            pointerEvents="none">
            <Ionicons name="heart" size={moderateScale(96)} color="#FF3B5C" />
          </Animated.View>
        </View>
      </GestureDetector>

      <View style={[styles.bottom, {paddingBottom: bottomInset + 12}]}>
        <View style={styles.bottomRow}>
          <View style={styles.meta}>
            {!!translation && (
              <Text style={styles.caption} numberOfLines={4}>
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
                <Pressable onPress={onContinue} hitSlop={6}>
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
              onPress={onMore}
            />
          </View>
        </View>

        <GestureDetector gesture={seekGesture}>
          <View style={styles.seekArea}>
            <View style={styles.track}>
              <View style={[styles.fill, {width: `${progress * 100}%`}]} />
            </View>
          </View>
        </GestureDetector>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#000000',
  },
  stage: {
    flex: 1,
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
  },
  reference: {
    marginTop: moderateScale(16),
    fontFamily: 'Manrope-Medium',
    fontSize: moderateScale(12),
    color: MUTED,
  },
  pauseBadge: {
    position: 'absolute',
    width: moderateScale(72),
    height: moderateScale(72),
    borderRadius: moderateScale(36),
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heart: {
    position: 'absolute',
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
    lineHeight: moderateScale(20),
    color: WHITE,
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
  continue: {
    marginTop: moderateScale(3),
    fontFamily: 'Manrope-SemiBold',
    fontSize: moderateScale(13),
    color: MUTED,
  },
  rail: {
    alignItems: 'center',
    gap: moderateScale(18),
  },
  railButton: {
    alignItems: 'center',
  },
  railLabel: {
    marginTop: moderateScale(3),
    fontFamily: 'Manrope-SemiBold',
    fontSize: moderateScale(11),
    color: WHITE,
  },
  seekArea: {
    height: moderateScale(28),
    justifyContent: 'center',
    marginTop: moderateScale(8),
  },
  track: {
    height: 2,
    borderRadius: 1,
    backgroundColor: TRACK,
    overflow: 'hidden',
  },
  fill: {
    height: 2,
    backgroundColor: WHITE,
  },
});
// @ai-end
