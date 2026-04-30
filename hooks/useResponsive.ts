import {useMemo} from 'react';
import {Platform, useWindowDimensions} from 'react-native';
import {PHONE_SCALE_CAP, TABLET_BREAKPOINT} from '@/utils/responsive';

export type Orientation = 'portrait' | 'landscape';

export interface Responsive {
  width: number;
  height: number;
  shortestSide: number;
  orientation: Orientation;
  isTablet: boolean;
  isPhone: boolean;
  /** Width clamped to `PHONE_SCALE_CAP` for size-scaling. */
  scaleWidth: number;
}

/**
 * Live responsive state. Re-renders on rotation / split-view.
 *
 * Phones always receive `isTablet === false`, so gated code paths
 * (sidebar nav, compact player, facing Mushaf pages, etc.) are no-ops
 * on every phone form factor.
 */
export function useResponsive(): Responsive {
  const {width, height} = useWindowDimensions();

  return useMemo(() => {
    const shortestSide = Math.min(width, height);
    const orientation: Orientation = width >= height ? 'landscape' : 'portrait';
    const isIPad =
      Platform.OS === 'ios' && (Platform as {isPad?: boolean}).isPad === true;
    const isTablet = isIPad || shortestSide >= TABLET_BREAKPOINT;

    return {
      width,
      height,
      shortestSide,
      orientation,
      isTablet,
      isPhone: !isTablet,
      scaleWidth: Math.min(width, PHONE_SCALE_CAP),
    };
  }, [width, height]);
}
