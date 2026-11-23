// @ai-generated
import React, {useMemo} from 'react';
import {Platform} from 'react-native';
import {MaterialIcons} from '@expo/vector-icons';
import {SymbolView} from 'expo-symbols';
import {useTranslation} from 'react-i18next';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale} from '@/utils/scale';
import {NativeMenu} from '@/components/native/NativeMenu';
import type {NativeMenuEntry} from '@/components/native/menuTypes';

export type ReciterViewMode = 'card' | 'list';
export type ReciterSortOption = 'asc' | 'desc' | 'revelation';

const SORTS: ReciterSortOption[] = ['asc', 'desc', 'revelation'];

/**
 * The reciter page's view-and-sort button, next to search in the header,
 * as on the Collection screens: Grid or List, the surah order, and Loved
 * only. While Loved only is on, the glyph is filled so the filter shows.
 * Callers render it only where `nativeMenusAvailable`.
 */
export function ReciterViewMenu({
  viewMode,
  sortOption,
  lovedOnly,
  onViewModeChange,
  onSortChange,
  onToggleLovedOnly,
}: {
  viewMode: ReciterViewMode;
  sortOption: ReciterSortOption;
  lovedOnly: boolean;
  onViewModeChange: (mode: ReciterViewMode) => void;
  onSortChange: (sort: ReciterSortOption) => void;
  onToggleLovedOnly: () => void;
}) {
  const {theme} = useTheme();
  const {t} = useTranslation('player');

  const entries = useMemo<NativeMenuEntry[]>(
    () => [
      {
        id: 'view',
        items: [
          {
            id: 'view:card',
            title: t('reciterProfile.menu.grid'),
            systemImage: 'square.grid.2x2',
            checked: viewMode === 'card',
          },
          {
            id: 'view:list',
            title: t('reciterProfile.menu.list'),
            systemImage: 'list.bullet',
            checked: viewMode === 'list',
          },
        ],
      },
      {
        id: 'sort',
        title: t('reciterProfile.menu.sortBy'),
        items: SORTS.map(id => ({
          id: `sort:${id}`,
          title: t(`reciterProfile.menu.${id}`),
          checked: sortOption === id,
        })),
      },
      {
        id: 'filter',
        items: [
          {
            id: 'loved',
            title: t('reciterProfile.menu.lovedOnly'),
            systemImage: lovedOnly ? 'heart.fill' : 'heart',
            checked: lovedOnly,
          },
        ],
      },
    ],
    [viewMode, sortOption, lovedOnly, t],
  );

  const onSelect = (id: string) => {
    const [kind, value] = id.split(':');
    if (kind === 'view' && (value === 'card' || value === 'list')) {
      if (value !== viewMode) onViewModeChange(value);
    } else if (kind === 'sort' && SORTS.includes(value as ReciterSortOption)) {
      onSortChange(value as ReciterSortOption);
    } else if (kind === 'loved') {
      onToggleLovedOnly();
    }
  };

  const size = moderateScale(20);
  return (
    <NativeMenu
      entries={entries}
      onSelect={onSelect}
      accessibilityLabel={t('reciterProfile.menu.label')}>
      {Platform.OS === 'ios' ? (
        <SymbolView
          name={
            lovedOnly
              ? 'line.3.horizontal.decrease.circle.fill'
              : 'line.3.horizontal.decrease'
          }
          size={size}
          tintColor={theme.colors.text}
          weight="medium"
        />
      ) : (
        <MaterialIcons
          name={lovedOnly ? 'filter-list-alt' : 'sort'}
          size={size}
          color={theme.colors.text}
        />
      )}
    </NativeMenu>
  );
}
