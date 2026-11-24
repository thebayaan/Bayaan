// @ai-generated
// Your reciters (favourites, then a way to every reciter), Find something
// new (every reciter, or a surprise), and the Reciter of the day.
import React, {useCallback, useMemo} from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';
import {useRouter} from 'expo-router';
import {useTranslation} from 'react-i18next';
import * as Haptics from 'expo-haptics';
import Color from 'color';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale} from '@/utils/scale';
import {RECITERS, type Reciter} from '@/data/reciterData';
import {
  getFeaturedReciters,
  getSpotlightReciters,
} from '@/data/reciterCollections';
import {SURAHS} from '@/data/surahData';
import {
  getReciterDisplayName,
  getSurahDisplayName,
  localizeDigits,
} from '@/i18n/format';
import {useFavoriteReciters} from '@/hooks/useFavoriteReciters';
import {usePlayerActions} from '@/hooks/usePlayerActions';
import {useRecentlyPlayedStore} from '@/services/player/store/recentlyPlayedStore';
import {pickRandomRecitations} from '@/utils/randomRecitation';
import {createTracksForReciter} from '@/utils/track';
import {showToast} from '@/utils/toastUtils';
import {ayahOfTheDayIndex} from '@/modules/bayaan-widgets/src/dayMath';
import {
  availableSurahIds,
  findRewayat,
} from '@/services/car/snapshot/buildCarSnapshot';
import {reciterOfTheDaySurah} from '@/services/bayaanNow/reciterOfTheDay';
import {playMoment} from '@/services/bayaanNow/playMoment';
import {
  SurahGradientMesh,
  MESH_PALETTES,
} from '@/components/hero/SurahGradientMesh';
import {
  PANEL_ART_GAP,
  PANEL_ART_SIZE,
  PANEL_ROW_PADDING,
  PANEL_ROW_VERTICAL,
  PanelRow,
  usePanelColor,
} from '@/components/collection/CollectionPanel';
import {CollectionEmptyPanel} from '@/components/collection/CollectionEmptyState';
import {
  GlassSurface,
  HOME_MARGIN,
  HomeSectionTitle,
  HomeSymbol,
  PressScale,
  ReciterAvatar,
  ReciterFaces,
  secondaryText,
  useCatalogVersion,
  ignoreHaptics,
} from './homeKit';

const AVATAR = moderateScale(74);
const TILE_HEIGHT = moderateScale(124);
const TILE_RADIUS = moderateScale(26);

function useOpenReciter() {
  const router = useRouter();
  return useCallback(
    (reciter: Reciter) => {
      Haptics.selectionAsync().catch(ignoreHaptics);
      router.push({
        pathname: '/(tabs)/(a.home)/reciter/[id]',
        params: {id: reciter.id},
      });
    },
    [router],
  );
}

function AvatarCell({
  label,
  onPress,
  children,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  children: React.ReactNode;
  accessibilityLabel?: string;
}) {
  const {theme} = useTheme();
  return (
    <PressScale
      onPress={onPress}
      scaleTo={0.94}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={styles.avatarCell}>
      {children}
      <Text
        style={[styles.avatarName, {color: theme.colors.text}]}
        numberOfLines={2}>
        {label}
      </Text>
    </PressScale>
  );
}

/** Favourite reciters as round photos, ending in "All reciters". */
export function YourReciters() {
  const {theme} = useTheme();
  const {t} = useTranslation('home');
  const router = useRouter();
  const openReciter = useOpenReciter();
  const {favoriteReciters} = useFavoriteReciters();
  const panel = usePanelColor();

  // Most recently starred first: the one just added is easy to find.
  const reciters = useMemo(
    () =>
      [...favoriteReciters]
        .sort((a, b) => b.favoritedAt - a.favoritedAt)
        .slice(0, 12),
    [favoriteReciters],
  );
  const openAll = useCallback(() => {
    Haptics.selectionAsync().catch(ignoreHaptics);
    router.push('/(tabs)/(a.home)/browse-all');
  }, [router]);

  return (
    <View>
      <HomeSectionTitle title={t('reciters.title')} />
      {reciters.length === 0 ? (
        <CollectionEmptyPanel
          category="reciters"
          heading={t('reciters.emptyHeading')}
          message={t('reciters.emptyMessage')}
          link={{label: t('reciters.emptyLink'), onPress: openAll}}
          ghostRows={1}
        />
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.shelf}>
          {reciters.map(reciter => (
            <AvatarCell
              key={reciter.id}
              label={getReciterDisplayName(reciter)}
              onPress={() => openReciter(reciter)}>
              <ReciterAvatar reciter={reciter} size={AVATAR} />
            </AvatarCell>
          ))}
          <AvatarCell label={t('find.allReciters')} onPress={openAll}>
            <View
              style={[
                styles.allCircle,
                {
                  backgroundColor: panel,
                  borderColor: Color(theme.colors.text).alpha(0.12).string(),
                },
              ]}>
              <HomeSymbol
                name="chevron"
                size={moderateScale(20)}
                color={secondaryText(theme.colors.text, theme.isDarkMode)}
                weight="bold"
              />
            </View>
          </AvatarCell>
        </ScrollView>
      )}
    </View>
  );
}

