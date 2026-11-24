// @ai-generated
/**
 * The pieces of Browse › All reciters: a panel row, a card, the preview
 * ring and waveform they share, and the heart. Light components only (no
 * sheets or menus), so the list stays cheap to scroll.
 */
import React, {useMemo} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import Svg, {Circle} from 'react-native-svg';
import {Feather, Ionicons} from '@expo/vector-icons';
import Color from 'color';
import {useTranslation} from 'react-i18next';
import {localizeDigits} from '@/i18n/format';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale} from '@/utils/scale';
import type {Theme} from '@/utils/themeUtils';
import type {Reciter} from '@/data/reciterData';
import {ReciterImage} from '@/components/ReciterImage';
import {
  PANEL_ART_GAP,
  PANEL_ART_SIZE,
  PANEL_ROW_PADDING,
  PANEL_ROW_VERTICAL,
  PANEL_RADIUS,
  PanelRow,
  usePanelColor,
} from '@/components/collection/CollectionPanel';

export interface PreviewState {
  progress: number;
  elapsed: number;
}

export interface ReciterItemProps {
  reciter: Reciter;
  name: string;
  line: string;
  downloaded: boolean;
  favorite: boolean;
  /** Set while this reciter's preview plays. */
  preview: PreviewState | null;
  /** 'play' where a tap plays a surah (choosing for a surah). */
  trailing: 'heart' | 'play';
  onPress: (reciter: Reciter) => void;
  onPreview: (reciter: Reciter) => void;
  onNext: () => void;
  onToggleFavorite: (reciter: Reciter) => void;
}

const WAVE = [
  0.45, 0.7, 0.55, 0.9, 0.6, 0.35, 0.75, 1, 0.65, 0.4, 0.8, 0.55, 0.95, 0.5,
  0.7, 0.35, 0.6, 0.85, 0.45, 0.75, 0.55, 0.9, 0.4, 0.65, 0.8, 0.5,
];

