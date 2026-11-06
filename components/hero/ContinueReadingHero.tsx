import React, {useCallback, useMemo, useState} from 'react';
import {StyleSheet, View, ViewStyle} from 'react-native';
import {moderateScale} from '@/utils/scale';
import {useFocusEffect} from 'expo-router';
import {Surah} from '@/data/surahData';
import {useTranslation} from 'react-i18next';
import {mushafSessionStore} from '@/services/mushaf/MushafSessionStore';
import {useQfSyncStore} from '@/store/qfSyncStore';
import {getSurahOfTheDay, getSurahForPage} from '@/utils/quranPages';
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

function readLastPageForRevision(
  _scopeRevision: number,
  _dataRevision: number,
): number | null {
  return mushafSessionStore.getLastReadPage();
}

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
  const scopeRevision = useQfSyncStore(state => state.scopeRevision);
  const dataRevision = useQfSyncStore(state => state.dataRevision);
  // MMKV reads aren't reactive, so revision changes read the active scope
  // during render and focus changes force a fresh render after leaving Mushaf.
  const [, setFocusRevision] = useState(0);
  useFocusEffect(
    useCallback(() => {
      setFocusRevision(revision => revision + 1);
    }, []),
  );
  const lastReadPage = readLastPageForRevision(scopeRevision, dataRevision);

  const surahOfTheDay = useMemo(() => getSurahOfTheDay(new Date()), []);

  const lastReadSurah = lastReadPage
    ? getSurahForPage(lastReadPage)
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
