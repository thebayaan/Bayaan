// @ai-generated
import {useCallback} from 'react';
import {useTranslation} from 'react-i18next';
import {SURAHS} from '@/data/surahData';
import {getSurahDisplayName} from '@/i18n/format';

/**
 * "Al-Baqarah 2:255" for a Hafs verse key (reader:verseLabel; the Arabic UI
 * gets the Arabic surah name and digits). The key itself if it is not one.
 */
export function useQuranVerseLabel(): (verseKey: string) => string {
  const {t} = useTranslation('reader');
  return useCallback(
    (verseKey: string) => {
      const [surahNumber, ayah] = verseKey.split(':');
      const surah = SURAHS[Number(surahNumber) - 1];
      if (!surah || !ayah) return verseKey;
      return t('verseLabel', {
        surah: getSurahDisplayName(surah),
        surahNumber,
        ayah,
      });
    },
    [t],
  );
}
