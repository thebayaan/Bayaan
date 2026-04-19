import React, {useMemo} from 'react';
import {View, ViewStyle} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import {SURAHS, Surah} from '@/data/surahData';
import {mushafSessionStore} from '@/services/mushaf/MushafSessionStore';
import {HeroSection} from './HeroSection';
import {SurahHeroSection} from './SurahsHero';

function getSurahOfTheDay(): Surah {
  const today = new Date();
  const startOfYear = new Date(today.getFullYear(), 0, 0);
  const dayOfYear = Math.floor(
    (today.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24),
  );
  const surahIndex = dayOfYear % 114;
  return SURAHS[surahIndex];
}

function getSurahForPage(page: number): Surah | undefined {
  return SURAHS.find(s => {
    const [start, end] = s.pages.split('-').map(Number);
    return page >= start && page <= end;
  });
}

interface ContinueReadingHeroProps {
  onSurahLongPress?: (surah: Surah) => void;
}

const SECTION_HEIGHT = moderateScale(150);

/**
 * Hero section for the Surahs tab.
 * Shows "Continue Reading" with the last-read surah if the user has history,
 * otherwise falls back to Surah of the Day.
 */
export function ContinueReadingHero({
  onSurahLongPress,
}: ContinueReadingHeroProps) {
  const lastReadPage = mushafSessionStore.getLastReadPage();
  const surahOfTheDay = useMemo(() => getSurahOfTheDay(), []);

  const lastReadSurah = lastReadPage
    ? getSurahForPage(lastReadPage)
    : undefined;

  const displaySurah = lastReadSurah ?? surahOfTheDay;
  const title = lastReadSurah ? 'CONTINUE READING' : 'SURAH OF THE DAY';

  const cardStyle: ViewStyle = useMemo(
    () => ({width: '100%', height: SECTION_HEIGHT}),
    [],
  );

  return (
    <HeroSection
      mainHero={
        <View style={{paddingHorizontal: moderateScale(16)}}>
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
        </View>
      }
      randomHero={false}
    />
  );
}
