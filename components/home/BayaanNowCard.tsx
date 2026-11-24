// @ai-generated
// Bayaan Now at the top of Home: the sky for this moment runs under the
// clock and melts into the page, with the main moment set large on it and
// the second moment floating where the sky meets the page. The backend can
// give either moment its own image and words (services/bayaanNow/occasion);
// otherwise the time of day picks a preset sky, with the sun or moon on an
// arc that follows the hour. The same rules drive the widget and CarPlay.
import React, {useEffect, useState} from 'react';
import {I18nManager, StyleSheet, Text, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {LinearGradient} from 'expo-linear-gradient';
import {Image} from 'expo-image';
import Svg, {Circle, Defs, Path, RadialGradient, Stop} from 'react-native-svg';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Color from 'color';
import {useTranslation} from 'react-i18next';
import {StatusBar} from 'expo-status-bar';
import {useIsFocused} from 'expo-router';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale} from '@/utils/scale';
import {latinLetterSpacing} from '@/utils/rtl';
import {SurahGradientMesh} from '@/components/hero/SurahGradientMesh';
import {SurahCover, SurahMosaic} from '@/components/collection/CollectionArt';
import type {NowMoment} from '@/services/bayaanNow/moments';
import {
  SKY_PRESETS,
  SKY_PRESET_IDS,
  bodyPosition,
  type NowLook,
  type SkyPreset,
} from '@/services/bayaanNow/look';
import {useBayaanNow} from '@/hooks/useBayaanNow';
import {setBayaanNowOccasion} from '@/hooks/useBayaanNowOccasion';
import {HOME_MARGIN, HomeSymbol, PressScale, secondaryText} from './homeKit';
import {useMomentView, type MomentArt, type MomentView} from './useMomentView';

/** The sky's height below the top of the screen's content. */
export const SKY_HEIGHT = moderateScale(272);
/** How far the second card reaches up into the sky. */
const SECOND_OVERLAP = moderateScale(96);
const SECOND_HEIGHT = moderateScale(64);
const PLAY = moderateScale(56);
const SECOND_PLAY = moderateScale(36);
/** Room above the sky for a pull-down, so no page shows above it. */
const OVERSCROLL = 600;
const GLOW_MS = 6000;

/** Fixed star positions (as % of the sky), so a sky looks the same each time. */
const STARS: readonly [number, number][] = [
  [8, 12],
  [19, 30],
  [27, 8],
  [36, 22],
  [44, 40],
  [52, 14],
  [61, 34],
  [70, 9],
  [77, 26],
  [86, 16],
  [93, 36],
  [14, 46],
  [32, 52],
  [57, 50],
  [81, 48],
  [4, 30],
  [66, 44],
  [97, 8],
  [41, 6],
  [24, 38],
];

const IMAGE_FALLBACK = '#1f2937';

function lookColors(look: NowLook): {sky: SkyPreset | null; base: string} {
  if (look.kind === 'sky') {
    const sky = SKY_PRESETS[look.preset];
    return {sky, base: sky.colors[0]};
  }
  return {sky: null, base: look.tint ?? IMAGE_FALLBACK};
}

function Stars({count}: {count: number}) {
  return (
    <>
      {STARS.slice(0, count).map(([x, y], i) => {
        const size = i % 3 === 0 ? 3 : 2;
        return (
          <View
            key={i}
            style={{
              position: 'absolute',
              left: `${x}%`,
              top: `${y}%`,
              width: size,
              height: size,
              borderRadius: size,
              backgroundColor: '#ffffff',
              opacity: 0.35 + (i % 4) * 0.15,
            }}
          />
        );
      })}
    </>
  );
}

/** The dotted path the sun or moon travels, matching bodyPosition. */
function Arc() {
  return (
    <Svg
      style={StyleSheet.absoluteFill}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      pointerEvents="none">
      <Path
        d="M0 46 Q50 -14 100 46"
        fill="none"
        stroke="rgba(255,255,255,0.3)"
        strokeWidth={0.35}
        strokeDasharray="1.2 1.8"
      />
    </Svg>
  );
}

const SUN = moderateScale(64);
const MOON = moderateScale(30);

