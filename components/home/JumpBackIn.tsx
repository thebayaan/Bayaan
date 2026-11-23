// @ai-generated
// Jump back in: the last few recitations, with how much is left, and the
// page the Mushaf was left on. The recitation already in the player is left
// out, because the mini player shows it.
import React, {useCallback, useMemo, useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {shallow} from 'zustand/shallow';
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
import {usePlayerActions} from '@/hooks/usePlayerActions';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {
  useRecentlyPlayedStore,
  type RecentlyPlayedTrack,
} from '@/services/player/store/recentlyPlayedStore';
import {resumeRecent} from '@/services/player/utils/resumeRecent';
import {mushafSessionStore} from '@/services/mushaf/MushafSessionStore';
import {digitalKhattDataService} from '@/services/mushaf/DigitalKhattDataService';
import {getLastReadSurah} from '@/utils/quranPages';
import {SurahCover} from '@/components/collection/CollectionArt';
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

const MAX_RECITATIONS = 3;

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

function RecitationRow({
  track,
  index,
  first,
  last,
}: {
  track: RecentlyPlayedTrack;
  index: number;
  first: boolean;
  last: boolean;
}) {
  const {theme} = useTheme();
  const {t} = useTranslation('home');
  const {updateQueue} = usePlayerActions();
  const secondary = secondaryText(theme.colors.text, theme.isDarkMode);
  const surahName = getSurahDisplayName(track.surah);
  const reciterName = getReciterDisplayName(track.reciter);
  const minutesLeft = Math.max(
    1,
    Math.round(((1 - track.progress) * track.duration) / 60),
  );
  const finished = track.progress >= 0.95;
  const detail = finished
    ? t('jump.finished')
    : track.duration > 0
      ? t('jump.minutesLeft', {
          count: minutesLeft,
          formatted: localizeDigits(minutesLeft),
        })
      : null;

  const onPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(ignoreHaptics);
    resumeRecent({
      reciterId: track.reciter.id,
      surahId: track.surah.id,
      rewayatId: track.rewayatId,
      startPosition: finished ? 0 : track.progress * track.duration,
      recentIndex: index,
      updateQueue,
    }).catch(error => console.error('Jump back in: could not resume', error));
  }, [track, index, finished, updateQueue]);

  return (
    <PanelRow first={first} last={last}>
      <PressScale
        onPress={onPress}
        scaleTo={0.98}
        accessibilityRole="button"
        accessibilityLabel={t('jump.resumeLabel', {
          surah: surahName,
          reciter: reciterName,
        })}
        style={styles.row}>
        <SurahCover
          surahId={track.surah.id}
          size={PANEL_ART_SIZE}
          radius={PANEL_ART_RADIUS + moderateScale(2)}
        />
        <View style={styles.text}>
          <Text
            style={[styles.title, {color: theme.colors.text}]}
            numberOfLines={1}>
            {surahName}
          </Text>
          <Text style={[styles.subtitle, {color: secondary}]} numberOfLines={1}>
            {detail ? `${reciterName} · ${detail}` : reciterName}
          </Text>
          <ProgressBar progress={track.progress} />
        </View>
        <View
          style={[
            styles.play,
            {backgroundColor: Color(theme.colors.text).alpha(0.08).string()},
          ]}>
          <HomeSymbol
            name="play"
            size={moderateScale(13)}
            color={theme.colors.text}
            weight="bold"
          />
        </View>
      </PressScale>
    </PanelRow>
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
  const {t} = useTranslation('home');
  const recentTracks = useRecentlyPlayedStore(s => s.recentTracks);
  const current = usePlayerStore(s => {
    const track =
      s.queue.currentIndex >= 0
        ? s.queue.tracks[s.queue.currentIndex]
        : undefined;
    return {reciterId: track?.reciterId, surahId: track?.surahId};
  }, shallow);

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

  const recitations = useMemo(() => {
    const rows: {track: RecentlyPlayedTrack; index: number}[] = [];
    recentTracks.forEach((track, index) => {
      if (rows.length >= MAX_RECITATIONS || !isResumable(track)) return;
      const inPlayer =
        track.reciter.id === current.reciterId &&
        String(track.surah.id) === current.surahId;
      if (!inPlayer) rows.push({track, index});
    });
    return rows;
  }, [recentTracks, current.reciterId, current.surahId]);

  const hasReading = reading.page !== null && reading.page > 0;
  if (recitations.length === 0 && !hasReading) return null;

  // Reading sits second: the most recent recitation leads, then the page.
  const count = recitations.length + (hasReading ? 1 : 0);
  const readingAt = Math.min(1, recitations.length);
  let position = 0;
  const rows: React.ReactNode[] = [];
  const pushRecitation = (r: {track: RecentlyPlayedTrack; index: number}) => {
    rows.push(
      <RecitationRow
        key={`${r.track.reciter.id}:${r.track.surah.id}:${r.track.timestamp}`}
        track={r.track}
        index={r.index}
        first={position === 0}
        last={position === count - 1}
      />,
    );
    position += 1;
  };
  recitations.forEach((r, i) => {
    if (hasReading && i === readingAt) {
      rows.push(
        <ReadingRow
          key="mushaf"
          page={reading.page as number}
          surahId={reading.surahId}
          first={position === 0}
          last={position === count - 1}
        />,
      );
      position += 1;
    }
    pushRecitation(r);
  });
  if (hasReading && readingAt >= recitations.length) {
    rows.push(
      <ReadingRow
        key="mushaf"
        page={reading.page as number}
        surahId={reading.surahId}
        first={position === 0}
        last
      />,
    );
  }

  return (
    <View>
      <HomeSectionTitle title={t('jump.title')} />
      {rows}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: PANEL_ROW_PADDING,
    paddingVertical: PANEL_ROW_VERTICAL + moderateScale(2),
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
    borderRadius: PANEL_ART_RADIUS + moderateScale(2),
    borderCurve: 'continuous',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
