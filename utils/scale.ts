/**
 * Tablet-aware size scaling.
 *
 * `react-native-size-matters` scales from a guideline width of 350pt.
 * On an iPad (>= 744pt short side) the library inflates UI ~2x, which
 * is the root cause of the "everything looks too big" iPad complaints.
 *
 * These helpers cap the effective window width at `PHONE_SCALE_CAP`
 * (a large phone) so tablets stop inflating. Phones are unaffected
 * because their window width is already <= `PHONE_SCALE_CAP`.
 *
 * Prefer these over importing directly from `react-native-size-matters`
 * in any new code, and migrate hot paths (floating player, tab bar,
 * constants) to these helpers over time.
 */

import {Dimensions} from 'react-native';
import {PHONE_SCALE_CAP} from '@/utils/responsive';

const GUIDELINE_BASE_WIDTH = 350;
const GUIDELINE_BASE_HEIGHT = 680;

function scaleBase() {
  const {width, height} = Dimensions.get('window');
  const cappedWidth = Math.min(width, PHONE_SCALE_CAP);
  // Use phone-equivalent aspect ratio to keep vertical scale sane on iPad.
  const ratio = cappedWidth / width || 1;
  return {
    width: cappedWidth,
    height: height * ratio,
  };
}

export function scale(size: number): number {
  const {width} = scaleBase();
  return (width / GUIDELINE_BASE_WIDTH) * size;
}

export function verticalScale(size: number): number {
  const {height} = scaleBase();
  return (height / GUIDELINE_BASE_HEIGHT) * size;
}

export function moderateScale(size: number, factor: number = 0.5): number {
  return size + (scale(size) - size) * factor;
}

export const s = scale;
export const vs = verticalScale;
export const ms = moderateScale;
