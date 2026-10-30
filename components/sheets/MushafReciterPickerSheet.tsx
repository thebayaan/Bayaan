// @ai-generated
import React, {useCallback, useEffect, useMemo} from 'react';
import {SheetProps} from 'react-native-actions-sheet';
import {useTranslation} from 'react-i18next';
import {useMushafPlayerStore} from '@/store/mushafPlayerStore';
import {getReciterDisplayName} from '@/i18n/format';
import {getDisplayLabelFromName} from '@/services/rewayah/RewayahIdentity';
import {
  ReciterPickerSheet,
  type ReciterPickerItem,
} from '@/components/reciter-picker/ReciterPickerSheet';
import {getStyleLabel} from './sheetLabels';
import {hideSheet} from '@/components/sheets/sheetControl'; // @ai

/**
 * Single-select reciter picker for Mushaf playback. Lists only rewayat that
 * have verse timestamps, one row per rewayah, and resolves the chosen
 * AvailableReciter through SheetManager.show's return value.
 */
export const MushafReciterPickerSheet = (
  props: SheetProps<'mushaf-reciter-picker'>,
) => {
  const {t} = useTranslation('sheets');
  const availableReciters = useMushafPlayerStore(s => s.availableReciters);
  const selectedRewayatId = props.payload?.selectedRewayatId ?? null;

  useEffect(() => {
    if (availableReciters.length === 0) {
      useMushafPlayerStore.getState().computeAvailableReciters();
    }
  }, [availableReciters.length]);

  const items = useMemo<ReciterPickerItem[]>(
    () =>
      availableReciters.map(reciter => ({
        id: reciter.rewayatId,
        name: getReciterDisplayName({
          id: reciter.reciterId,
          name: reciter.reciterName,
        }),
        imageUrl: reciter.imageUrl,
        subtitle: [
          getDisplayLabelFromName(reciter.rewayahName),
          getStyleLabel(reciter.style),
        ]
          .filter(Boolean)
          .join(' · '),
        searchTerms: [
          reciter.reciterName,
          getReciterDisplayName(
            {id: reciter.reciterId, name: reciter.reciterName},
            'ar',
          ),
          reciter.rewayahName,
        ],
      })),
    [availableReciters],
  );

  const selectedIds = useMemo(
    () => new Set(selectedRewayatId ? [selectedRewayatId] : []),
    [selectedRewayatId],
  );

  const handleSelect = useCallback(
    (item: ReciterPickerItem) => {
      const reciter = availableReciters.find(r => r.rewayatId === item.id);
      hideSheet('mushaf-reciter-picker', {payload: reciter});
    },
    [availableReciters],
  );

  return (
    <ReciterPickerSheet
      sheetId={props.sheetId}
      title={t('selectReciter.title')}
      subtitle={t('mushafPlayer.reciterPickerSubtitle')}
      items={items}
      selectedIds={selectedIds}
      onSelect={handleSelect}
    />
  );
};
