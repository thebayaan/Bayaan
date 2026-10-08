import {Dimensions, StyleSheet} from 'react-native';

/**
 * Design-resolution scaling for the 10-foot UI.
 *
 * Every size in the TV app is authored in 1920x1080 design pixels (what tvOS
 * reports for a 1080p screen). Android TV and Fire OS report the same screen
 * as 960x540 dp, and Vega has its own logical resolution, so raw numbers would
 * render at the wrong size off tvOS. `scale()` maps design pixels to the
 * platform's layout units; on tvOS the factor is 1.
 *
 * Mirrors the `scaledPixels` convention in Amazon's multi-TV sample.
 */

const DESIGN_WIDTH = 1920;
const DESIGN_HEIGHT = 1080;

export function computeScaleFactor(width: number, height: number): number {
  if (width <= 0 || height <= 0) return 1;
  return Math.min(width / DESIGN_WIDTH, height / DESIGN_HEIGHT);
}

const window = Dimensions.get('window');
export const scaleFactor = computeScaleFactor(window.width, window.height);

export function scale(designPx: number): number {
  return designPx * scaleFactor;
}

const SCALED_KEYS: ReadonlySet<string> = new Set([
  'width',
  'height',
  'minWidth',
  'minHeight',
  'maxWidth',
  'maxHeight',
  'top',
  'right',
  'bottom',
  'left',
  'start',
  'end',
  'inset',
  'margin',
  'marginTop',
  'marginRight',
  'marginBottom',
  'marginLeft',
  'marginHorizontal',
  'marginVertical',
  'marginStart',
  'marginEnd',
  'padding',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'paddingHorizontal',
  'paddingVertical',
  'paddingStart',
  'paddingEnd',
  'gap',
  'rowGap',
  'columnGap',
  'fontSize',
  'lineHeight',
  'letterSpacing',
  'borderWidth',
  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'borderRadius',
  'borderTopLeftRadius',
  'borderTopRightRadius',
  'borderBottomLeftRadius',
  'borderBottomRightRadius',
  'shadowRadius',
  'textShadowRadius',
  'translateX',
  'translateY',
]);

// Nested objects whose numeric members are lengths (e.g. shadowOffset.width).
const SCALED_OBJECT_KEYS: ReadonlySet<string> = new Set([
  'shadowOffset',
  'textShadowOffset',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function scaleAllNumbers(
  value: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    out[k] = typeof v === 'number' ? scale(v) : v;
  }
  return out;
}

function scaleTransform(value: unknown): unknown {
  if (!Array.isArray(value)) return value;
  return value.map(entry => (isRecord(entry) ? scaleStyle(entry) : entry));
}

export function scaleStyle(
  style: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(style)) {
    if (typeof value === 'number' && SCALED_KEYS.has(key)) {
      out[key] = scale(value);
    } else if (SCALED_OBJECT_KEYS.has(key) && isRecord(value)) {
      out[key] = scaleAllNumbers(value);
    } else if (key === 'transform') {
      out[key] = scaleTransform(value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

/**
 * Drop-in replacement for `StyleSheet.create` that converts design pixels to
 * layout units. Author styles in 1920x1080 design pixels and never pre-scale
 * values passed in here, or they get scaled twice.
 */
export function createScaledStyles<T extends StyleSheet.NamedStyles<T>>(
  styles: T & StyleSheet.NamedStyles<T>,
): T {
  const scaled: Record<string, unknown> = {};
  for (const [name, style] of Object.entries<unknown>(styles)) {
    scaled[name] = isRecord(style) ? scaleStyle(style) : style;
  }
  // The scaled object has exactly the keys and value shapes of `styles`; only
  // numeric magnitudes change, so the input type still describes it.
  return StyleSheet.create(scaled as T);
}
