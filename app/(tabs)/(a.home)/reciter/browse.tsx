import React, {useLayoutEffect} from 'react';
import {useRouter, useLocalSearchParams, useNavigation} from 'expo-router';
// @ai-start
import {useTranslation} from 'react-i18next';
// @ai-end
import {useTheme} from '@/hooks/useTheme';
import {USE_GLASS} from '@/hooks/useGlassProps';
import BrowseReciters from '@/components/browse/BrowseReciters';
import {useResponsive} from '@/hooks/useResponsive'; // @ai
import {SURAHS} from '@/data/surahData';
// @ai-start
import {getSurahDisplayName} from '@/i18n/format';
// @ai-end

// @ai-start
export default function BrowseScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const {theme} = useTheme();
  const {t} = useTranslation('home');
  const {isTablet} = useResponsive(); // @ai
  const {surahId, teacher, student, rewayatName, hasPhoto} =
    useLocalSearchParams<{
      surahId: string;
      teacher: string;
      student: string;
      rewayatName: string;
      // RFC-012 — composable Search-tab filter chips. Tiles on the Home
      // tab can deeplink here with chips pre-applied (e.g. `?hasPhoto=1`).
      hasPhoto: string;
    }>();

  const handleBack = () => {
    router.back();
  };

  // Get title based on context. On iPad a tap on a card plays the surah,
  // so the title says so: "Choose a reciter · Ya-Sin". @ai
  // A surahId that is not 1–114 (a bad link) has no surah to name; reading
  // its name used to throw. It opens the plain list instead. @ai
  const surah = surahId ? SURAHS[parseInt(surahId, 10) - 1] : undefined; // @ai
  const title = rewayatName
    ? rewayatName
    : surah
    ? isTablet
      ? t('browse.chooseReciterForSurah', {surah: getSurahDisplayName(surah)})
      : // A phone header only fits the surah's name. @ai
        getSurahDisplayName(surah)
    : t('browse.browseAll');

  // Set native header title on iOS
  useLayoutEffect(() => {
    if (USE_GLASS) {
      navigation.setOptions({headerTitle: title});
    }
  }, [navigation, title]);

  return (
    <BrowseReciters
      theme={theme}
      onBack={handleBack}
      surahId={surah?.id} // @ai
      title={title}
      initialTeacher={teacher}
      initialStudent={student}
      initialHasPhoto={hasPhoto === '1' || hasPhoto === 'true'}
    />
  );
}
// @ai-end
