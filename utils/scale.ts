// @ai-generated
/**
 * Tablet-aware size scaling. Drop-in replacement for `react-native-size-matters`.
 *
 * `react-native-size-matters` scales from a 350x680pt guideline phone using
 * the device's short and long sides. On an iPad that inflates UI 1.7–3x,
 * which is the root cause of the "everything looks too big" iPad complaints.
 *
 * These helpers use the same formulas, but a tablet is scaled as if it were
 * a large phone (`PHONE_SCALE_CAP` x `TABLET_SCALE_LONG_SIDE`). Tablets get
 * real-point sizes and add density through layout instead (see
 * docs/design/ipad-standards.md §3). Phones read the same window sides the
 * library read, so every phone size is unchanged.
 *
 * Import from here, never from `react-native-size-matters`.
 */

import {
  Dimensions,
  StyleSheet,
  type ImageStyle,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import {PHONE_SCALE_CAP, getIsTablet} from '@/utils/responsive';

const GUIDELINE_BASE_WIDTH = 350;
const GUIDELINE_BASE_HEIGHT = 680;

// Long side of the large phone a tablet is scaled as (iPhone Pro Max class).
export const TABLET_SCALE_LONG_SIDE = 932;

type ScaleSides = {shortSide: number; longSide: number};

export function getScaleSides(
  width: number,
  height: number,
  isTablet: boolean,
): ScaleSides {
  if (isTablet) {
    return {shortSide: PHONE_SCALE_CAP, longSide: TABLET_SCALE_LONG_SIDE};
  }
  return {
    shortSide: Math.min(width, height),
    longSide: Math.max(width, height),
  };
}

// Read once at startup, like the library, so sizes don't change on rotation.
const window = Dimensions.get('window');
const {shortSide, longSide} = getScaleSides(
  window.width,
  window.height,
  getIsTablet(),
);

export function scale(size: number): number {
  return (shortSide / GUIDELINE_BASE_WIDTH) * size;
}

export function verticalScale(size: number): number {
  return (longSide / GUIDELINE_BASE_HEIGHT) * size;
}

export function moderateScale(size: number, factor = 0.5): number {
  return size + (scale(size) - size) * factor;
}

export function moderateVerticalScale(size: number, factor = 0.5): number {
  return size + (verticalScale(size) - size) * factor;
}

export const s = scale;
export const vs = verticalScale;
export const ms = moderateScale;
export const mvs = moderateVerticalScale;

// `ScaledSheet` string units, same syntax as the library:
// '16@s', '12@vs', '14@ms', '14@ms0.3', '8@mvs', and an optional trailing
// `r` to round ('16@sr').
const SCALE_ANNOTATION =
  /^(-?\d+(?:\.\d{1,3})?)@(mv?s(\d+(?:\.\d{1,2})?)?|s|vs)r?$/;

function scaleAnnotation(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }
  const match = SCALE_ANNOTATION.exec(value);
  if (!match) {
    return value;
  }
  const size = parseFloat(match[1]);
  const factorText = match[3];
  const unit = factorText ? match[2].slice(0, -factorText.length) : match[2];
  const factor = factorText ? parseFloat(factorText) : undefined;

  let result: number;
  switch (unit) {
    case 's':
      result = scale(size);
      break;
    case 'vs':
      result = verticalScale(size);
      break;
    case 'ms':
      result = moderateScale(size, factor);
      break;
    default:
      result = moderateVerticalScale(size, factor);
  }
  return value.endsWith('r') ? Math.round(result) : result;
}

function deepScale(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(deepScale);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, deepScale(item)]),
    );
  }
  return scaleAnnotation(value);
}

// Lets string units sit where StyleSheet expects numbers, as in the library.
type Scale = `${number}@s${'r' | ''}`;
type VerticalScale = `${number}@vs${'r' | ''}`;
type ModerateScale = `${number}@ms${number | ''}${'r' | ''}`;
type ModerateVerticalScale = `${number}@mvs${number | ''}${'r' | ''}`;
type Size = Scale | VerticalScale | ModerateScale | ModerateVerticalScale;
type WithSize<T> = {[P in keyof T]: number extends T[P] ? Size | T[P] : T[P]};
type ScaledNamedStyles<T> = {
  [P in keyof T]:
    | WithSize<ViewStyle>
    | WithSize<TextStyle>
    | WithSize<ImageStyle>;
};
type ScaledResult<T> = {
  [P in keyof T]: {
    [S in keyof T[P]]: T[P][S] extends Size ? number : T[P][S];
  };
};

export const ScaledSheet = {
  create<T extends ScaledNamedStyles<T> | ScaledNamedStyles<any>>(
    styles: T,
  ): ScaledResult<T> {
    const scaled = deepScale(styles) as Record<string, ViewStyle>;
    return StyleSheet.create(scaled) as unknown as ScaledResult<T>;
  },
};
