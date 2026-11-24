// @ai-generated
// Bayaan Now at the top of Home, as a cover: the scene for this moment runs
// edge to edge under the clock, with its label, title and one Play pill on
// the picture. The second moment sits under it as a plain row on the page.
// Each time of day, day of the week and special date has its own scene
// (services/bayaanNow/scenes); the backend can name one or send an image
// and words of its own (services/bayaanNow/occasion). The same rules drive
// the widget and CarPlay.
import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {LinearGradient} from 'expo-linear-gradient';
import {Image} from 'expo-image';
import Animated, {FadeIn, FadeOut} from 'react-native-reanimated';
import {useTranslation} from 'react-i18next';
import {StatusBar} from 'expo-status-bar';
import {useIsFocused} from 'expo-router';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale} from '@/utils/scale';
import {latinLetterSpacing} from '@/utils/rtl';
import {
  PANEL_RADIUS,
  PANEL_ROW_PADDING,
  usePanelColor,
} from '@/components/collection/CollectionPanel';
import type {NowMoment} from '@/services/bayaanNow/moments';
import type {NowLook} from '@/services/bayaanNow/look';
import {fromHijri} from '@/services/bayaanNow/calendar';
import {useBayaanNow, setBayaanNowPreviewTime} from '@/hooks/useBayaanNow';
import {HOME_MARGIN, HomeSymbol, PressScale, secondaryText} from './homeKit';
import {useMomentView, type MomentView} from './useMomentView';
import {SCENE_IMAGES} from './sceneImages';

/** The cover's height below the top of the screen's content. */
export const HERO_HEIGHT = moderateScale(380);
const PILL = moderateScale(44);
/** Behind a backend image while it loads. */
const IMAGE_FALLBACK = '#1f2937';

/** Times the developer preview steps through, to see each scene and its words. */
function previewTimes(): Date[] {
  const on = (y: number, m: number, d: number, h: number) =>
    new Date(y, m - 1, d, h, 30);
  const hijri = (y: number, m: number, d: number, h: number) => {
    const date = fromHijri(y, m, d);
    date.setHours(h, 30);
    return date;
  };
  return [
    on(2026, 12, 4, 9), // Friday: Al-Kahf
    on(2026, 12, 4, 16), // the last hour of Friday
    on(2026, 12, 2, 3), // the last third of the night
    on(2026, 12, 2, 5), // before sunrise
    on(2026, 12, 2, 9), // mid-morning
    on(2026, 12, 2, 13), // the afternoon
    on(2026, 12, 2, 17), // as the sun sets
    on(2026, 12, 2, 22), // before sleep
    on(2026, 12, 7, 12), // a Monday's fast
    hijri(1448, 7, 13, 21), // the white days
    hijri(1448, 9, 12, 21), // a night of Ramadan
    hijri(1448, 9, 26, 22), // Laylat al-Qadr
    hijri(1448, 10, 1, 9), // Eid al-Fitr
    hijri(1448, 12, 4, 13), // the ten days of Dhul Hijjah
    hijri(1448, 12, 9, 10), // the Day of Arafah
    hijri(1448, 12, 10, 9), // Eid al-Adha
    hijri(1449, 1, 1, 10), // the Hijri new year
    hijri(1449, 1, 10, 13), // Ashura
  ];
}

let previewIndex = -1;

/** Developer preview: each long press shows the next time, then now again. */
function previewNextTime() {
  const times = previewTimes();
  previewIndex += 1;
  if (previewIndex >= times.length) {
    previewIndex = -1;
    setBayaanNowPreviewTime(null);
    return;
  }
  setBayaanNowPreviewTime(times[previewIndex]);
}

function Scene({look}: {look: NowLook}) {
  if (look.kind === 'scene') {
    return (
      <Image
        source={SCENE_IMAGES[look.scene]}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        transition={300}
        accessibilityIgnoresInvertColors
      />
    );
  }
  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        {backgroundColor: look.tint ?? IMAGE_FALLBACK},
      ]}>
      <Image
        source={{uri: look.uri}}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        transition={300}
        accessibilityIgnoresInvertColors
      />
    </View>
  );
}

