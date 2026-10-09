import React from 'react';
import {useRouter, useLocalSearchParams} from 'expo-router';
import {useTheme} from '@/hooks/useTheme';
import BrowseReciters from '@/components/browse/BrowseReciters';
import {SURAHS} from '@/data/surahData';

export default function BrowseScreen() {
  const router = useRouter();
  const {theme} = useTheme();
  // RFC-012 / RFC-020 — the reciter-browse destination reads the full
  // composable-filter param surface so any entry point (a "Browse by X"
  // deeplink, a Browse chip, the Search composer) lands here with its chips
  // pre-applied and editable. Mirrors the (a.home) twin so both entries
  // behave identically.
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
    // Display companions used to title the destination header.
    rewayatName: string;
    countryName: string;
    translationName: string;
    // RFC-012 — composable Search-tab filter chips (e.g. `?hasPhoto=1`).
    hasPhoto: string;
  }>();

  const handleBack = () => {
    router.back();
  };

  // Title mirrors the (a.home) twin.
  const title = rewayatName
    ? rewayatName
    : countryName
      ? countryName
      : translationName
        ? `${translationName} translation`
        : surahId
          ? `Browse Reciters - ${SURAHS[parseInt(surahId, 10) - 1].name}`
          : 'Browse All';

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
