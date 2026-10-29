// @ai-generated
import type {GestureResponderEvent} from 'react-native';

export interface TouchPoint {
  x: number;
  y: number;
}

/** How long a touch stays the anchor for whatever it opened. */
const TOUCH_MAX_AGE_MS = 1500;

let last: (TouchPoint & {at: number}) | null = null;

/**
 * Root `onTouchStart`: remembers where the window was last touched, so an
 * iPad menu can open beside the button that showed it (see
 * AdaptiveActionSheet) without every caller passing its button's position.
 */
export function recordTouch(event: GestureResponderEvent): void {
  const {pageX, pageY} = event.nativeEvent;
  last = {x: pageX, y: pageY, at: Date.now()};
}

/** The last touch in window points, or null once it is too old to be the one that opened what is showing now. */
export function getRecentTouch(
  now: number = Date.now(),
  maxAgeMs: number = TOUCH_MAX_AGE_MS,
): TouchPoint | null {
  return last && now - last.at <= maxAgeMs ? {x: last.x, y: last.y} : null;
}