function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return localizeDigits(
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`,
  );
}

/** Bars that fill as the preview plays. */
export function PreviewWave({
  progress,
  height,
  bars = WAVE.length,
}: {
  progress: number;
  height: number;
  bars?: number;
}) {
  const {theme} = useTheme();
  const off = Color(theme.colors.text).alpha(0.2).toString();
  return (
    <View
      style={[styles.wave, {height}]}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden>
      {WAVE.slice(0, bars).map((level, i) => (
        <View
          key={i}
          style={[
            styles.waveBar,
            {
              height: Math.max(2, level * height),
              backgroundColor:
                (i + 0.5) / bars <= progress ? theme.colors.text : off,
            },
          ]}
        />
      ))}
    </View>
  );
}

/** A thin progress ring drawn around a round photo. */
function PreviewRing({size, progress}: {size: number; progress: number}) {
  const {theme} = useTheme();
  const stroke = moderateScale(2.5);
  const r = (size - stroke) / 2;
  const length = 2 * Math.PI * r;
  return (
    <Svg
      width={size}
      height={size}
      style={[StyleSheet.absoluteFill, {transform: [{rotate: '-90deg'}]}]}
      pointerEvents="none">
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={Color(theme.colors.text).alpha(0.18).toString()}
        strokeWidth={stroke}
        fill="none"
      />
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={theme.colors.text}
        strokeWidth={stroke}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={`${length} ${length}`}
        strokeDashoffset={length * (1 - Math.min(1, Math.max(0, progress)))}
      />
    </Svg>
  );
}

/**
 * The round photo. Tapping it plays or stops the preview; while it plays a
 * ring runs round it and a pause glyph sits on it.
 */
function PreviewPhoto({
  reciter,
  name,
  size,
  preview,
  onPreview,
  showPlayBadge,
}: {
  reciter: Reciter;
  name: string;
  size: number;
  preview: PreviewState | null;
  onPreview: (reciter: Reciter) => void;
  showPlayBadge?: boolean;
}) {
  const {theme} = useTheme();
  const {t} = useTranslation('home');
  const s = useMemo(() => photoStyles(theme, size), [theme, size]);
  const gap = moderateScale(4);
  const inner = preview ? size - gap * 2 : size;
  return (
    <Pressable
      onPress={() => onPreview(reciter)}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={
        preview ? t('browse.stopPreview') : t('browse.playPreview', {name})
      }
      style={({pressed}) => [s.wrap, pressed && {opacity: 0.8}]}>
      <View
        style={[
          s.photo,
          {width: inner, height: inner, margin: (size - inner) / 2},
        ]}>
        <ReciterImage
          imageUrl={reciter.image_url || undefined}
          reciterName={reciter.name}
          style={s.image}
          profileIconSize={inner * 0.4}
        />
        {preview ? (
          <View style={s.dim}>
            <Ionicons name="pause" size={inner * 0.32} color="#ffffff" />
          </View>
        ) : null}
      </View>
      {preview ? <PreviewRing size={size} progress={preview.progress} /> : null}
      {showPlayBadge && !preview ? (
        <View style={s.badge}>
          <Ionicons
            name="play"
            size={moderateScale(11)}
            color={theme.colors.text}
            style={s.badgeGlyph}
          />
        </View>
      ) : null}
    </Pressable>
  );
}

function photoStyles(theme: Theme, size: number) {
  const badge = Math.round(size * 0.3);
  return StyleSheet.create({
    wrap: {width: size, height: size},
    photo: {
      borderRadius: size,
      overflow: 'hidden',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: Color(theme.colors.text).alpha(0.12).toString(),
    },
    image: {width: '100%', height: '100%', borderRadius: size},
    dim: {
      ...StyleSheet.absoluteFill,
      backgroundColor: 'rgba(0,0,0,0.32)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    badge: {
      position: 'absolute',
      end: -moderateScale(1),
      bottom: -moderateScale(1),
      width: badge,
      height: badge,
      borderRadius: badge / 2,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.isDarkMode
        ? Color('#2a2f34').toString()
        : '#ffffff',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: Color(theme.colors.text).alpha(0.14).toString(),
    },
    // The play triangle sits a little left of centre by eye.
    badgeGlyph: {marginStart: moderateScale(1.5)},
  });
}

function HeartButton({
  reciter,
  name,
  favorite,
  onToggle,
  size,
}: {
  reciter: Reciter;
  name: string;
  favorite: boolean;
  onToggle: (reciter: Reciter) => void;
  size: number;
}) {
  const {theme} = useTheme();
  const {t} = useTranslation('home');
  return (
    <Pressable
      onPress={() => onToggle(reciter)}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityState={{selected: favorite}}
      accessibilityLabel={
        favorite ? t('browse.unfavorite', {name}) : t('browse.favorite', {name})
      }>
      <Ionicons
        name={favorite ? 'heart' : 'heart-outline'}
        size={size}
        color={
          favorite
            ? theme.colors.text
            : Color(theme.colors.text).alpha(0.45).toString()
        }
      />
    </Pressable>
  );
}

function NextButton({onNext}: {onNext: () => void}) {
  const {theme} = useTheme();
  const {t} = useTranslation('home');
  return (
    <Pressable
      onPress={onNext}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={t('browse.nextVoice')}
      style={({pressed}) => [
        styles.nextButton,
        {backgroundColor: Color(theme.colors.text).alpha(0.08).toString()},
        pressed && {opacity: 0.6},
      ]}>
      <Ionicons
        name="play-skip-forward"
        size={moderateScale(13)}
        color={theme.colors.text}
      />
    </Pressable>
  );
}

/** One reciter in an inset panel. */
export const ReciterPanelRow = React.memo(function ReciterPanelRow({
  first,
  last,
  ...props
}: ReciterItemProps & {first: boolean; last: boolean}) {
  const {theme} = useTheme();
  const {
    reciter,
    name,
    line,
    downloaded,
    favorite,
    preview,
    trailing,
    onPress,
    onPreview,
    onNext,
    onToggleFavorite,
  } = props;
  const muted = Color(theme.colors.text).alpha(0.55).toString();
  return (
    <PanelRow first={first} last={last}>
      <Pressable
        onPress={() => onPress(reciter)}
        accessibilityRole="button"
        accessibilityLabel={name}
        accessibilityHint={line}
        style={({pressed}) => [
          styles.row,
          (pressed || preview) && {
            backgroundColor: Color(theme.colors.text).alpha(0.05).toString(),
          },
        ]}>
        <PreviewPhoto
          reciter={reciter}
          name={name}
          size={PANEL_ART_SIZE}
          preview={preview}
          onPreview={onPreview}
        />
        <View style={styles.rowText}>
          <View style={styles.nameLine}>
            <Text
              style={[styles.name, {color: theme.colors.text}]}
              numberOfLines={1}>
              {name}
            </Text>
            {downloaded ? (
              <Feather
                name="arrow-down-circle"
                size={moderateScale(12)}
                color={muted}
              />
            ) : null}
          </View>
          {preview ? (
            <View style={styles.previewLine}>
              <PreviewWave
                progress={preview.progress}
                height={moderateScale(14)}
              />
              <Text style={[styles.time, {color: muted}]}>
                {formatTime(preview.elapsed)}
              </Text>
            </View>
          ) : (
            <Text style={[styles.line, {color: muted}]} numberOfLines={1}>
              {line}
            </Text>
          )}
        </View>
        <View style={styles.trailing}>
          {preview ? (
            <NextButton onNext={onNext} />
          ) : trailing === 'play' ? (
            <Ionicons
              name="play"
              size={moderateScale(16)}
              color={Color(theme.colors.text).alpha(0.8).toString()}
            />
          ) : (
            <HeartButton
              reciter={reciter}
              name={name}
              favorite={favorite}
              onToggle={onToggleFavorite}
              size={moderateScale(19)}
            />
          )}
        </View>
      </Pressable>
    </PanelRow>
  );
});

/** One reciter as a small card, three to a row on phones. */
export const ReciterCard = React.memo(function ReciterCard({
  width,
  ...props
}: ReciterItemProps & {width: number}) {
  const {theme} = useTheme();
  const panel = usePanelColor();
  const {
    reciter,
    name,
    line,
    downloaded,
    favorite,
    preview,
    trailing,
    onPress,
    onPreview,
    onToggleFavorite,
  } = props;
  const photo = Math.round(width - moderateScale(24));
  const muted = Color(theme.colors.text).alpha(0.55).toString();
  return (
    <Pressable
      onPress={() => onPress(reciter)}
      accessibilityRole="button"
      accessibilityLabel={name}
      accessibilityHint={line}
      style={({pressed}) => [
        styles.card,
        {width, backgroundColor: panel},
        pressed && {opacity: 0.85},
      ]}>
      <PreviewPhoto
        reciter={reciter}
        name={name}
        size={photo}
        preview={preview}
        onPreview={onPreview}
        showPlayBadge
      />
      <View style={styles.cardNameLine}>
        <Text
          style={[styles.cardName, {color: theme.colors.text}]}
          numberOfLines={1}>
          {name}
        </Text>
        {downloaded ? (
          <Feather
            name="arrow-down-circle"
            size={moderateScale(10)}
            color={muted}
          />
        ) : null}
      </View>
      {preview ? (
        <View style={styles.cardWave}>
          <PreviewWave
            progress={preview.progress}
            height={moderateScale(11)}
            bars={16}
          />
        </View>
      ) : (
        <Text style={[styles.cardLine, {color: muted}]} numberOfLines={1}>
          {line}
        </Text>
      )}
      {trailing === 'heart' ? (
        <View style={styles.cardHeart}>
          <HeartButton
            reciter={reciter}
            name={name}
            favorite={favorite}
            onToggle={onToggleFavorite}
            size={moderateScale(15)}
          />
        </View>
      ) : null}
    </Pressable>
  );
});

export const CARD_GAP = moderateScale(8);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingStart: PANEL_ROW_PADDING,
    paddingEnd: moderateScale(14),
    paddingVertical: PANEL_ROW_VERTICAL,
    gap: PANEL_ART_GAP,
  },
  rowText: {flex: 1, minWidth: 0, gap: moderateScale(2)},
  nameLine: {flexDirection: 'row', alignItems: 'center', gap: moderateScale(5)},
  name: {
    flexShrink: 1,
    fontSize: moderateScale(14),
    fontFamily: 'Manrope-SemiBold',
    textAlign: 'left',
  },
  line: {
    fontSize: moderateScale(12),
    fontFamily: 'Manrope-Medium',
    textAlign: 'left',
  },
  previewLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: moderateScale(8),
  },
  time: {
    fontSize: moderateScale(11),
    fontFamily: 'Manrope-Medium',
    fontVariant: ['tabular-nums'],
  },
  trailing: {
    minWidth: moderateScale(30),
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextButton: {
    width: moderateScale(30),
    height: moderateScale(30),
    borderRadius: moderateScale(15),
    alignItems: 'center',
    justifyContent: 'center',
  },
  wave: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: moderateScale(2),
  },
  waveBar: {flex: 1, borderRadius: 1},
  card: {
    borderRadius: PANEL_RADIUS * 0.75,
    borderCurve: 'continuous',
    alignItems: 'center',
    paddingTop: moderateScale(12),
    paddingBottom: moderateScale(10),
    paddingHorizontal: moderateScale(6),
  },
  cardNameLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: moderateScale(3),
    marginTop: moderateScale(8),
    maxWidth: '100%',
  },
  cardName: {
    flexShrink: 1,
    fontSize: moderateScale(12),
    fontFamily: 'Manrope-SemiBold',
    textAlign: 'center',
  },
  cardLine: {
    marginTop: moderateScale(1),
    fontSize: moderateScale(10.5),
    fontFamily: 'Manrope-Medium',
    textAlign: 'center',
  },
  cardWave: {
    alignSelf: 'stretch',
    height: moderateScale(14),
    marginTop: moderateScale(2),
    paddingHorizontal: moderateScale(8),
    flexDirection: 'row',
  },
  cardHeart: {
    position: 'absolute',
    top: moderateScale(8),
    end: moderateScale(8),
  },
});
