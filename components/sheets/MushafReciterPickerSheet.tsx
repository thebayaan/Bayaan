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
import {useFavoriteRecitersStore} from '@/store/favoriteRecitersStore'; // @ai

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
  // @ai-start: Recent, Favorites and rewayah filters for the Listen sheet
  const recentRewayatIds = useMushafPlayerStore(s => s.recentRewayatIds);
  const favoriteReciters = useFavoriteRecitersStore(s => s.favoriteReciters);
  // @ai-end

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

  // @ai-start
  const rewayahOf = useMemo(
    () =>
      new Map(
        availableReciters.map(r => [
          r.rewayatId,
          getDisplayLabelFromName(r.rewayahName),
        ]),
      ),
    [availableReciters],
  );

  const filters = useMemo(() => {
    const labels = [...new Set(rewayahOf.values())].filter(Boolean);
    return labels.length > 1 ? labels.map(l => ({id: l, label: l})) : [];
  }, [rewayahOf]);

  const filterOf = useCallback(
    (item: ReciterPickerItem) => {
      const label = rewayahOf.get(item.id);
      return label ? [label] : [];
    },
    [rewayahOf],
  );

  const recentIds = useMemo(
    () => recentRewayatIds.filter(id => rewayahOf.has(id)),
    [recentRewayatIds, rewayahOf],
  );

  const favoriteIds = useMemo(() => {
    const fav = new Set(favoriteReciters.map(r => r.id));
    return availableReciters
      .filter(r => fav.has(r.reciterId))
      .map(r => r.rewayatId);
  }, [favoriteReciters, availableReciters]);
  // @ai-end

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
      recentIds={recentIds} // @ai
      favoriteIds={favoriteIds} // @ai
      filters={filters} // @ai
      filterOf={filterOf} // @ai
      footerNote={t('mushafPlayer.untimedNote')} // @ai
    />
  );
};
