// @ai-generated
export interface GridLayoutOptions {
  /** Smallest card width before a column is dropped. */
  minCardWidth: number;
  /** Padding on each side of the grid (applied twice). */
  horizontalPadding: number;
  /** Space between two cards in a row. */
  gap: number;
  /** Never show fewer columns than this. */
  minColumns?: number;
}

export interface GridLayout {
  numColumns: number;
  itemWidth: number;
}

/**
 * Columns and card width for a grid that fills `containerWidth`.
 *
 * Pass the width of the grid's own container (from `onLayout`), not the
 * window: on iPad the grid sits beside a sidebar inside a capped column, so
 * window-based math overflows the container and clips the last column.
 */
export function computeGridLayout(
  containerWidth: number,
  {minCardWidth, horizontalPadding, gap, minColumns = 1}: GridLayoutOptions,
): GridLayout {
  const innerWidth = Math.max(0, containerWidth - horizontalPadding * 2);
  const fit = Math.floor((innerWidth + gap) / (minCardWidth + gap));
  const numColumns = Math.max(minColumns, fit, 1);
  const itemWidth = Math.max(
    0,
    (innerWidth - gap * (numColumns - 1)) / numColumns,
  );
  return {numColumns, itemWidth};
}

export interface ShelfLayoutOptions {
  /** Smallest card width before a card is dropped from view. */
  minCardWidth: number;
  /** Padding before the first card. The shelf scrolls to the trailing edge. */
  leadingPadding: number;
  /** Space between two cards. */
  gap: number;
  /** Fraction of the next card left showing at the trailing edge. */
  peek: number;
  /** Never show fewer whole cards than this. */
  minColumns?: number;
}

/**
 * Card width for a horizontal shelf: whole cards across `containerWidth`
 * plus a `peek` of the next one, so the shelf reads as scrollable.
 *
 * As with `computeGridLayout`, pass the shelf's own container width.
 */
export function computeShelfLayout(
  containerWidth: number,
  {minCardWidth, leadingPadding, gap, peek, minColumns = 1}: ShelfLayoutOptions,
): GridLayout {
  const visibleWidth = Math.max(0, containerWidth - leadingPadding);
  const fit = Math.floor(
    (visibleWidth - peek * minCardWidth) / (minCardWidth + gap),
  );
  const numColumns = Math.max(minColumns, fit, 1);
  const itemWidth = Math.max(
    0,
    (visibleWidth - gap * numColumns) / (numColumns + peek),
  );
  return {numColumns, itemWidth};
}

export interface PageSpacing {
  /** Space between the pane's edge and the content. */
  margin: number;
  /** Space between two cards. */
  gap: number;
}

/**
 * Page margin and gutter for the window's width class (ipad-standards §5.2):
 * medium below 900pt, expanded below 1280pt, large from there.
 */
export function pageSpacing(windowWidth: number): PageSpacing {
  if (windowWidth >= 1280) return {margin: 40, gap: 24};
  if (windowWidth >= 900) return {margin: 32, gap: 20};
  return {margin: 24, gap: 16};
}
