// @ai-generated
import React, {useRef} from 'react';
import {SheetProps} from 'react-native-actions-sheet';
import ActionSheet from '@/components/sheets/AdaptiveActionSheet';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale} from '@/utils/scale';
import FilterModal, {type FilterOptions} from '@/components/browse/FilterModal';
import {hideSheet} from '@/components/sheets/sheetControl';
import {useSheetBottomPadding} from '@/components/sheets/useSheetBottomPadding';

/**
 * The reciter filters (Browse › Reciters) as a native sheet on iPhone.
 * Resolves with the filters applied, or undefined when it was closed
 * without Apply. iPad and Android keep FilterModal's own presentation.
 */
export const ReciterFiltersSheet = (props: SheetProps<'reciter-filters'>) => {
  const {theme} = useTheme();
  const footerBottomPadding = useSheetBottomPadding(moderateScale(30));
  const applied = useRef<FilterOptions | undefined>(undefined);

  return (
    <ActionSheet
      id={props.sheetId}
      containerStyle={{
        backgroundColor: theme.colors.background,
        height: '82%',
      }}
      gestureEnabled>
      <FilterModal
        embedded={{footerBottomPadding}}
        visible
        theme={theme}
        initialFilters={props.payload?.initialFilters}
        onApplyFilters={filters => {
          applied.current = filters;
        }}
        onClose={() => {
          hideSheet('reciter-filters', {payload: applied.current});
        }}
      />
    </ActionSheet>
  );
};
