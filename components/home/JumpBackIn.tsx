// @ai-generated
// Jump back in: the Continue Listening cards (an adhkar session in progress,
// then recent recitations and uploads) and the page the Mushaf was left on.
import React, {useCallback, useMemo, useState} from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';
import {useFocusEffect, useRouter} from 'expo-router';
import {useTranslation} from 'react-i18next';
import * as Haptics from 'expo-haptics';
import Color from 'color';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale} from '@/utils/scale';
import {
  getReciterDisplayName,
  getSurahDisplayName,
  localizeDigits,
} from '@/i18n/format';
import {
  useRecentlyPlayedStore,
  type RecentlyPlayedTrack,
} from '@/services/player/store/recentlyPlayedStore';
import {mushafSessionStore} from '@/services/mushaf/MushafSessionStore';
import {digitalKhattDataService} from '@/services/mushaf/DigitalKhattDataService';
import {getLastReadSurah} from '@/utils/quranPages';
import {
  SurahGradientMesh,
  MESH_PALETTES,
} from '@/components/hero/SurahGradientMesh';
import {
  PANEL_ART_GAP,
  PANEL_ART_RADIUS,
  PANEL_ART_SIZE,
  PANEL_ROW_PADDING,
  PANEL_ROW_VERTICAL,
  PanelRow,
} from '@/components/collection/CollectionPanel';
import {
  HomeSectionTitle,
  HomeSymbol,
  PressScale,
  secondaryText,
  ignoreHaptics,
} from './homeKit';
import {RecentReciterCard} from '@/components/cards/RecentReciterCard';
import {
  AdhkarNowPlayingCard,
  useHasAdhkarSession,
} from '@/components/adhkar/AdhkarNowPlayingCard';

function isResumable(track: RecentlyPlayedTrack): boolean {
  return (
    !track.isUserUpload &&
    !!track.reciter?.id &&
    !!track.reciter?.name &&
    !!track.surah?.id &&
    !!track.surah?.name
  );
}

function ProgressBar({progress}: {progress: number}) {
  const {theme} = useTheme();
  return (
    <View
      style={[
        styles.track,
        {backgroundColor: Color(theme.colors.text).alpha(0.1).string()},
      ]}>
      <View
        style={[
          styles.fill,
          {
            width: `${Math.round(Math.min(Math.max(progress, 0.03), 1) * 100)}%`,
            backgroundColor: theme.colors.text,
          },
        ]}
      />
    </View>
  );
}

function ReadingRow({
  page,
  surahId,
  first,
  last,
}: {
  page: number;
  surahId: number | null;
  first: boolean;
  last: boolean;
}) {
  const {theme} = useTheme();
  const {t} = useTranslation('home');
  const router = useRouter();
  const secondary = secondaryText(theme.colors.text, theme.isDarkMode);
  const surah = getLastReadSurah(
    page,
    surahId,
    digitalKhattDataService.initialized
      ? digitalKhattDataService.getPageToSurah()
      : {},
  );
  const title = t('jump.mushafPage', {page: localizeDigits(page)});
  const subtitle = surah
    ? t('jump.continueReading', {surah: getSurahDisplayName(surah)})
    : t('jump.continueReadingPlain');

  return (
    <PanelRow first={first} last={last}>
      <PressScale
        onPress={() => {
          Haptics.selectionAsync().catch(ignoreHaptics);
          router.push({pathname: '/mushaf', params: {page: String(page)}});
        }}
        scaleTo={0.98}
        accessibilityRole="button"
        accessibilityLabel={`${title}. ${subtitle}`}
        style={styles.row}>
        <View
          style={[
            styles.bookArt,
            {backgroundColor: Color(theme.colors.text).alpha(0.05).string()},
          ]}>
          <SurahGradientMesh
            palette={MESH_PALETTES[4]}
            isDark={theme.isDarkMode}
            viewBoxWidth={120}
            viewBoxHeight={120}
            intensity={theme.isDarkMode ? 3 : 4.5}
          />
          <HomeSymbol
            name="book"
            size={PANEL_ART_SIZE * 0.42}
            color={theme.colors.text}
          />
        </View>
        <View style={styles.text}>
          <Text
            style={[styles.title, {color: theme.colors.text}]}
            numberOfLines={1}>
            {title}
          </Text>
          <Text style={[styles.subtitle, {color: secondary}]} numberOfLines={1}>
            {subtitle}
          </Text>
          <ProgressBar progress={page / 604} />
        </View>
        <View style={styles.play}>
          <HomeSymbol
            name="chevron"
            size={moderateScale(14)}
            color={secondary}
            weight="bold"
          />
        </View>
      </PressScale>
    </PanelRow>
  );
}

