// @ai-generated
// Dhikr cards two to a row on a wide iPad pane. A dhikr card is reading
// content, so below the expanded width class the lists keep one card per row
// in the 720pt column (ipad-standards §2, §5.3).
import React, {useMemo} from 'react';
import {View} from 'react-native';
import {useResponsive} from '@/hooks/useResponsive';
import {MaxWidthContainer} from '@/components/layout/MaxWidthContainer';
import {pageSpacing, type PageSpacing} from '@/utils/gridLayout';

/** Window width from which the cards pair up: the expanded class. */
export const DHIKR_PAIRS_MIN_WIDTH = 900;

export interface DhikrColumns {
  columns: number;
  /** Margins and gutter for the paired rows, null for one card per row. */
  spacing: PageSpacing | null;
}

export function dhikrColumns(
  isTablet: boolean,
  windowWidth: number,
): DhikrColumns {
  if (!isTablet || windowWidth < DHIKR_PAIRS_MIN_WIDTH) {
    return {columns: 1, spacing: null};
  }
  return {columns: 2, spacing: pageSpacing(windowWidth)};
}

export function useDhikrColumns(): DhikrColumns {
  const {isTablet, width} = useResponsive();
  return useMemo(() => dhikrColumns(isTablet, width), [isTablet, width]);
}

/** The row that holds card `index` when rows hold `columns` cards. */
export function rowOf(index: number, columns: number): number {
  return Math.floor(index / columns);
}

/** Splits a list into rows of `columns` items; the last row may be short. */
export function chunkRows<T>(items: readonly T[], columns: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += columns) {
    rows.push(items.slice(i, i + columns));
  }
  return rows;
}

/**
 * Screen layout for a dhikr list route: the whole pane when the cards pair
 * up, the capped column otherwise. Phones get the screen unchanged.
 */
export function DhikrListWidth({children}: {children: React.ReactNode}) {
  const {spacing} = useDhikrColumns();
  return spacing ? (
    <>{children}</>
  ) : (
    <MaxWidthContainer>{children}</MaxWidthContainer>
  );
}

/**
 * One row of cards. Cards stretch to the tallest in the row; a short last
 * row keeps its card at column width.
 */
export function DhikrCardRow({
  spacing,
  columns,
  children,
}: {
  spacing: PageSpacing;
  columns: number;
  children: React.ReactElement[];
}) {
  const missing = Math.max(0, columns - children.length);
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: spacing.gap,
        paddingHorizontal: spacing.margin,
        marginBottom: spacing.gap,
      }}>
      {children}
      {Array.from({length: missing}, (_, i) => (
        <View key={`empty-${i}`} style={{flex: 1}} />
      ))}
    </View>
  );
}
