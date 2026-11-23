// @ai-generated
// Bayaan Now at the top of Home: a large card for what fits this moment
// (morning adhkar, Al-Kahf on Friday, Al-Mulk at night…) and a smaller row
// under it for the next best thing. The same rules drive the Bayaan Now
// widget and CarPlay's "For right now".
import React, {useEffect} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Color from 'color';
import {useTranslation} from 'react-i18next';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale} from '@/utils/scale';
import {latinLetterSpacing} from '@/utils/rtl';
import {surahGlyphMap} from '@/utils/surahGlyphMap';
import {SurahGradientMesh} from '@/components/hero/SurahGradientMesh';
import {SurahCover, SurahMosaic} from '@/components/collection/CollectionArt';
import {
  PANEL_ART_GAP,
  PANEL_ART_RADIUS,
  PANEL_ART_SIZE,
  PANEL_ROW_PADDING,
  PANEL_ROW_VERTICAL,
  PanelRow,
} from '@/components/collection/CollectionPanel';
import {groupedCardColor} from '@/components/settings/SettingsList';
import type {NowMoment} from '@/services/bayaanNow/moments';
import {useBayaanNow} from '@/hooks/useBayaanNow';
import {
  GlassSurface,
  HOME_MARGIN,
  HomeSymbol,
  PressScale,
  secondaryText,
} from './homeKit';
import {useMomentView, type MomentArt, type MomentView} from './useMomentView';

const HERO_RADIUS = moderateScale(32);
const HERO_ART = moderateScale(88);
const PLAY_HEIGHT = moderateScale(50);
const BREATH_MS = 9000;

/** The mesh behind the hero drifts slowly, like light moving in a room. */
function BreathingMesh({view}: {view: MomentView}) {
  const {theme} = useTheme();
  const reduceMotion = useReducedMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) return;
    t.value = withRepeat(
      withTiming(1, {duration: BREATH_MS, easing: Easing.inOut(Easing.sin)}),
      -1,
      true,
    );
  }, [reduceMotion, t]);
  const drift = useAnimatedStyle(() => ({
    transform: [
      {scale: 1.08 + 0.1 * t.value},
      {translateX: -14 + 28 * t.value},
      {translateY: 8 - 16 * t.value},
    ],
  }));
  return (
    <Animated.View style={[StyleSheet.absoluteFill, drift]}>
      <SurahGradientMesh
        palette={view.palette}
        isDark={theme.isDarkMode}
        viewBoxWidth={360}
        viewBoxHeight={260}
        intensity={theme.isDarkMode ? 4.2 : 3.4}
      />
    </Animated.View>
  );
}

function Watermark({view}: {view: MomentView}) {
  const {theme} = useTheme();
  const color = Color(theme.colors.text)
    .alpha(theme.isDarkMode ? 0.07 : 0.06)
    .string();
  if ('glyphSurahId' in view.watermark) {
    return (
      <Text
        style={[styles.watermarkGlyph, {color}]}
        numberOfLines={1}
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden>
        {surahGlyphMap[view.watermark.glyphSurahId] ?? ''}
      </Text>
    );
  }
  return (
    <View
      style={styles.watermarkSymbol}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden>
      <HomeSymbol
        name={view.watermark.symbol}
        size={moderateScale(190)}
        color={color}
        weight="regular"
      />
    </View>
  );
}

