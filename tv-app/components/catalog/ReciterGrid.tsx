import {FlashList} from '@shopify/flash-list';
import React, {useCallback} from 'react';
import {View} from 'react-native';
import {
  BrowseReciterCard,
  RECITER_CARD_WIDTH,
} from '../browse/BrowseReciterCard';
import {BROWSE_GUTTER, useGridColumns} from '../browse/gridLayout';
import {reciterSubtitle} from '../../services/browseCatalog';
import {spacing} from '../../theme/spacing';
import type {Reciter} from '../../types/reciter';
import {createScaledStyles, scale} from '../../theme/scale';

type Props = {
  reciters: Reciter[];
  onSelect: (r: Reciter) => void;
  /** Give the first portrait initial focus (on screen entry only). */
  focusFirst?: boolean;
  ListEmptyComponent?: React.ReactElement;
};

const CELL_PAD = 13;
const CELL_WIDTH = RECITER_CARD_WIDTH + CELL_PAD * 2;
/** Portrait 184 + name and subtitle lines + the cell's vertical padding. */
const ROW_HEIGHT = 278;

function overrideItemLayout(layout: {span?: number; size?: number}): void {
  layout.span = 1;
  layout.size = scale(ROW_HEIGHT);
}

/** One grid of round reciter portraits, sized to the screen's width. */
export function ReciterGrid({
  reciters,
  onSelect,
  focusFirst,
  ListEmptyComponent,
}: Props): React.ReactElement {
  const numColumns = useGridColumns(CELL_WIDTH);
  const renderItem = useCallback(
    ({item, index}: {item: Reciter; index: number}) => (
      <View style={styles.cell}>
        <BrowseReciterCard
          reciter={item}
          subtitle={reciterSubtitle(item)}
          onSelect={onSelect}
          hasTVPreferredFocus={!!focusFirst && index === 0}
        />
      </View>
    ),
    [onSelect, focusFirst],
  );
  return (
    <FlashList
      key={numColumns}
      data={reciters}
      numColumns={numColumns}
      overrideItemLayout={overrideItemLayout}
      renderItem={renderItem}
      extraData={focusFirst}
      keyExtractor={r => r.id}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      ListEmptyComponent={ListEmptyComponent}
    />
  );
}

const styles = createScaledStyles({
  content: {
    paddingHorizontal: BROWSE_GUTTER - CELL_PAD,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xxl,
  },
  cell: {paddingHorizontal: CELL_PAD, paddingVertical: 12},
});
