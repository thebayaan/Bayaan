import React from 'react';
import {useRouter, useLocalSearchParams} from 'expo-router';
// @ai-start
import {useTranslation} from 'react-i18next';
// @ai-end
import {useTheme} from '@/hooks/useTheme';
import BrowseReciters from '@/components/browse/BrowseReciters';
import {SURAHS} from '@/data/surahData';
// @ai-start
import {getSurahDisplayName} from '@/i18n/format';
// @ai-end

// @ai-start
export default function BrowseScreen() {
  const router = useRouter();
  const {theme} = useTheme();
  const {t} = useTranslation('home');
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
    ? t('browse.browseRecitersForSurah', {
        surah: getSurahDisplayName(SURAHS[parseInt(surahId, 10) - 1]),
      })
    : t('browse.browseAll');

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
// @ai-end