function Art({
  art,
  size,
  radius,
  palette,
}: {
  art: MomentArt;
  size: number;
  radius: number;
  /** On a plain panel a symbol sits on its moment's colours, not glass. */
  palette?: MomentView['palette'];
}) {
  const {theme} = useTheme();
  switch (art.kind) {
    case 'surah':
      return <SurahCover surahId={art.surahId} size={size} radius={radius} />;
    case 'mosaic':
      return (
        <SurahMosaic surahIds={art.surahIds} size={size} radius={radius} />
      );
    case 'symbol':
      if (palette) {
        return (
          <View
            style={[
              styles.symbolTile,
              {
                width: size,
                height: size,
                borderRadius: radius,
                backgroundColor: Color(theme.colors.text).alpha(0.05).string(),
              },
            ]}>
            <SurahGradientMesh
              palette={palette}
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
      return (
        <GlassSurface
          style={{
            width: size,
            height: size,
            borderRadius: radius,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <HomeSymbol
            name={art.symbol}
            size={size * 0.46}
            color={theme.colors.text}
          />
        </GlassSurface>
      );
  }
}

function PlayGlyph({
  status,
  size,
  color,
}: {
  status: MomentView['status'];
  size: number;
  color: string;
}) {
  return (
    <HomeSymbol
      name={status === 'playing' ? 'pause' : 'play'}
      size={size}
      color={color}
      weight="bold"
    />
  );
}

function Hero({moment}: {moment: NowMoment}) {
  const {theme} = useTheme();
  const {t} = useTranslation('home');
  const view = useMomentView(moment);
  const secondary = secondaryText(theme.colors.text, theme.isDarkMode);
  const solid = theme.colors.text;
  const onSolid = theme.colors.background;

  return (
    <PressScale
      onPress={view.onOpen}
      scaleTo={0.985}
      accessibilityRole="button"
      accessibilityLabel={view.accessibilityLabel}
      accessibilityHint={t('now.openHint')}
      style={[
        styles.hero,
        {
          backgroundColor: groupedCardColor(theme),
          shadowColor: view.palette[0],
          shadowOpacity: theme.isDarkMode ? 0 : 0.18,
        },
      ]}>
      <View style={styles.heroClip}>
        <BreathingMesh view={view} />
        <Watermark view={view} />
        <View style={styles.heroBody}>
          <View style={styles.eyebrowRow}>
            <View
              style={[styles.liveDot, {backgroundColor: view.palette[0]}]}
            />
            <Text style={[styles.eyebrow, {color: theme.colors.text}]}>
              {t('now.label')}
            </Text>
            <GlassSurface style={styles.reasonPill}>
              <Text style={[styles.reasonText, {color: theme.colors.text}]}>
                {view.reason}
              </Text>
            </GlassSurface>
          </View>

          <View style={styles.heroMain}>
            <View style={styles.heroArt}>
              <Art art={view.art} size={HERO_ART} radius={moderateScale(22)} />
            </View>
            <View style={styles.heroText}>
              <Text
                style={[styles.heroTitle, {color: theme.colors.text}]}
                numberOfLines={2}
                adjustsFontSizeToFit
                minimumFontScale={0.8}>
                {view.title}
              </Text>
              <Text
                style={[styles.heroSubtitle, {color: secondary}]}
                numberOfLines={2}>
                {view.subtitle}
              </Text>
              {view.badge ? (
                <GlassSurface style={styles.badge}>
                  <HomeSymbol
                    name="timer"
                    size={moderateScale(12)}
                    color={theme.colors.text}
                  />
                  <Text style={[styles.badgeText, {color: theme.colors.text}]}>
                    {view.badge}
                  </Text>
                </GlassSurface>
              ) : null}
            </View>
          </View>

          <View style={styles.actions}>
            <PressScale
              onPress={view.onPlay}
              accessibilityRole="button"
              accessibilityLabel={`${view.playLabel} ${view.title}`}
              style={[styles.playPill, {backgroundColor: solid}]}>
              <PlayGlyph
                status={view.status}
                size={moderateScale(16)}
                color={onSolid}
              />
              <Text style={[styles.playText, {color: onSolid}]}>
                {view.playLabel}
              </Text>
            </PressScale>
            <PressScale
              onPress={view.onOpen}
              accessibilityRole="button"
              accessibilityLabel={t('now.open', {title: view.title})}>
              <GlassSurface interactive style={styles.openCircle}>
                <HomeSymbol
                  name="chevron"
                  size={moderateScale(17)}
                  color={theme.colors.text}
                  weight="bold"
                />
              </GlassSurface>
            </PressScale>
          </View>
        </View>
      </View>
    </PressScale>
  );
}

function sameWords(a: string, b: string): boolean {
  return a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase();
}

function SecondRow({moment}: {moment: NowMoment}) {
  const {theme} = useTheme();
  const view = useMomentView(moment);
  const secondary = secondaryText(theme.colors.text, theme.isDarkMode);
  return (
    <PanelRow first last>
      <PressScale
        onPress={view.onOpen}
        scaleTo={0.98}
        accessibilityRole="button"
        accessibilityLabel={view.accessibilityLabel}
        style={styles.row}>
        <View style={styles.rowArt}>
          <Art
            art={view.art}
            size={PANEL_ART_SIZE}
            radius={moderateScale(12)}
            palette={view.palette}
          />
        </View>
        <View style={styles.rowText}>
          {/* "Before sleep" over "Before Sleep" says it twice. */}
          {sameWords(view.reason, view.title) ? null : (
            <Text
              style={[
                styles.rowReason,
                {
                  // The pastel palettes need depth to read on a white panel.
                  color: theme.isDarkMode
                    ? view.palette[0]
                    : Color(view.palette[0]).darken(0.45).string(),
                },
              ]}
              numberOfLines={1}>
              {view.reason}
            </Text>
          )}
          <Text
            style={[styles.rowTitle, {color: theme.colors.text}]}
            numberOfLines={1}>
            {view.title}
          </Text>
          <Text
            style={[styles.rowSubtitle, {color: secondary}]}
            numberOfLines={1}>
            {view.subtitle}
          </Text>
        </View>
        <PressScale
          onPress={view.onPlay}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`${view.playLabel} ${view.title}`}
          style={[
            styles.rowPlay,
            {backgroundColor: Color(theme.colors.text).alpha(0.08).string()},
          ]}>
          <PlayGlyph
            status={view.status}
            size={moderateScale(13)}
            color={theme.colors.text}
          />
        </PressScale>
      </PressScale>
    </PanelRow>
  );
}

/** Bayaan Now: the hero for this moment and the row under it. */
export function BayaanNowCard() {
  const moments = useBayaanNow();
  const [main, second] = moments;
  if (!main) return null;
  return (
    <Animated.View layout={LinearTransition.duration(300)} style={styles.wrap}>
      {/* A new moment fades in over the old one. */}
      <Animated.View
        key={main.id}
        entering={FadeIn.duration(450)}
        exiting={FadeOut.duration(200)}>
        <Hero moment={main} />
      </Animated.View>
      {second ? (
        <Animated.View
          key={second.id}
          entering={FadeIn.duration(450).delay(80)}
          exiting={FadeOut.duration(200)}
          style={styles.second}>
          <SecondRow moment={second} />
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: moderateScale(4),
  },
  hero: {
    marginHorizontal: HOME_MARGIN,
    borderRadius: HERO_RADIUS,
    borderCurve: 'continuous',
    shadowRadius: moderateScale(24),
    shadowOffset: {width: 0, height: moderateScale(10)},
  },
  heroClip: {
    borderRadius: HERO_RADIUS,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  heroBody: {
    padding: moderateScale(18),
    paddingTop: moderateScale(16),
  },
  watermarkGlyph: {
    position: 'absolute',
    end: -moderateScale(24),
    top: moderateScale(18),
    fontFamily: 'SurahNames',
    fontSize: moderateScale(150),
    writingDirection: 'rtl',
  },
  watermarkSymbol: {
    position: 'absolute',
    end: -moderateScale(36),
    top: -moderateScale(20),
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: moderateScale(8),
  },
  liveDot: {
    width: moderateScale(7),
    height: moderateScale(7),
    borderRadius: moderateScale(4),
  },
  eyebrow: {
    fontFamily: 'Manrope-ExtraBold',
    fontSize: moderateScale(11.5),
    letterSpacing: latinLetterSpacing(1.3),
    textTransform: 'uppercase',
  },
  reasonPill: {
    borderRadius: moderateScale(999),
    paddingHorizontal: moderateScale(10),
    paddingVertical: moderateScale(3),
  },
  reasonText: {
    fontFamily: 'Manrope-Bold',
    fontSize: moderateScale(12),
  },
  heroMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: moderateScale(16),
    marginTop: moderateScale(18),
  },
  heroArt: {
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: moderateScale(12),
    shadowOffset: {width: 0, height: moderateScale(6)},
  },
  heroText: {
    flex: 1,
    minWidth: 0,
  },
  heroTitle: {
    fontFamily: 'Manrope-ExtraBold',
    fontSize: moderateScale(28),
    lineHeight: moderateScale(33),
    letterSpacing: latinLetterSpacing(-0.4),
    textAlign: 'left',
  },
  heroSubtitle: {
    marginTop: moderateScale(5),
    fontFamily: 'Manrope-Medium',
    fontSize: moderateScale(14),
    lineHeight: moderateScale(19),
    textAlign: 'left',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: moderateScale(10),
    marginTop: moderateScale(20),
  },
  symbolTile: {
    borderCurve: 'continuous',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: moderateScale(5),
    marginTop: moderateScale(9),
    paddingHorizontal: moderateScale(9),
    paddingVertical: moderateScale(4),
    borderRadius: moderateScale(999),
  },
  badgeText: {
    fontFamily: 'Manrope-Bold',
    fontSize: moderateScale(12),
  },
  playPill: {
    flex: 1,
    height: PLAY_HEIGHT,
    borderRadius: PLAY_HEIGHT / 2,
    borderCurve: 'continuous',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: moderateScale(8),
  },
  playText: {
    fontFamily: 'Manrope-Bold',
    fontSize: moderateScale(16),
  },
  openCircle: {
    width: PLAY_HEIGHT,
    height: PLAY_HEIGHT,
    borderRadius: PLAY_HEIGHT / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  second: {
    marginTop: moderateScale(10),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: PANEL_ROW_PADDING,
    paddingVertical: PANEL_ROW_VERTICAL + moderateScale(2),
    gap: PANEL_ART_GAP,
  },
  rowArt: {
    borderRadius: PANEL_ART_RADIUS,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  rowReason: {
    fontFamily: 'Manrope-Bold',
    fontSize: moderateScale(11.5),
    textAlign: 'left',
  },
  rowTitle: {
    fontFamily: 'Manrope-SemiBold',
    fontSize: moderateScale(15),
    textAlign: 'left',
  },
  rowSubtitle: {
    fontFamily: 'Manrope-Regular',
    fontSize: moderateScale(13),
    textAlign: 'left',
  },
  rowPlay: {
    width: moderateScale(36),
    height: moderateScale(36),
    borderRadius: moderateScale(18),
    alignItems: 'center',
    justifyContent: 'center',
  },
});