function Cover({view, topInset}: {view: MomentView; topInset: number}) {
  const {t} = useTranslation('home');
  // The backend can lighten or deepen the wash under the words.
  const scrim = view.look.kind === 'image' ? (view.look.scrim ?? 1) : 1;
  const long = view.title.length > 18;
  const subtitle = view.badge
    ? `${view.subtitle} · ${view.badge}`
    : view.subtitle;
  return (
    <PressScale
      onPress={view.onOpen}
      onLongPress={__DEV__ ? previewNextTime : undefined}
      scaleTo={1}
      accessibilityRole="button"
      accessibilityLabel={view.accessibilityLabel}
      accessibilityHint={t('now.openHint')}
      style={[
        styles.cover,
        {height: HERO_HEIGHT + topInset, marginTop: -topInset},
      ]}>
      <Scene look={view.look} />
      {/* The clock reads on any picture, and the words at the bottom do too. */}
      <LinearGradient
        colors={[`rgba(0,0,0,${0.34 * scrim})`, 'rgba(0,0,0,0)']}
        style={[styles.topScrim, {height: topInset + moderateScale(64)}]}
        pointerEvents="none"
      />
      <LinearGradient
        colors={[
          'rgba(0,0,0,0)',
          `rgba(0,0,0,${0.3 * scrim})`,
          `rgba(0,0,0,${0.7 * scrim})`,
        ]}
        locations={[0, 0.45, 1]}
        style={styles.bottomScrim}
        pointerEvents="none"
      />
      <View style={styles.words}>
        <Text style={styles.label} numberOfLines={1}>
          {view.reason}
        </Text>
        <Text
          style={[styles.title, long && styles.titleLong]}
          numberOfLines={2}
          adjustsFontSizeToFit
          minimumFontScale={0.8}>
          {view.title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
        <PressScale
          onPress={view.onPlay}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`${view.playLabel} ${view.title}`}
          style={styles.pill}>
          {/* Media symbols keep their direction in Arabic. */}
          <HomeSymbol
            name={view.status === 'playing' ? 'pause' : 'play'}
            size={moderateScale(14)}
            color="#111111"
            weight="bold"
          />
          <Text style={styles.pillText} numberOfLines={1}>
            {view.playLabel}
          </Text>
        </PressScale>
      </View>
    </PressScale>
  );
}

function NextRow({view, mainLabel}: {view: MomentView; mainLabel: string}) {
  const {theme} = useTheme();
  const {t} = useTranslation('home');
  const panel = usePanelColor();
  const muted = secondaryText(theme.colors.text, theme.isDarkMode);
  // Two moments for the same reason read better as "Then".
  const label = view.reason === mainLabel ? t('now.then') : view.reason;
  return (
    <PressScale
      onPress={view.onOpen}
      scaleTo={0.98}
      accessibilityRole="button"
      accessibilityLabel={view.accessibilityLabel}
      accessibilityHint={t('now.openHint')}
      style={[styles.next, {backgroundColor: panel}]}>
      <Text style={[styles.nextLabel, {color: muted}]} numberOfLines={1}>
        {label}
      </Text>
      <Text
        style={[styles.nextTitle, {color: theme.colors.text}]}
        numberOfLines={1}>
        {view.title}
      </Text>
      <HomeSymbol name="chevron" size={moderateScale(12)} color={muted} />
    </PressScale>
  );
}

function Moments({
  main,
  second,
  now,
  topInset,
}: {
  main: NowMoment;
  second: NowMoment | undefined;
  now: Date;
  topInset: number;
}) {
  const view = useMomentView(main, now);
  return (
    <>
      <Animated.View
        key={`${main.id}|${view.reason}`}
        entering={FadeIn.duration(450)}
        exiting={FadeOut.duration(200)}>
        <Cover view={view} topInset={topInset} />
      </Animated.View>
      {second ? (
        <Animated.View
          key={second.id}
          entering={FadeIn.duration(450).delay(80)}
          exiting={FadeOut.duration(200)}>
          <SecondMoment moment={second} now={now} mainLabel={view.reason} />
        </Animated.View>
      ) : null}
    </>
  );
}

