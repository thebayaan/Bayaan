import React, {useLayoutEffect} from 'react';
import {useRouter, useLocalSearchParams, useNavigation} from 'expo-router';
// @ai-start
import {useTranslation} from 'react-i18next';
// @ai-end
import {useTheme} from '@/hooks/useTheme';
import {USE_GLASS} from '@/hooks/useGlassProps';
import BrowseReciters from '@/components/browse/BrowseReciters';
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

  // Get title based on context
  const title = rewayatName
    ? rewayatName
    : surahId
      ? t('browse.browseRecitersForSurah', {
          surah: getSurahDisplayName(SURAHS[parseInt(surahId, 10) - 1]),
        })
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
      surahId={surahId ? parseInt(surahId, 10) : undefined}
      title={title}
      initialTeacher={teacher}
      initialStudent={student}
      initialHasPhoto={hasPhoto === '1' || hasPhoto === 'true'}
    />
  );
}
// @ai-end
