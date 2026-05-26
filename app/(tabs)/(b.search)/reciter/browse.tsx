import React from 'react';
import {useRouter, useLocalSearchParams} from 'expo-router';
import {useTheme} from '@/hooks/useTheme';
import BrowseReciters from '@/components/browse/BrowseReciters';
import {SURAHS} from '@/data/surahData';

export default function BrowseScreen() {
  const router = useRouter();
  const {theme} = useTheme();
  // RFC-012 — composable Search-tab filter chips. Tiles can deeplink in
  // with chips pre-applied (e.g. `?hasPhoto=1`).
  const {surahId, hasPhoto} = useLocalSearchParams<{
    surahId: string;
    hasPhoto: string;
  }>();

  const handleBack = () => {
    router.back();
  };

  // Get surah name if surahId is provided
  const title = surahId
    ? `Browse Reciters - ${SURAHS[parseInt(surahId, 10) - 1].name}`
    : 'Browse All';

  return (
    <BrowseReciters
      theme={theme}
      onBack={handleBack}
      surahId={surahId ? parseInt(surahId, 10) : undefined}
      title={title}
      initialHasPhoto={hasPhoto === '1' || hasPhoto === 'true'}
    />
  );
}
