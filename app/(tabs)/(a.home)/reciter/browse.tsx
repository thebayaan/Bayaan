import React, {useLayoutEffect} from 'react';
import {useRouter, useLocalSearchParams, useNavigation} from 'expo-router';
import {useTheme} from '@/hooks/useTheme';
import {USE_GLASS} from '@/hooks/useGlassProps';
import BrowseReciters from '@/components/browse/BrowseReciters';
import {SURAHS} from '@/data/surahData';

export default function BrowseScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const {theme} = useTheme();
  const {
    surahId,
    teacher,
    student,
    rewayatName,
    countryName,
    translationName,
    hasPhoto,
  } = useLocalSearchParams<{
    surahId: string;
    teacher: string;
    student: string;
    // RFC-012 / RFC-020 — display companions for the composable filter
    // chips, used here only to title the destination header.
    rewayatName: string;
    countryName: string;
    translationName: string;
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
    : countryName
      ? countryName
      : translationName
        ? `${translationName} translation`
        : surahId
          ? `Browse Reciters - ${SURAHS[parseInt(surahId, 10) - 1].name}`
          : 'Browse All';

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
