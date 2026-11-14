// @ai-generated

/**
 * Windows this wide are the `large` width class (ipad-standards §2.1): a 13"
 * iPad in landscape, a large Stage Manager window, an external display.
 */
export const HERO_COLUMN_MIN_WINDOW = 1280;

/**
 * Width of the pinned hero column, page margins included. It holds the 240pt
 * photo and keeps Play all, Shuffle, Favorite and Download on one row.
 */
export const HERO_COLUMN_WIDTH = 448;

/**
 * Whether the reciter page pins its hero as a leading column, with the tab
 * bar and the surah list scrolling beside it (ipad-standards §10.2). The
 * class comes from the window, like every other width class.
 */
export function usesHeroColumn(
  isTablet: boolean,
  windowWidth: number,
): boolean {
  return isTablet && windowWidth >= HERO_COLUMN_MIN_WINDOW;
}

/**
 * Top inset of the pinned column, and of the list beside it, so the tab bar
 * starts level with the photo. It matches the hero's top padding at other
 * widths, plus the native header on iOS 26, because the column sits outside
 * the scroll view that used to inset it.
 *
 * It is never less than `stickyPinOffset`. The profile pulls its sticky tab
 * bar section up by that much, and React Native's sticky header needs a
 * layout y of 0 or more (a negative one breaks its scroll interpolation).
 */
export function heroColumnTop({
  isGlass,
  headerHeight,
  safeAreaTop,
  stickyPinOffset,
}: {
  isGlass: boolean;
  headerHeight: number;
  safeAreaTop: number;
  stickyPinOffset: number;
}): number {
  const top = isGlass ? headerHeight + 8 : safeAreaTop + 56;
  return Math.max(top, stickyPinOffset);
}