function Body({sky, now, width}: {sky: SkyPreset; now: Date; width: number}) {
  const reduceMotion = useReducedMotion();
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) return;
    pulse.value = withRepeat(
      withTiming(1, {duration: GLOW_MS, easing: Easing.inOut(Easing.sin)}),
      -1,
      true,
    );
  }, [pulse, reduceMotion]);
  const breathe = useAnimatedStyle(() => ({
    transform: [{scale: 1 + 0.08 * pulse.value}],
    opacity: 0.85 + 0.15 * pulse.value,
  }));
  if (sky.body === 'none') return null;
  const {x, y} = bodyPosition(sky.body, now);
  // In Arabic the day runs the other way across the sky, so the sun or
  // moon stays clear of the title, which starts on the right.
  const left = (I18nManager.isRTL ? 1 - x : x) * width;
  const top = y * SKY_HEIGHT;
  if (sky.body === 'sun') {
    return (
      <Animated.View
        pointerEvents="none"
        style={[
          styles.body,
          {left: left - SUN / 2, top: top - SUN / 2, width: SUN, height: SUN},
          breathe,
        ]}>
        <Svg width={SUN} height={SUN}>
          <Defs>
            <RadialGradient id="sun" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor="#fffbe8" stopOpacity={1} />
              <Stop offset="0.32" stopColor={sky.glow} stopOpacity={1} />
              <Stop offset="0.55" stopColor={sky.glow} stopOpacity={0.35} />
              <Stop offset="1" stopColor={sky.glow} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={SUN / 2} cy={SUN / 2} r={SUN / 2} fill="url(#sun)" />
        </Svg>
      </Animated.View>
    );
  }
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.body,
        styles.moon,
        {
          left: left - MOON / 2,
          top: top - MOON / 2,
          shadowColor: sky.glow,
        },
        breathe,
      ]}>
      <HomeSymbol name="crescent" size={MOON} color="#f8fafc" />
    </Animated.View>
  );
}

/** The sky (or the backend's image) behind the main moment. */
function SkyBackdrop({
  look,
  now,
  width,
  height,
}: {
  look: NowLook;
  now: Date;
  width: number;
  height: number;
}) {
  const {theme} = useTheme();
  const {sky, base} = lookColors(look);
  const page = theme.colors.background;
  return (
    <View style={[StyleSheet.absoluteFill, {backgroundColor: base}]}>
      {/* Above the sky, for a pull-down. */}
      <View
        style={[styles.overscroll, {backgroundColor: base, height: OVERSCROLL}]}
      />
      {sky ? (
        <>
          <LinearGradient
            colors={sky.colors}
            locations={sky.locations}
            style={StyleSheet.absoluteFill}
          />
          <View style={[styles.starField, {height: height * 0.55}]}>
            <Stars count={sky.stars} />
          </View>
          <View
            style={{position: 'absolute', top: 0, width, height: SKY_HEIGHT}}>
            <Arc />
          </View>
          <Body sky={sky} now={now} width={width} />
        </>
      ) : look.kind === 'image' ? (
        <>
          <Image
            source={{uri: look.uri}}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={300}
            accessibilityIgnoresInvertColors
          />
          {/* A dark wash so white words read on any photo. */}
          <LinearGradient
            colors={[
              `rgba(0,0,0,${0.35 * (look.scrim ?? 1)})`,
              `rgba(0,0,0,${0.1 * (look.scrim ?? 1)})`,
              `rgba(0,0,0,${0.5 * (look.scrim ?? 1)})`,
            ]}
            locations={[0, 0.35, 0.72]}
            style={StyleSheet.absoluteFill}
          />
        </>
      ) : null}
      {/* The sky melts into the page. */}
      <LinearGradient
        colors={[Color(page).alpha(0).string(), page]}
        style={styles.melt}
      />
    </View>
  );
}

let previewIndex = -1;

/**
 * Development builds only: a long press on the sky steps through the
 * presets, as a backend occasion would set them, then back to the rules.
 */
function previewNextPreset(): void {
  previewIndex += 1;
  if (previewIndex >= SKY_PRESET_IDS.length) {
    previewIndex = -1;
    setBayaanNowOccasion(null);
    return;
  }
  const preset = SKY_PRESET_IDS[previewIndex];
  setBayaanNowOccasion({
    id: `preview:${preset}`,
    startsAt: new Date(0).toISOString(),
    endsAt: new Date(Date.now() + 86_400_000).toISOString(),
    slots: [{look: {kind: 'sky', preset}, content: {label: preset}}],
  });
}

