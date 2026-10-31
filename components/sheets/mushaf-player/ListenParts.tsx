// @ai-generated
/**
 * Building blocks of the Mushaf Listen sheet (MushafPlayerOptionsSheet):
 * the reciter hero, the range preset tiles, the range card, the repeat
 * counters, the speed slider and the floating Play button.
 */

import React from 'react';
import {View, Text, Pressable, StyleSheet} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {LinearGradient} from 'expo-linear-gradient';
import Color from 'color';
import {useTranslation} from 'react-i18next';
import {moderateScale as ms} from '@/utils/scale';
import {useTheme} from '@/hooks/useTheme';
import type {Theme} from '@/utils/themeUtils';
import {ReciterImage} from '@/components/ReciterImage';
import {NativeSlider} from '@/components/native/NativeSlider';
import {localizeDigits} from '@/i18n/format';
import {flipX} from '@/utils/rtl';
import type {RangePreset} from '@/utils/playbackRangeSelection';

export const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
/** Repeat counts the counters step through; 0 plays on a loop. */
export const REPEAT_STEPS = [1, 2, 3, 5, 10, 0];

export function stepRepeat(value: number, direction: 1 | -1): number {
  // Loop (0) sits after the largest count.
  const rank = (v: number) => (v === 0 ? Infinity : v);
  const ordered = REPEAT_STEPS;
  if (direction > 0) {
    return ordered.find(v => rank(v) > rank(value)) ?? value;
  }
  const lower = ordered.filter(v => rank(v) < rank(value));
  return lower.length ? lower[lower.length - 1] : value;
}