function DiscoverTile({
  paletteIndex,
  top,
  title,
  subtitle,
  onPress,
}: {
  paletteIndex: number;
  top: React.ReactNode;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  const {theme} = useTheme();
  const panel = usePanelColor();
  return (
    <PressScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${subtitle}`}
      style={[styles.tile, {backgroundColor: panel}]}>
      <SurahGradientMesh
        palette={MESH_PALETTES[paletteIndex]}
        isDark={theme.isDarkMode}
        viewBoxWidth={180}
        viewBoxHeight={124}
        intensity={theme.isDarkMode ? 2.2 : 3}
      />
      <View style={styles.tileBody}>
        {top}
        <View>
          <Text
            style={[styles.tileTitle, {color: theme.colors.text}]}
            numberOfLines={1}>
            {title}
          </Text>
          <Text
            style={[
              styles.tileSubtitle,
              {color: secondaryText(theme.colors.text, theme.isDarkMode)},
            ]}
            numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
      </View>
    </PressScale>
  );
}

function useSurpriseMe(): () => void {
  const {t} = useTranslation('home');
  const {updateQueue, play} = usePlayerActions();
  const startNewChain = useRecentlyPlayedStore(s => s.startNewChain);
  return useCallback(async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(
        ignoreHaptics,
      );
      const picks = pickRandomRecitations(15);
      if (picks.length === 0) {
        showToast(t('randomHero.findFailed'), undefined, 'error');
        return;
      }
      const {reciter, surah, rewayatId} = picks[0];
      showToast(
        t('randomHero.playing', {
          surah: getSurahDisplayName(surah),
          reciter: getReciterDisplayName(reciter),
        }),
      );
      const batches = await Promise.all(
        picks.map(p =>
          createTracksForReciter(p.reciter, [p.surah], p.rewayatId),
        ),
      );
      await updateQueue(batches.flat(), 0);
      await play();
      await startNewChain(reciter, surah, 0, 0, rewayatId);
    } catch (error) {
      console.error('Surprise me: could not play', error);
      showToast(t('randomHero.playFailed'), undefined, 'error');
    }
  }, [t, updateQueue, play, startNewChain]);
}

/** Today's reciter, the same one the Reciter Spotlight widget shows. */
function useReciterOfTheDay(): {
  reciter: Reciter;
  surahId: number;
  rewayatId: string;
} | null {
  const catalogVersion = useCatalogVersion();
  return useMemo(() => {
    const now = new Date();
    const list = getSpotlightReciters();
    const index = ayahOfTheDayIndex(now, list.length);
    const reciter = index >= 0 ? list[index] : undefined;
    if (!reciter) return null;
    // Its fullest rewayah, and a random longer surah from it for today.
    const rewayat = findRewayat(reciter, undefined);
    if (!rewayat) return null;
    const surahId = reciterOfTheDaySurah(
      availableSurahIds(rewayat),
      id => SURAHS[id - 1]?.verses_count,
      now,
    );
    if (surahId === null) return null;
    return {reciter, surahId, rewayatId: rewayat.id};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogVersion]);
}

function ReciterOfTheDay() {
  const {theme} = useTheme();
  const {t} = useTranslation('home');
  const openReciter = useOpenReciter();
  const pick = useReciterOfTheDay();
  if (!pick) return null;
  const {reciter, surahId, rewayatId} = pick;
  const surah = SURAHS[surahId - 1];
  const name = getReciterDisplayName(reciter);
  const surahName = surah ? getSurahDisplayName(surah) : '';

  const onPlay = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(
      ignoreHaptics,
    );
    playMoment({
      id: `surah:${surahId}`,
      kind: 'surah',
      reason: 'midday',
      surahId,
      reciterId: reciter.id,
      rewayatId,
    }).catch(error =>
      console.error('Reciter of the day: could not play', error),
    );
  };

  return (
    <View style={styles.rodWrap}>
      <PanelRow first last>
        <PressScale
          onPress={() => openReciter(reciter)}
          scaleTo={0.98}
          accessibilityRole="button"
          accessibilityLabel={`${t('find.reciterOfTheDay')}: ${name}`}
          style={styles.row}>
          <ReciterAvatar reciter={reciter} size={PANEL_ART_SIZE} />
          <View style={styles.rowText}>
            <Text
              style={[
                styles.rowEyebrow,
                {color: secondaryText(theme.colors.text, theme.isDarkMode)},
              ]}
              numberOfLines={1}>
              {t('find.reciterOfTheDay')}
            </Text>
            <Text
              style={[styles.rowTitle, {color: theme.colors.text}]}
              numberOfLines={1}>
              {name}
            </Text>
          </View>
          <PressScale
            onPress={onPlay}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={t('find.playSurah', {surah: surahName})}
            style={[
              styles.smallPill,
              {backgroundColor: Color(theme.colors.text).alpha(0.08).string()},
            ]}>
            <HomeSymbol
              name="play"
              size={moderateScale(11)}
              color={theme.colors.text}
              weight="bold"
            />
            <Text
              style={[styles.smallPillText, {color: theme.colors.text}]}
              numberOfLines={1}>
              {surahName}
            </Text>
          </PressScale>
        </PressScale>
      </PanelRow>
    </View>
  );
}

/** Every reciter, a surprise, and today's reciter. */
export function FindSomethingNew() {
  const {theme} = useTheme();
  const {t} = useTranslation('home');
  const router = useRouter();
  const surprise = useSurpriseMe();
  const panel = usePanelColor();
  const catalogVersion = useCatalogVersion();
  const faces = useMemo(
    () => getFeaturedReciters(3),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [catalogVersion],
  );
  const total = RECITERS.length;

  return (
    <View>
      <HomeSectionTitle title={t('find.title')} />
      <View style={styles.tiles}>
        <DiscoverTile
          paletteIndex={1}
          top={
            <ReciterFaces
              reciters={faces}
              size={moderateScale(34)}
              ring={panel}
            />
          }
          title={t('find.allReciters')}
          subtitle={
            total > 0
              ? t('find.reciterCount', {
                  count: total,
                  formatted: localizeDigits(total),
                })
              : t('find.everyVoice')
          }
          onPress={() => {
            Haptics.selectionAsync().catch(ignoreHaptics);
            router.push('/(tabs)/(a.home)/browse-all');
          }}
        />
        <DiscoverTile
          paletteIndex={2}
          top={
            <GlassSurface style={styles.shuffleIcon}>
              <HomeSymbol
                name="shuffle"
                size={moderateScale(17)}
                color={theme.colors.text}
                weight="bold"
              />
            </GlassSurface>
          }
          title={t('find.surprise')}
          subtitle={t('find.surpriseLine')}
          onPress={surprise}
        />
      </View>
      <ReciterOfTheDay />
    </View>
  );
}

const styles = StyleSheet.create({
  shelf: {
    paddingHorizontal: moderateScale(14),
    gap: moderateScale(4),
  },
  avatarCell: {
    width: AVATAR + moderateScale(12),
    alignItems: 'center',
  },
  avatarName: {
    marginTop: moderateScale(8),
    fontFamily: 'Manrope-SemiBold',
    fontSize: moderateScale(12.5),
    lineHeight: moderateScale(16),
    textAlign: 'center',
  },
  allCircle: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tiles: {
    flexDirection: 'row',
    gap: moderateScale(10),
    marginHorizontal: HOME_MARGIN,
  },
  tile: {
    flex: 1,
    height: TILE_HEIGHT,
    borderRadius: TILE_RADIUS,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  tileBody: {
    ...StyleSheet.absoluteFill,
    padding: moderateScale(14),
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  tileTitle: {
    fontFamily: 'Manrope-Bold',
    fontSize: moderateScale(16),
    textAlign: 'left',
  },
  tileSubtitle: {
    marginTop: moderateScale(1),
    fontFamily: 'Manrope-Medium',
    fontSize: moderateScale(12.5),
    textAlign: 'left',
  },
  shuffleIcon: {
    width: moderateScale(38),
    height: moderateScale(38),
    borderRadius: moderateScale(12),
    alignItems: 'center',
    justifyContent: 'center',
  },
  rodWrap: {
    marginTop: moderateScale(10),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: PANEL_ROW_PADDING,
    paddingVertical: PANEL_ROW_VERTICAL,
    gap: PANEL_ART_GAP,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  rowEyebrow: {
    fontFamily: 'Manrope-SemiBold',
    fontSize: moderateScale(12),
    textAlign: 'left',
  },
  rowTitle: {
    fontFamily: 'Manrope-SemiBold',
    fontSize: moderateScale(15),
    textAlign: 'left',
  },
  smallPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: moderateScale(6),
    height: moderateScale(34),
    paddingHorizontal: moderateScale(13),
    borderRadius: moderateScale(17),
    maxWidth: moderateScale(150),
  },
  smallPillText: {
    fontFamily: 'Manrope-Bold',
    fontSize: moderateScale(13),
    flexShrink: 1,
  },
});