function Main({
  view,
  now,
  topInset,
}: {
  view: MomentView;
  now: Date;
  topInset: number;
}) {
  const {t} = useTranslation('home');
  const [width, setWidth] = useState(0);
  const height = SKY_HEIGHT + topInset;
  const {base} = lookColors(view.look);
  const long = view.title.length > 14;
  return (
    <PressScale
      onPress={view.onOpen}
      onLongPress={__DEV__ ? previewNextPreset : undefined}
      scaleTo={0.995}
      accessibilityRole="button"
      accessibilityLabel={view.accessibilityLabel}
      accessibilityHint={t('now.openHint')}
      onLayout={e => setWidth(e.nativeEvent.layout.width)}
      style={[styles.sky, {height, marginTop: -topInset}]}>
      <SkyBackdrop look={view.look} now={now} width={width} height={height} />
      <View style={[styles.eyebrowWrap, {top: topInset + moderateScale(14)}]}>
        <Text style={styles.eyebrow} numberOfLines={1}>
          {`${t('now.label')} · ${view.reason}`}
        </Text>
      </View>
      <View style={styles.mainRow}>
        <View style={styles.mainText}>
          <Text
            style={[styles.title, long && styles.titleLong]}
            numberOfLines={long ? 2 : 1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}>
            {view.title}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {view.badge ? `${view.subtitle} · ${view.badge}` : view.subtitle}
          </Text>
        </View>
        <PressScale
          onPress={view.onPlay}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`${view.playLabel} ${view.title}`}
          style={styles.play}>
          <HomeSymbol
            name={view.status === 'playing' ? 'pause' : 'play'}
            size={moderateScale(22)}
            color={base}
            weight="bold"
          />
        </PressScale>
      </View>
    </PressScale>
  );
}

function SecondArt({view}: {view: MomentView}) {
  const {theme} = useTheme();
  const size = moderateScale(44);
  const radius = moderateScale(12);
  if (view.look.kind === 'image' && view.art.kind !== 'surah') {
    return (
      <Image
        source={{uri: view.look.uri}}
        style={{width: size, height: size, borderRadius: radius}}
        contentFit="cover"
        accessibilityIgnoresInvertColors
      />
    );
  }
  const art: MomentArt = view.art;
  switch (art.kind) {
    case 'surah':
      return <SurahCover surahId={art.surahId} size={size} radius={radius} />;
    case 'mosaic':
      return (
        <SurahMosaic surahIds={art.surahIds} size={size} radius={radius} />
      );
    case 'symbol':
      return (
        <View
          style={[
            styles.symbolTile,
            {width: size, height: size, borderRadius: radius},
          ]}>
          <SurahGradientMesh
            palette={view.palette}
            isDark={theme.isDarkMode}
            viewBoxWidth={120}
            viewBoxHeight={120}
            intensity={theme.isDarkMode ? 3.2 : 4.5}
          />
          <HomeSymbol
            name={art.symbol}
            size={size * 0.46}
            color={theme.colors.text}
          />
        </View>
      );
  }
}

function Second({view}: {view: MomentView}) {
  const {theme} = useTheme();
  const secondary = secondaryText(theme.colors.text, theme.isDarkMode);
  // Solid, so the end of the sky doesn't show through it.
  const surface = theme.isDarkMode
    ? Color(theme.colors.background).mix(Color('#ffffff'), 0.08).string()
    : '#ffffff';
  return (
    <PressScale
      onPress={view.onOpen}
      scaleTo={0.98}
      accessibilityRole="button"
      accessibilityLabel={view.accessibilityLabel}
      style={[styles.second, {backgroundColor: surface}]}>
      <SecondArt view={view} />
      <View style={styles.secondText}>
        <Text
          style={[styles.secondLabel, {color: secondary}]}
          numberOfLines={1}>
          {view.reason}
        </Text>
        <Text
          style={[styles.secondTitle, {color: theme.colors.text}]}
          numberOfLines={1}>
          {view.title}
        </Text>
      </View>
      <PressScale
        onPress={view.onPlay}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={`${view.playLabel} ${view.title}`}
        style={[styles.secondPlay, {backgroundColor: theme.colors.text}]}>
        <HomeSymbol
          name={view.status === 'playing' ? 'pause' : 'play'}
          size={moderateScale(14)}
          color={theme.colors.background}
          weight="bold"
        />
      </PressScale>
    </PressScale>
  );
}

function MainMoment({
  moment,
  now,
  topInset,
}: {
  moment: NowMoment;
  now: Date;
  topInset: number;
}) {
  const view = useMomentView(moment, now);
  return <Main view={view} now={now} topInset={topInset} />;
}

