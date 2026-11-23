// @ai-generated
// Small pieces the Home tab's sections share: an SF Symbol with an Android
// fallback, a glass surface, a round reciter photo, a section title and a
// pressable that gives under the finger.
import React, {useSyncExternalStore} from 'react';
import {
  I18nManager,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {Feather} from '@expo/vector-icons';
import {SymbolView, type SFSymbol} from 'expo-symbols';
import {GlassView} from 'expo-glass-effect';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import Color from 'color';
import {useTheme} from '@/hooks/useTheme';
import {
  USE_GLASS,
  useGlassColorScheme,
  useGlassTint,
} from '@/hooks/useGlassProps';
import {moderateScale} from '@/utils/scale';
import {latinLetterSpacing} from '@/utils/rtl';
import {ReciterImage} from '@/components/ReciterImage';
import {getRecitersVersion, type Reciter} from '@/data/reciterData';
import {useReciterStore} from '@/store/reciterStore';
import {groupedSeparatorColor} from '@/components/settings/SettingsList';

/**
 * Changes each time the reciter catalogue (a plain array that fills after
 * launch) is refilled, so lists read from it can be read again.
 */
export function useCatalogVersion(): number {
  return useSyncExternalStore(useReciterStore.subscribe, getRecitersVersion);
}

type FeatherName = React.ComponentProps<typeof Feather>['name'];

/** The symbols Home draws, with the Feather icon Android shows instead. */
export const HOME_SYMBOLS = {
  play: ['play.fill', 'play'],
  pause: ['pause.fill', 'pause'],
  chevron: ['chevron.forward', 'chevron-right'],
  sun: ['sun.max.fill', 'sun'],
  sunrise: ['sunrise.fill', 'sunrise'],
  sunset: ['sunset.fill', 'sunset'],
  moon: ['moon.stars.fill', 'moon'],
  sleep: ['moon.zzz.fill', 'moon'],
  book: ['book.closed.fill', 'book-open'],
  shuffle: ['shuffle', 'shuffle'],
  sparkles: ['sparkles', 'star'],
  playlist: ['music.note.list', 'list'],
  people: ['person.2.fill', 'users'],
  timer: ['timer', 'clock'],
  friday: ['building.columns.fill', 'sun'],
} as const satisfies Record<string, readonly [SFSymbol, FeatherName]>;

export type HomeSymbolName = keyof typeof HOME_SYMBOLS;

/** Feather icons that point along the reading direction. */
const MIRRORED: ReadonlySet<HomeSymbolName> = new Set(['chevron']);

export function HomeSymbol({
  name,
  size,
  color,
  weight = 'semibold',
}: {
  name: HomeSymbolName;
  size: number;
  color: string;
  weight?: 'regular' | 'medium' | 'semibold' | 'bold';
}) {
  const [symbol, fallback] = HOME_SYMBOLS[name];
  if (Platform.OS === 'ios') {
    return (
      <SymbolView name={symbol} size={size} tintColor={color} weight={weight} />
    );
  }
  return (
    <Feather
      name={fallback}
      size={size}
      color={color}
      style={
        I18nManager.isRTL && MIRRORED.has(name)
          ? {transform: [{scaleX: -1}]}
          : undefined
      }
    />
  );
}

/**
 * A surface of tinted glass on iOS 26, and a soft wash with a hairline
 * elsewhere, so a pill or a circle reads the same on every device.
 */
export function GlassSurface({
  style,
  children,
  interactive,
}: {
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  interactive?: boolean;
}) {
  const {theme} = useTheme();
  const scheme = useGlassColorScheme();
  const tint = useGlassTint();
  if (USE_GLASS) {
    return (
      <GlassView
        glassEffectStyle="regular"
        colorScheme={scheme}
        tintColor={tint}
        isInteractive={interactive}
        style={[styles.glassBase, style]}>
        {children}
      </GlassView>
    );
  }
  return (
    <View
      style={[
        styles.glassBase,
        {
          backgroundColor: theme.isDarkMode
            ? 'rgba(255,255,255,0.12)'
            : 'rgba(255,255,255,0.62)',
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: theme.isDarkMode
            ? 'rgba(255,255,255,0.16)'
            : 'rgba(0,0,0,0.08)',
        },
        style,
      ]}>
      {children}
    </View>
  );
}

/** A round reciter photo with a hairline, as on the Collection screens. */
export function ReciterAvatar({
  reciter,
  size,
  ring,
}: {
  reciter: Reciter;
  size: number;
  /** A ring in this colour instead of the hairline, for stacked faces. */
  ring?: string;
}) {
  const {theme} = useTheme();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: 'hidden',
        borderWidth: ring ? 2 : StyleSheet.hairlineWidth,
        borderColor: ring ?? groupedSeparatorColor(theme),
        backgroundColor: Color(theme.colors.text).alpha(0.06).string(),
      }}>
      <ReciterImage
        imageUrl={reciter.image_url ?? undefined}
        reciterName={reciter.name}
        style={styles.fill}
        profileIconSize={size * 0.4}
      />
    </View>
  );
}