export function useListenColors(theme: Theme) {
  const text = theme.colors.text;
  return {
    text,
    secondary: Color(theme.colors.textSecondary).alpha(0.85).toString(),
    card: Color(text).alpha(0.05).toString(),
    cardPressed: Color(text).alpha(0.09).toString(),
    chip: Color(text).alpha(0.07).toString(),
    divider: Color(text).alpha(0.07).toString(),
    band: Color(text).alpha(0.1).toString(),
    faint: Color(text).alpha(0.45).toString(),
    background: theme.colors.background,
  };
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

export function SheetHeader({
  title,
  onBack,
  onClose,
  trailing,
}: {
  title: string;
  onBack?: () => void;
  onClose?: () => void;
  trailing?: React.ReactNode;
}) {
  const {theme} = useTheme();
  const {t} = useTranslation(['sheets', 'common']);
  const c = useListenColors(theme);
  const button = (
    icon: keyof typeof Ionicons.glyphMap,
    label: string,
    onPress: () => void,
    flip = false,
  ) => (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={[styles.headerButton, {backgroundColor: c.chip}]}>
      <Ionicons
        name={icon}
        size={ms(17)}
        color={c.text}
        style={flip ? flipX : undefined}
      />
    </Pressable>
  );
  return (
    <View style={styles.header}>
      {onBack ? (
        button('chevron-back', t('mushafPlayer.back'), onBack, true)
      ) : (
        <View style={styles.headerSide} />
      )}
      <Text style={[styles.headerTitle, {color: c.text}]} numberOfLines={1}>
        {title}
      </Text>
      {trailing ??
        (onClose ? (
          button('close', t('common:actions.close'), onClose)
        ) : (
          <View style={styles.headerSide} />
        ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Reciter hero
// ---------------------------------------------------------------------------

export function ReciterHero({
  name,
  detail,
  imageUrl,
  nowPlaying,
  progress,
  compact,
  onChange,
}: {
  name: string | null;
  detail: string;
  imageUrl: string | null;
  /** "Now playing Al-Baqarah 3" while audio plays. */
  nowPlaying: string | null;
  /** 0–1 through the range while playing. */
  progress: number | null;
  /** iPad card: photo beside the name. */
  compact?: boolean;
  onChange: () => void;
}) {
  const {theme} = useTheme();
  const {t} = useTranslation('sheets');
  const c = useListenColors(theme);
  const size = compact ? ms(64) : ms(84);
  const ring = size + ms(12);
  return (
    <View style={compact ? styles.heroRow : styles.hero}>
      <Pressable
        onPress={onChange}
        accessibilityRole="button"
        accessibilityLabel={t('mushafPlayer.changeReciter')}
        style={[styles.heroRing, {width: ring, height: ring}]}>
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              borderRadius: ring / 2,
              borderWidth: ms(2.5),
              borderColor:
                progress === null
                  ? c.divider
                  : Color(c.text).alpha(0.12).toString(),
            },
          ]}
        />
        {progress !== null && (
          <ProgressArc size={ring} progress={progress} color={c.text} />
        )}
        <View
          style={[
            styles.heroPhoto,
            {width: size, height: size, borderRadius: size / 2},
          ]}>
          <ReciterImage
            imageUrl={imageUrl ?? undefined}
            reciterName={name ?? ''}
            style={{width: size, height: size}}
            profileIconSize={size / 2.4}
          />
        </View>
      </Pressable>
      <View style={compact ? styles.heroTextCompact : styles.heroText}>
        <Text
          style={[
            styles.heroName,
            {color: c.text, textAlign: compact ? 'left' : 'center'},
          ]}
          numberOfLines={2}>
          {name ?? t('mushafPlayer.noReciter')}
        </Text>
        {!!detail && (
          <Text
            style={[
              styles.heroDetail,
              {color: c.secondary, textAlign: compact ? 'left' : 'center'},
            ]}
            numberOfLines={1}>
            {detail}
          </Text>
        )}
        {nowPlaying ? (
          <View style={[styles.pill, {backgroundColor: c.chip}]}>
            <Ionicons name="stats-chart" size={ms(12)} color={c.text} />
            <Text style={[styles.pillText, {color: c.text}]} numberOfLines={1}>
              {nowPlaying}
            </Text>
          </View>
        ) : (
          <Pressable
            onPress={onChange}
            accessibilityRole="button"
            style={({pressed}) => [
              styles.pill,
              {backgroundColor: pressed ? c.cardPressed : c.chip},
            ]}>
            <Ionicons name="search" size={ms(13)} color={c.text} />
            <Text style={[styles.pillText, {color: c.text}]}>
              {t('mushafPlayer.changeReciter')}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

/** A ring drawn in four quarters, each clipped to its share of progress. */
function ProgressArc({
  size,
  progress,
  color,
}: {
  size: number;
  progress: number;
  color: string;
}) {
  const p = Math.max(0, Math.min(1, progress));
  const stroke = ms(2.5);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {[0, 1, 2, 3].map(q => {
        const share = Math.max(0, Math.min(1, p * 4 - q));
        if (share <= 0) return null;
        return (
          <View
            key={q}
            style={[
              StyleSheet.absoluteFill,
              {transform: [{rotate: `${q * 90}deg`}]},
            ]}>
            <View
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                width: size / 2,
                height: (size / 2) * share,
                overflow: 'hidden',
              }}>
              <View
                style={{
                  position: 'absolute',
                  top: 0,
                  right: 0,
                  width: size,
                  height: size,
                  borderRadius: size / 2,
                  borderWidth: stroke,
                  borderColor: color,
                }}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Preset tiles
// ---------------------------------------------------------------------------

const PRESET_ICONS: Record<RangePreset, keyof typeof Ionicons.glyphMap> = {
  page: 'document-text-outline',
  surah: 'book-outline',
  juz: 'layers-outline',
  custom: 'options-outline',
};

export function PresetTiles({
  value,
  onChange,
  compact,
}: {
  value: RangePreset;
  onChange: (preset: RangePreset) => void;
  compact?: boolean;
}) {
  const {theme} = useTheme();
  const {t} = useTranslation('sheets');
  const c = useListenColors(theme);
  const labels: Record<RangePreset, string> = {
    page: t('mushafPlayer.presetPage'),
    surah: t('mushafPlayer.presetSurah'),
    juz: t('mushafPlayer.presetJuz'),
    custom: t('mushafPlayer.presetCustom'),
  };
  return (
    <View style={styles.tiles} accessibilityRole="radiogroup">
      {(Object.keys(labels) as RangePreset[]).map(preset => {
        const selected = preset === value;
        return (
          <Pressable
            key={preset}
            onPress={() => onChange(preset)}
            accessibilityRole="radio"
            accessibilityState={{selected}}
            style={({pressed}) => [
              compact ? styles.tileCompact : styles.tile,
              {backgroundColor: pressed ? c.cardPressed : c.card},
              selected && {borderColor: c.text},
            ]}>
            <Ionicons
              name={PRESET_ICONS[preset]}
              size={ms(21)}
              color={c.text}
            />
            <Text style={[styles.tileLabel, {color: c.text}]}>
              {labels[preset]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Range card
// ---------------------------------------------------------------------------

export function RangeCard({
  subtitle,
  from,
  to,
  count,
  onPress,
}: {
  subtitle: string;
  from: string;
  to: string;
  count: number;
  onPress: () => void;
}) {
  const {theme} = useTheme();
  const {t} = useTranslation('sheets');
  const c = useListenColors(theme);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityHint={t('mushafPlayer.editRange')}
      style={({pressed}) => [
        styles.rangeCard,
        {backgroundColor: pressed ? c.cardPressed : c.card},
      ]}>
      <View style={styles.rangeMain}>
        <Text style={[styles.caption, {color: c.secondary}]} numberOfLines={1}>
          {subtitle}
        </Text>
        <View style={styles.rangeNumbers}>
          <Text
            style={[styles.bigNumber, {color: c.text}]}
            numberOfLines={1}
            adjustsFontSizeToFit>
            {from}
          </Text>
          <Ionicons
            name="arrow-forward"
            size={ms(18)}
            color={c.faint}
            style={flipX}
          />
          <Text
            style={[styles.bigNumber, {color: c.text}]}
            numberOfLines={1}
            adjustsFontSizeToFit>
            {to}
          </Text>
        </View>
      </View>
      <View style={styles.rangeCount}>
        <Text style={[styles.countNumber, {color: c.text}]}>
          {localizeDigits(count)}
        </Text>
        <Text style={[styles.caption, {color: c.secondary}]}>
          {t('mushafPlayer.verses', {count})}
        </Text>
      </View>
      <Ionicons
        name="chevron-forward"
        size={ms(16)}
        color={c.faint}
        style={flipX}
      />
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Repeat counters
// ---------------------------------------------------------------------------

export function repeatLabel(value: number): string {
  return value === 0 ? '∞' : `${localizeDigits(value)}×`;
}

export function RepeatCounter({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const {theme} = useTheme();
  const {t} = useTranslation('sheets');
  const c = useListenColors(theme);
  const down = stepRepeat(value, -1);
  const up = stepRepeat(value, 1);
  const round = (icon: 'remove' | 'add', a11y: string, next: number) => (
    <Pressable
      onPress={() => onChange(next)}
      disabled={next === value}
      accessibilityRole="button"
      accessibilityLabel={`${a11y}, ${label}`}
      hitSlop={6}
      style={({pressed}) => [
        styles.roundButton,
        {backgroundColor: theme.colors.background},
        pressed && {opacity: 0.6},
        next === value && {opacity: 0.35},
      ]}>
      <Ionicons name={icon} size={ms(18)} color={c.text} />
    </Pressable>
  );
  return (
    <View
      style={[styles.counter, {backgroundColor: c.card}]}
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{text: repeatLabel(value)}}
      accessibilityActions={[{name: 'increment'}, {name: 'decrement'}]}
      onAccessibilityAction={e =>
        onChange(e.nativeEvent.actionName === 'increment' ? up : down)
      }>
      <Text style={[styles.counterLabel, {color: c.text}]} numberOfLines={1}>
        {label}
      </Text>
      <View style={styles.counterRow}>
        {round('remove', t('mushafPlayer.fewer'), down)}
        <Text style={[styles.counterValue, {color: c.text}]}>
          {repeatLabel(value)}
        </Text>
        {round('add', t('mushafPlayer.more'), up)}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Speed
// ---------------------------------------------------------------------------

export function speedIndex(rate: number): number {
  let best = 0;
  SPEEDS.forEach((s, i) => {
    if (Math.abs(s - rate) < Math.abs(SPEEDS[best] - rate)) best = i;
  });
  return best;
}

export function SpeedControl({
  rate,
  onChange,
}: {
  rate: number;
  onChange: (rate: number) => void;
}) {
  const {theme} = useTheme();
  const {t} = useTranslation('sheets');
  const c = useListenColors(theme);
  const index = speedIndex(rate);
  return (
    <View>
      <View style={styles.speedHeader}>
        <Text style={[styles.sectionTitle, {color: c.secondary}]}>
          {t('mushafPlayer.speedTitle')}
        </Text>
        <Text style={[styles.speedValue, {color: c.text}]}>
          {t('playbackSpeed.speed', {speed: localizeDigits(SPEEDS[index])})}
        </Text>
      </View>
      <View style={[styles.speedCard, {backgroundColor: c.card}]}>
        <NativeSlider
          value={index}
          minimumValue={0}
          maximumValue={SPEEDS.length - 1}
          step={1}
          accessibilityLabel={t('mushafPlayer.speedTitle')}
          onValueChange={v => {
            const next = SPEEDS[Math.round(v)];
            if (next !== undefined && next !== SPEEDS[index]) onChange(next);
          }}
        />
        <View style={styles.ticks}>
          {SPEEDS.map((s, i) => (
            <Pressable
              key={s}
              onPress={() => onChange(s)}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={t('playbackSpeed.speed', {speed: s})}>
              <Text
                style={[
                  styles.tick,
                  {color: i === index ? c.text : c.faint},
                  i === index && styles.tickOn,
                ]}>
                {localizeDigits(s)}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Floating Play
// ---------------------------------------------------------------------------

export function FloatingAction({
  label,
  icon,
  note,
  disabled,
  bottomInset,
  onPress,
}: {
  label: string;
  icon?: 'play' | 'refresh' | null;
  note?: string | null;
  disabled?: boolean;
  bottomInset: number;
  onPress: () => void;
}) {
  const {theme} = useTheme();
  const c = useListenColors(theme);
  const bg = theme.colors.background;
  return (
    <View
      pointerEvents="box-none"
      style={[styles.footer, {paddingBottom: bottomInset}]}>
      <LinearGradient
        pointerEvents="none"
        colors={[Color(bg).alpha(0).toString(), bg, bg]}
        locations={[0, 0.35, 1]}
        style={StyleSheet.absoluteFill}
      />
      {!!note && (
        <Text style={[styles.footerNote, {color: c.secondary}]}>{note}</Text>
      )}
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityState={{disabled}}
        style={({pressed}) => [
          styles.playButton,
          {backgroundColor: c.text, shadowColor: '#000'},
          pressed && {opacity: 0.85},
          disabled && {opacity: 0.35},
        ]}>
        {icon === 'play' && <Ionicons name="play" size={ms(18)} color={bg} />}
        {icon === 'refresh' && (
          <Ionicons name="refresh" size={ms(18)} color={bg} />
        )}
        <Text style={[styles.playLabel, {color: bg}]} numberOfLines={1}>
          {label}
        </Text>
      </Pressable>
    </View>
  );
}

export function SectionTitle({children}: {children: string}) {
  const {theme} = useTheme();
  const c = useListenColors(theme);
  return (
    <Text
      style={[styles.sectionTitle, styles.sectionGap, {color: c.secondary}]}>
      {children}
    </Text>
  );
}

export const FOOTER_SPACE = ms(110);

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: ms(16),
    paddingTop: ms(10),
    paddingBottom: ms(4),
  },
  headerSide: {width: ms(36)},
  headerButton: {
    width: ms(36),
    height: ms(36),
    borderRadius: ms(18),
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: ms(15),
    fontFamily: 'Manrope-Bold',
    marginHorizontal: ms(8),
  },
  hero: {alignItems: 'center', paddingTop: ms(6), paddingHorizontal: ms(20)},
  heroRow: {flexDirection: 'row', alignItems: 'center', gap: ms(14)},
  heroRing: {alignItems: 'center', justifyContent: 'center'},
  heroPhoto: {overflow: 'hidden'},
  heroText: {alignItems: 'center', marginTop: ms(10)},
  heroTextCompact: {flex: 1, alignItems: 'flex-start'},
  heroName: {
    fontSize: ms(22),
    fontFamily: 'Manrope-ExtraBold',
    letterSpacing: -0.4,
  },
  heroDetail: {
    fontSize: ms(13),
    fontFamily: 'Manrope-SemiBold',
    marginTop: ms(3),
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(7),
    height: ms(34),
    paddingHorizontal: ms(14),
    borderRadius: ms(17),
    marginTop: ms(10),
  },
  pillText: {fontSize: ms(13), fontFamily: 'Manrope-Bold'},
  sectionTitle: {
    fontSize: ms(13),
    fontFamily: 'Manrope-Bold',
    marginHorizontal: ms(4),
  },
  sectionGap: {marginBottom: ms(10)},
  tiles: {flexDirection: 'row', gap: ms(8)},
  tile: {
    flex: 1,
    height: ms(76),
    borderRadius: ms(20),
    alignItems: 'center',
    justifyContent: 'center',
    gap: ms(7),
    borderWidth: ms(3),
    borderColor: 'transparent',
  },
  tileCompact: {
    flex: 1,
    height: ms(52),
    borderRadius: ms(18),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: ms(8),
    borderWidth: ms(3),
    borderColor: 'transparent',
  },
  tileLabel: {fontSize: ms(13), fontFamily: 'Manrope-Bold'},
  rangeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(12),
    marginTop: ms(10),
    paddingVertical: ms(14),
    paddingHorizontal: ms(16),
    borderRadius: ms(22),
  },
  rangeMain: {flex: 1, minWidth: 0},
  rangeNumbers: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(10),
    marginTop: ms(2),
  },
  bigNumber: {
    fontSize: ms(28),
    fontFamily: 'Manrope-ExtraBold',
    letterSpacing: -0.8,
    fontVariant: ['tabular-nums'],
    flexShrink: 1,
  },
  rangeCount: {alignItems: 'flex-end'},
  countNumber: {
    fontSize: ms(15),
    fontFamily: 'Manrope-ExtraBold',
    fontVariant: ['tabular-nums'],
  },
  caption: {fontSize: ms(12), fontFamily: 'Manrope-Bold'},
  counter: {flex: 1, padding: ms(14), borderRadius: ms(22)},
  counterLabel: {fontSize: ms(13), fontFamily: 'Manrope-Bold'},
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: ms(8),
  },
  counterValue: {
    fontSize: ms(26),
    fontFamily: 'Manrope-ExtraBold',
    fontVariant: ['tabular-nums'],
  },
  roundButton: {
    width: ms(36),
    height: ms(36),
    borderRadius: ms(18),
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.12,
    shadowRadius: 3,
    shadowOffset: {width: 0, height: 1},
    elevation: 1,
  },
  speedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: ms(8),
  },
  speedValue: {
    fontSize: ms(15),
    fontFamily: 'Manrope-ExtraBold',
    marginRight: ms(4),
  },
  speedCard: {
    borderRadius: ms(22),
    paddingHorizontal: ms(16),
    paddingTop: ms(10),
    paddingBottom: ms(10),
  },
  ticks: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: ms(4),
  },
  tick: {fontSize: ms(11), fontFamily: 'Manrope-Bold', minWidth: ms(22)},
  tickOn: {fontFamily: 'Manrope-ExtraBold'},
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: ms(16),
    paddingTop: ms(28),
  },
  footerNote: {
    textAlign: 'center',
    fontSize: ms(12),
    fontFamily: 'Manrope-SemiBold',
    marginBottom: ms(8),
  },
  playButton: {
    height: ms(56),
    borderRadius: ms(28),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: ms(12),
    paddingHorizontal: ms(20),
    shadowOpacity: 0.25,
    shadowRadius: 14,
    shadowOffset: {width: 0, height: 10},
    elevation: 6,
  },
  playLabel: {
    fontSize: ms(16),
    fontFamily: 'Manrope-ExtraBold',
    flexShrink: 1,
  },
});
