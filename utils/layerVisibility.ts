// @ai-generated
import type {ViewProps} from 'react-native';

/**
 * Props for one of several stacked layers that all stay mounted while only
 * one is shown (for example two lists behind a tab selector).
 *
 * `opacity: 0` hides a layer visually, but VoiceOver and TalkBack still
 * read it and can focus its rows. Spread these on each layer (next to its
 * opacity style) so a hidden layer also leaves the accessibility tree and
 * stops taking touches.
 */
export function layerVisibilityProps(
  visible: boolean,
): Pick<
  ViewProps,
  'pointerEvents' | 'accessibilityElementsHidden' | 'importantForAccessibility'
> {
  return {
    pointerEvents: visible ? 'auto' : 'none',
    accessibilityElementsHidden: !visible,
    importantForAccessibility: visible ? 'auto' : 'no-hide-descendants',
  };
}