function SecondMoment({moment, now}: {moment: NowMoment; now: Date}) {
  const view = useMomentView(moment, now);
  return <Second view={view} />;
}

/**
 * Bayaan Now: the sky for this moment and the second moment under it.
 * topInset is how far above Home's content the sky reaches (the clock).
 */
export function BayaanNowCard({
  topInset,
  lightClock,
}: {
  topInset: number;
  /** The sky is under the clock, so the clock should be white. */
  lightClock: boolean;
}) {
  const {moments, now} = useBayaanNow();
  const focused = useIsFocused();
  const [main, second] = moments;
  const fallbackInset = useSafeAreaInsets().top;
  const inset = topInset || fallbackInset;
  if (!main) return null;
  return (
    <View>
      {focused && lightClock ? <StatusBar style="light" /> : null}
      <Animated.View
        key={main.id}
        entering={FadeIn.duration(450)}
        exiting={FadeOut.duration(200)}>
        <MainMoment moment={main} now={now} topInset={inset} />
      </Animated.View>
      {second ? (
        <Animated.View
          key={second.id}
          entering={FadeIn.duration(450).delay(80)}
          exiting={FadeOut.duration(200)}
          style={styles.secondWrap}>
          <SecondMoment moment={second} now={now} />
        </Animated.View>
      ) : (
        <View style={styles.noSecond} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sky: {
    overflow: 'visible',
  },
  overscroll: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: '100%',
  },
  starField: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  body: {
    position: 'absolute',
  },
  moon: {
    shadowOpacity: 0.6,
    shadowRadius: moderateScale(12),
    shadowOffset: {width: 0, height: 0},
  },
  melt: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '34%',
  },
  eyebrowWrap: {
    position: 'absolute',
    start: moderateScale(20),
    end: moderateScale(20),
  },
  eyebrow: {
    fontFamily: 'Manrope-ExtraBold',
    fontSize: moderateScale(11.5),
    letterSpacing: latinLetterSpacing(1.1),
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.78)',
    textAlign: 'left',
  },
  mainRow: {
    position: 'absolute',
    start: moderateScale(20),
    end: moderateScale(20),
    bottom: SECOND_OVERLAP + moderateScale(24),
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: moderateScale(14),
  },
  mainText: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontFamily: 'Manrope-ExtraBold',
    fontSize: moderateScale(40),
    lineHeight: moderateScale(44),
    letterSpacing: latinLetterSpacing(-1),
    color: '#ffffff',
    textAlign: 'left',
    textShadowColor: 'rgba(0,0,0,0.25)',
    textShadowRadius: 14,
    textShadowOffset: {width: 0, height: 2},
  },
  titleLong: {
    fontSize: moderateScale(32),
    lineHeight: moderateScale(36),
  },
  subtitle: {
    marginTop: moderateScale(6),
    fontFamily: 'Manrope-Medium',
    fontSize: moderateScale(14),
    color: 'rgba(255,255,255,0.88)',
    textAlign: 'left',
  },
  play: {
    width: PLAY,
    height: PLAY,
    borderRadius: PLAY / 2,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: moderateScale(12),
    shadowOffset: {width: 0, height: moderateScale(6)},
  },
  secondWrap: {
    marginTop: -SECOND_OVERLAP,
  },
  noSecond: {
    marginTop: -SECOND_OVERLAP + moderateScale(16),
  },
  second: {
    marginHorizontal: HOME_MARGIN,
    height: SECOND_HEIGHT,
    borderRadius: moderateScale(22),
    borderCurve: 'continuous',
    flexDirection: 'row',
    alignItems: 'center',
    gap: moderateScale(12),
    paddingHorizontal: moderateScale(10),
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: moderateScale(18),
    shadowOffset: {width: 0, height: moderateScale(8)},
  },
  secondText: {
    flex: 1,
    minWidth: 0,
  },
  secondLabel: {
    fontFamily: 'Manrope-ExtraBold',
    fontSize: moderateScale(11),
    letterSpacing: latinLetterSpacing(0.7),
    textTransform: 'uppercase',
    textAlign: 'left',
  },
  secondTitle: {
    fontFamily: 'Manrope-Bold',
    fontSize: moderateScale(15),
    textAlign: 'left',
  },
  secondPlay: {
    width: SECOND_PLAY,
    height: SECOND_PLAY,
    borderRadius: SECOND_PLAY / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  symbolTile: {
    borderCurve: 'continuous',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
