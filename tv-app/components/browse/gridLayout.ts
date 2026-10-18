import {useWindowDimensions} from 'react-native';
import {SIDEBAR_COLLAPSED_WIDTH} from '../nav/Sidebar';
import {SCREEN_GUTTER} from '../../theme/spacing';
import {scale, scaleFactor} from '../../theme/scale';

/** Side padding of the browse screens, in design pixels. */
export const BROWSE_GUTTER = SCREEN_GUTTER;

/**
 * How many cells of `cellWidth` design pixels fit across a root browse
 * screen (beside the folded sidebar, inside the side gutters).
 */
export function useGridColumns(
  cellWidth: number,
  options: {withSidebar?: boolean; min?: number} = {},
): number {
  const {withSidebar = true, min = 3} = options;
  const {width} = useWindowDimensions();
  const designWidth =
    width / scaleFactor -
    (withSidebar ? SIDEBAR_COLLAPSED_WIDTH : 0) -
    BROWSE_GUTTER * 2;
  return Math.max(min, Math.floor(designWidth / cellWidth));
}

/**
 * A FlashList `overrideItemLayout` that states its cells' height, in design
 * pixels. FlashList v2 measures cells itself and ignores the size, but
 * Vega's v1 port takes the first cell's size as its estimatedItemSize
 * (tv-vega/shims/flash-list.tsx); without one it lays the first frame out
 * from a guess, so grids jump and a preferred-focus cell can land
 * off-screen. Every FlashList passes one.
 */
export function cellHeightLayout(
  designHeight: number,
): (layout: {span?: number; size?: number}) => void {
  const size = scale(designHeight);
  return layout => {
    layout.size = size;
  };
}
