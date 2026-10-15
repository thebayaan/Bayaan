import React, {useCallback, useMemo, useState} from 'react';
import {View, ViewStyle} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import {useFocusEffect} from 'expo-router';
import {Surah} from '@/data/surahData';
import {useTranslation} from 'react-i18next';
import {mushafSessionStore} from '@/services/mushaf/MushafSessionStore';
import {getSurahOfTheDay, getSurahForPage} from '@/utils/quranPages';
import {HeroSection} from './HeroSection';
import {SurahHeroSection} from './SurahsHero';

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
  // MMKV reads aren't reactive, and this component is typically cached
  // inside a memoized FlashList header — so re-read the session value
  // every time the Surahs tab regains focus (e.g. after backing out of
  // the mushaf) to keep "Continue Reading" in sync with the latest page.
  const [lastReadPage, setLastReadPage] = useState<number | null>(() =>
    mushafSessionStore.getLastReadPage(),
  );
  useFocusEffect(
    useCallback(() => {
      setLastReadPage(mushafSessionStore.getLastReadPage());
    }, []),
  );

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
// @ai-end
