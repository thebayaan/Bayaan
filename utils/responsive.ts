import {Dimensions, Platform} from 'react-native';

/**
 * Static (module-scope) responsive helpers.
 *
 * Use these in files that cannot call hooks (theme constants, service
 * modules, etc.). React components should prefer `useResponsive()` which
 * updates live on rotation / split-view.
 *
 * Phones always fall back to the existing phone code paths because
 * `getIsTablet()` returns `false` on any device whose shortest side is
 * below the tablet breakpoint.
 */

// iPad mini shortest side is 744pt. Use 700 to cover any future edge cases
// while staying safely above the largest phones (e.g. iPhone Pro Max ~430pt).
export const TABLET_BREAKPOINT = 700;

// Guideline "phone width" used for size scaling. On tablet we clamp the
// effective width to this value so UI never inflates past a large phone.
export const PHONE_SCALE_CAP = 430;

export function getWindow() {
  return Dimensions.get('window');
}

export function getShortestSide(): number {
  const {width, height} = getWindow();
  return Math.min(width, height);
}

/**
 * True when running on an iPad or any device wide enough to be a tablet.
 *
 * On iOS we also trust `Platform.isPad` so split-view / Slide Over still
 * report tablet even if the window temporarily shrinks below the breakpoint.
 */
export function getIsTablet(): boolean {
  if (Platform.OS === 'ios' && (Platform as {isPad?: boolean}).isPad) {
    return true;
  }
  return getShortestSide() >= TABLET_BREAKPOINT;
}

/**
 * Clamp the width used by size-scaling helpers so iPad does not inflate.
 * Phones return their own width unchanged because `width <= PHONE_SCALE_CAP`.
 */
export function getScaleWidth(): number {
  const {width} = getWindow();
  return Math.min(width, PHONE_SCALE_CAP);
}
