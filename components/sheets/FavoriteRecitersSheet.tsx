import React, {useCallback, useMemo} from 'react';
import {RECITERS} from '@/data/reciterData';
import {useFavoriteReciters} from '@/hooks/useFavoriteReciters';
import {SheetProps} from 'react-native-actions-sheet';
import {hideSheet} from '@/components/sheets/sheetControl'; // @ai
import {getDisplayLabelFromName} from '@/services/rewayah/RewayahIdentity';
// @ai-start
import {useTranslation} from 'react-i18next';
import {getReciterDisplayName} from '@/i18n/format';
import {
  ReciterPickerSheet,
  type ReciterPickerItem,
} from '@/components/reciter-picker/ReciterPickerSheet';

export const FavoriteRecitersSheet = (
  props: SheetProps<'favorite-reciters'>,
) => {
  const {t} = useTranslation('sheets');
  const {toggleFavorite, favoriteReciters} = useFavoriteReciters();

  const favoriteIds = useMemo(
    () => new Set(favoriteReciters.map(r => r.id)),
    [favoriteReciters],
  );

  const items = useMemo<ReciterPickerItem[]>(
    () =>
      RECITERS.map(reciter => ({
        id: reciter.id,
        name: getReciterDisplayName(reciter),
        imageUrl: reciter.image_url,
        subtitle:
          reciter.rewayat.length > 1
            ? t('favoriteReciters.rewayatCount', {
                count: reciter.rewayat.length,
              })
            : getDisplayLabelFromName(reciter.rewayat[0]?.name),
        searchTerms: [
          reciter.name,
          getReciterDisplayName(reciter, 'ar'),
          ...reciter.rewayat.map(rewaya => rewaya.name ?? ''),
        ],
      })),
    [t],
  );

  const handleSelect = useCallback(
    (item: ReciterPickerItem) => {
      const reciter = RECITERS.find(r => r.id === item.id);
      if (reciter) toggleFavorite(reciter);
    },
    [toggleFavorite],
  );

  return (
    <ReciterPickerSheet
      sheetId={props.sheetId}
      title={t('favoriteReciters.title')}
      subtitle={t('favoriteReciters.selected', {
        count: favoriteReciters.length,
      })}
      items={items}
      selectedIds={favoriteIds}
      onSelect={handleSelect}
      onDone={() => hideSheet('favorite-reciters')}
    />
  );
};
// @ai-end