export function JumpBackIn() {
  const {t} = useTranslation(['home', 'common']);
  const recentTracks = useRecentlyPlayedStore(s => s.recentTracks);
  const hasAdhkar = useHasAdhkarSession();

  // The Mushaf position lives in MMKV, which is not reactive: read it again
  // whenever Home comes back into view (after closing the reader).
  const [reading, setReading] = useState(() => ({
    page: mushafSessionStore.getLastReadPage(),
    surahId: mushafSessionStore.getLastReadSurahId(),
  }));
  useFocusEffect(
    useCallback(() => {
      const page = mushafSessionStore.getLastReadPage();
      const surahId = mushafSessionStore.getLastReadSurahId();
      setReading(prev =>
        prev.page === page && prev.surahId === surahId ? prev : {page, surahId},
      );
    }, []),
  );

  // The Continue Listening cards, as the old Home had them: uploads too.
  const tracks = useMemo(
    () =>
      recentTracks.filter(track =>
        track.isUserUpload ? !!track.userRecitationId : isResumable(track),
      ),
    [recentTracks],
  );

  const hasReading = reading.page !== null && reading.page > 0;
  const hasCards = tracks.length > 0 || hasAdhkar;
  if (!hasCards && !hasReading) return null;

  return (
    <View>
      <HomeSectionTitle
        title={t('jump.title')}
        action={tracks.length > 0 ? t('common:actions.clear') : undefined}
        onAction={() => useRecentlyPlayedStore.getState().clearRecentTracks()}
      />
      {hasCards ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.shelf}>
          {/* An adhkar session in progress leads, as it did before. */}
          <AdhkarNowPlayingCard variant="tile" />
          {tracks.map(track => (
            <RecentCard
              key={`${track.reciter?.id ?? 'upload'}-${track.surah?.id ?? 0}-${track.timestamp}`}
              track={track}
            />
          ))}
        </ScrollView>
      ) : null}
      {hasReading ? (
        <View style={hasCards ? styles.readingGap : undefined}>
          <ReadingRow
            page={reading.page as number}
            surahId={reading.surahId}
            first
            last
          />
        </View>
      ) : null}
    </View>
  );
}

/** One Continue Listening card: a recitation or an upload. */
function RecentCard({track}: {track: RecentlyPlayedTrack}) {
  const {t} = useTranslation('home');
  if (track.isUserUpload) {
    return (
      <RecentReciterCard
        imageUrl={
          track.reciter?.id !== '__uploads__'
            ? (track.reciter?.image_url ?? undefined)
            : undefined
        }
        reciterName={track.uploadArtist || t('home.myRecitations')}
        surahName={track.uploadTitle || t('home.upload')}
        trackId={`upload:${track.userRecitationId}`}
        reciterId={track.reciter?.id || '__uploads__'}
        surahId={track.surah?.id || 0}
        duration={track.duration}
        progress={track.progress}
        isUserUpload
        userRecitationId={track.userRecitationId}
      />
    );
  }
  return (
    <RecentReciterCard
      imageUrl={track.reciter.image_url ?? undefined}
      reciterName={getReciterDisplayName(track.reciter)}
      imageName={track.reciter.name}
      surahName={getSurahDisplayName(track.surah)}
      trackId={`${track.reciter.id}:${track.surah.id}`}
      reciterId={track.reciter.id}
      surahId={track.surah.id}
      duration={track.duration}
      progress={track.progress}
      rewayatId={track.rewayatId}
    />
  );
}

const styles = StyleSheet.create({
  shelf: {
    paddingHorizontal: moderateScale(16),
    gap: moderateScale(8),
  },
  readingGap: {
    marginTop: moderateScale(14),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: PANEL_ROW_PADDING,
    paddingVertical: PANEL_ROW_VERTICAL,
    gap: PANEL_ART_GAP,
  },
  text: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontFamily: 'Manrope-SemiBold',
    fontSize: moderateScale(15),
    textAlign: 'left',
  },
  subtitle: {
    marginTop: moderateScale(1),
    fontFamily: 'Manrope-Regular',
    fontSize: moderateScale(13),
    textAlign: 'left',
  },
  track: {
    height: moderateScale(3),
    borderRadius: moderateScale(2),
    marginTop: moderateScale(7),
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: moderateScale(2),
  },
  play: {
    width: moderateScale(34),
    height: moderateScale(34),
    borderRadius: moderateScale(17),
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookArt: {
    width: PANEL_ART_SIZE,
    height: PANEL_ART_SIZE,
    borderRadius: PANEL_ART_RADIUS,
    borderCurve: 'continuous',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
