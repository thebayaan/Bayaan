import React, {useLayoutEffect} from 'react';
import {useRouter, useLocalSearchParams, useNavigation} from 'expo-router';
// @ai-start
import {useTranslation} from 'react-i18next';
// @ai-end
import {useTheme} from '@/hooks/useTheme';
import {USE_GLASS} from '@/hooks/useGlassProps'; // @ai
import BrowseReciters from '@/components/browse/BrowseReciters';
import {useResponsive} from '@/hooks/useResponsive'; // @ai
import {SURAHS} from '@/data/surahData';
// @ai-start
import {getSurahDisplayName} from '@/i18n/format';
// @ai-end

// @ai-start
export default function BrowseScreen() {
  const router = useRouter();
  const navigation = useNavigation(); // @ai
  const {theme} = useTheme();
  const {t} = useTranslation('home');
  const {isTablet} = useResponsive(); // @ai
  // RFC-012 — composable Search-tab filter chips. Tiles can deeplink in
  // with chips pre-applied (e.g. `?hasPhoto=1`).
  const {surahId, hasPhoto} = useLocalSearchParams<{
    surahId: string;
    hasPhoto: string;
  }>();

  const handleBack = () => {
    router.back();
  };

  // Get surah name if surahId is provided. On iPad a tap on a card plays
  // the surah, so the title says so: "Choose a reciter · Ya-Sin". @ai
  const surahTitleKey = isTablet
    ? 'browse.chooseReciterForSurah'
    : 'browse.browseRecitersForSurah';
  // A surahId that is not 1–114 (a bad link) has no surah to name; reading
  // its name used to throw. It opens the plain list instead. @ai
  const surah = surahId ? SURAHS[parseInt(surahId, 10) - 1] : undefined; // @ai
  const title = surah
    ? t(surahTitleKey, {surah: getSurahDisplayName(surah)})
    : t('browse.browseAll');

  // Native header title on glass devices, as on the Home tab's copy. @ai
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
      initialHasPhoto={hasPhoto === '1' || hasPhoto === 'true'}
    />
  );
}
// @ai-end