function SecondMoment({
  moment,
  now,
  mainLabel,
}: {
  moment: NowMoment;
  now: Date;
  mainLabel: string;
}) {
  const view = useMomentView(moment, now);
  return <NextRow view={view} mainLabel={mainLabel} />;
}

/**
 * Bayaan Now: the cover for this moment and the second moment under it.
 * topInset is how far above Home's content the cover reaches (the clock).
 */
export function BayaanNowCard({
  topInset,
  lightClock,
}: {
  topInset: number;
  /** The cover is under the clock, so the clock should be white. */
  lightClock: boolean;
}) {
  const {moments, now} = useBayaanNow();
  const focused = useIsFocused();
  const [main, second] = moments;
  const fallbackInset = useSafeAreaInsets().top;
  const inset = topInset || fallbackInset;
  if (!main) return null;
  return (
    <View style={styles.wrap}>
      {focused && lightClock ? <StatusBar style="light" /> : null}
      <Moments main={main} second={second} now={now} topInset={inset} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: moderateScale(12),
  },
  cover: {
    overflow: 'hidden',
    backgroundColor: IMAGE_FALLBACK,
  },
  topScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  bottomScrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '58%',
  },
  words: {
    position: 'absolute',
    start: moderateScale(20),
    end: moderateScale(20),
    bottom: moderateScale(20),
    alignItems: 'flex-start',
  },
  label: {
    fontFamily: 'Manrope-ExtraBold',
    fontSize: moderateScale(11.5),
    letterSpacing: latinLetterSpacing(1.2),
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.86)',
    textAlign: 'left',
  },
  title: {
    marginTop: moderateScale(6),
    fontFamily: 'Manrope-ExtraBold',
    fontSize: moderateScale(36),
    lineHeight: moderateScale(40),
    letterSpacing: latinLetterSpacing(-0.8),
    color: '#ffffff',
    textAlign: 'left',
    textShadowColor: 'rgba(0,0,0,0.25)',
    textShadowRadius: 12,
    textShadowOffset: {width: 0, height: 1},
  },
  titleLong: {
    fontSize: moderateScale(30),
    lineHeight: moderateScale(35),
  },
  subtitle: {
    marginTop: moderateScale(4),
    fontFamily: 'Manrope-Medium',
    fontSize: moderateScale(14),
    color: 'rgba(255,255,255,0.88)',
    textAlign: 'left',
  },
  pill: {
    marginTop: moderateScale(14),
    height: PILL,
    borderRadius: PILL / 2,
    borderCurve: 'continuous',
    paddingStart: moderateScale(16),
    paddingEnd: moderateScale(20),
    flexDirection: 'row',
    alignItems: 'center',
    gap: moderateScale(8),
    backgroundColor: '#ffffff',
  },
  pillText: {
    fontFamily: 'Manrope-ExtraBold',
    fontSize: moderateScale(15),
    color: '#111111',
  },
  next: {
    marginHorizontal: HOME_MARGIN,
    borderRadius: PANEL_RADIUS,
    borderCurve: 'continuous',
    paddingHorizontal: PANEL_ROW_PADDING,
    paddingVertical: moderateScale(14),
    flexDirection: 'row',
    alignItems: 'center',
    gap: moderateScale(8),
  },
  nextLabel: {
    fontFamily: 'Manrope-SemiBold',
    fontSize: moderateScale(14),
    textAlign: 'left',
  },
  nextTitle: {
    flex: 1,
    minWidth: 0,
    fontFamily: 'Manrope-Bold',
    fontSize: moderateScale(15),
    textAlign: 'left',
  },
});