/** Up to three overlapping reciter photos. */
export function ReciterFaces({
  reciters,
  size,
  ring,
}: {
  reciters: Reciter[];
  size: number;
  ring: string;
}) {
  return (
    <View style={styles.row}>
      {reciters.slice(0, 3).map((reciter, i) => (
        <View
          key={reciter.id}
          style={{marginStart: i === 0 ? 0 : -size * 0.32, zIndex: 3 - i}}>
          <ReciterAvatar reciter={reciter} size={size} ring={ring} />
        </View>
      ))}
    </View>
  );
}

/** Haptics are a nicety: a device without them just stays still. */
export function ignoreHaptics(): void {
  // Nothing to do.
}

const PRESS_SPRING = {damping: 18, stiffness: 420, mass: 0.5};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** A Pressable that settles in a little while it is held. */
export function PressScale({
  style,
  children,
  scaleTo = 0.97,
  ...rest
}: Omit<PressableProps, 'style' | 'children'> & {
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
  scaleTo?: number;
}) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({
    transform: [{scale: scale.value}],
  }));
  return (
    <AnimatedPressable
      {...rest}
      style={[style, animated]}
      onPressIn={e => {
        scale.value = withSpring(scaleTo, PRESS_SPRING);
        rest.onPressIn?.(e);
      }}
      onPressOut={e => {
        scale.value = withSpring(1, PRESS_SPRING);
        rest.onPressOut?.(e);
      }}>
      {children}
    </AnimatedPressable>
  );
}

/** Space above a section title, and from the title to its content. */
export const SECTION_TOP = moderateScale(30);
export const SECTION_TITLE_GAP = moderateScale(12);
export const HOME_MARGIN = moderateScale(16);

/** A section's title, with an optional action at its end. */
export function HomeSectionTitle({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  const {theme} = useTheme();
  return (
    <View style={styles.sectionHeader}>
      <Text
        accessibilityRole="header"
        style={[styles.sectionTitle, {color: theme.colors.text}]}
        numberOfLines={1}>
        {title}
      </Text>
      {action && onAction ? (
        <Pressable
          onPress={onAction}
          hitSlop={10}
          accessibilityRole="button"
          style={styles.action}>
          <Text
            style={[
              styles.actionText,
              {color: Color(theme.colors.text).alpha(0.5).string()},
            ]}>
            {action}
          </Text>
          <HomeSymbol
            name="chevron"
            size={moderateScale(11)}
            color={Color(theme.colors.text).alpha(0.4).string()}
            weight="bold"
          />
        </Pressable>
      ) : null}
    </View>
  );
}

/** Secondary text colour on a panel. */
export function secondaryText(text: string, dark: boolean): string {
  return Color(text)
    .alpha(dark ? 0.6 : 0.55)
    .string();
}

const styles = StyleSheet.create({
  glassBase: {
    overflow: 'hidden',
    borderCurve: 'continuous',
  },
  fill: {
    width: '100%',
    height: '100%',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: moderateScale(20),
    marginTop: SECTION_TOP,
    marginBottom: SECTION_TITLE_GAP,
    gap: moderateScale(12),
  },
  sectionTitle: {
    flexShrink: 1,
    fontFamily: 'Manrope-Bold',
    fontSize: moderateScale(21),
    letterSpacing: latinLetterSpacing(-0.2),
    textAlign: 'left',
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: moderateScale(3),
  },
  actionText: {
    fontFamily: 'Manrope-SemiBold',
    fontSize: moderateScale(14),
  },
});
