import React, {useCallback, useMemo, useState} from 'react';
import {StyleSheet, View, ViewStyle} from 'react-native';
import {moderateScale} from '@/utils/scale';
import {useFocusEffect} from 'expo-router';
import {Surah} from '@/data/surahData';
import {useTranslation} from 'react-i18next';
import {mushafSessionStore} from '@/services/mushaf/MushafSessionStore';
import {getSurahOfTheDay, getLastReadSurah} from '@/utils/quranPages'; // @ai
import {digitalKhattDataService} from '@/services/mushaf/DigitalKhattDataService'; // @ai
import {HeroSection} from './HeroSection';
import {SurahHeroSection} from './SurahsHero';
// @ai-start
import {useResponsive} from '@/hooks/useResponsive';
import {useRecentlyPlayedStore} from '@/services/player/store/recentlyPlayedStore';
import {
  ContinueListeningHero,
  findResumableIndex,
} from './ContinueListeningHero';
// @ai-end

interface ContinueReadingHeroProps {
  onSurahLongPress?: (surah: Surah) => void;
}

const SECTION_HEIGHT = moderateScale(150);

/**
 * Hero section for the Surahs tab.
 * Shows "Continue Reading" with the last-read surah if the user has history,
 * otherwise falls back to Surah of the Day.
 */
// @ai-start
export function ContinueReadingHero({
  onSurahLongPress,
}: ContinueReadingHeroProps) {
  const {t} = useTranslation('home');
  const {isTablet} = useResponsive();
  // iPad shows Continue listening beside it once something has been played.
  const showListening = useRecentlyPlayedStore(
    state => isTablet && findResumableIndex(state.recentTracks) >= 0,
  );
  // MMKV reads aren't reactive, and this component is typically cached
  // inside a memoized FlashList header — so re-read the session value
  // every time the Surahs tab regains focus (e.g. after backing out of
  // the mushaf) to keep "Continue Reading" in sync with the latest page.
  const [lastReadPage, setLastReadPage] = useState<number | null>(() =>
    mushafSessionStore.getLastReadPage(),
  );
  // The surah the reader's header showed on that page, saved with it.
  const [lastReadSurahId, setLastReadSurahId] = useState<number | null>(() =>
    mushafSessionStore.getLastReadSurahId(),
  );
  useFocusEffect(
    useCallback(() => {
      setLastReadPage(mushafSessionStore.getLastReadPage());
      setLastReadSurahId(mushafSessionStore.getLastReadSurahId());
    }, []),
  );

  const surahOfTheDay = useMemo(() => getSurahOfTheDay(new Date()), []);

  // Names the surah the reader named. The page alone used to pick the first
  // surah on it: the one before, for every surah that starts mid-page.
  const lastReadSurah = lastReadPage
    ? getLastReadSurah(
        lastReadPage,
        lastReadSurahId,
        digitalKhattDataService.initialized
          ? digitalKhattDataService.getPageToSurah()
          : {},
      )
    : undefined;

  const displaySurah = lastReadSurah ?? surahOfTheDay;
  const title = lastReadSurah
    ? t('hero.continueReading')
    : t('hero.surahOfTheDay');

  const cardStyle: ViewStyle = useMemo(
    () => ({width: '100%', height: SECTION_HEIGHT}),
    [],
  );

  const readingHero = (
    <SurahHeroSection
      surah={displaySurah}
      onLongPress={onSurahLongPress}
      title={title}
      style={cardStyle}
      // Only wire the resume page when the user actually has
      // reading history; otherwise the hero falls back to
      // Surah of the Day and should open at page 1.
      resumePage={lastReadPage ?? undefined}
    />
  );

  return (
    <HeroSection
      mainHero={
        showListening ? (
          <View style={styles.tabletRow}>
            <View style={styles.tabletCell}>{readingHero}</View>
            <View style={styles.tabletCell}>
              <ContinueListeningHero style={styles.fill} />
            </View>
          </View>
        ) : (
          <View style={{paddingHorizontal: moderateScale(16)}}>
            {readingHero}
          </View>
        )
      }
      randomHero={false}
    />
  );
}

const styles = StyleSheet.create({
  tabletRow: {
    flexDirection: 'row',
    gap: moderateScale(16),
    paddingHorizontal: moderateScale(16),
  },
  tabletCell: {
    flex: 1,
    height: SECTION_HEIGHT,
  },
  fill: {
    flex: 1,
  },
});
// @ai-end
