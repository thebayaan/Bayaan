// @ai-start
/**
 * Gesture tuning and decisions for a Moments card.
 *
 * MomentCard wires these into react-native-gesture-handler. Keeping the
 * numbers and the decisions here makes them testable without a device.
 * The functions are worklets so the pan can run them on the UI thread.
 */

/** Longest gap between the two taps of a like, so a single tap is quick. */
export const DOUBLE_TAP_MAX_DELAY_MS = 250;
/** A tap that moves further than this is a swipe, not a tap. */
export const TAP_MAX_DISTANCE = 10;
/** The two taps of a like can land a little apart. */
export const DOUBLE_TAP_MAX_DISTANCE = 30;
/** How long to hold an outer third before 2x starts. */
export const HOLD_MIN_DURATION_MS = 300;
/** Moving further than this before 2x starts lets the list scroll instead. */
export const HOLD_MAX_DISTANCE = 10;
/** The rate while holding. */
export const HOLD_RATE = 2;

/** Leftward drag before the profile pan takes over from taps and holds. */
export const SWIPE_ACTIVE_OFFSET_X = -30;
/** Vertical drift that hands the touch to the list before the pan starts. */
export const SWIPE_FAIL_OFFSET_Y = 15;
/** A slow drag must travel this far left to open the profile. */
export const SWIPE_DISTANCE = 60;
/** A flick can be shorter, as long as it is this fast (points per second). */
export const SWIPE_FLICK_VELOCITY = 500;
/** ...and still at least this long. */
export const SWIPE_FLICK_DISTANCE = 30;
/** How much of the drag the card follows, and how far at most. */
export const SWIPE_FOLLOW_RATIO = 0.3;
export const SWIPE_FOLLOW_MAX = 48;

/**
 * Height under the safe area taken by the Moments header (profile and filter
 * buttons). The card's own gestures skip it, so a tap near those buttons only
 * presses the button. On Android a touch on a button's transparent padding
 * would otherwise also reach the card below it.
 */
export const HEADER_CLEARANCE = 56;

export type Third = 'left' | 'middle' | 'right';

/** Which third of the card a touch at `x` lands in. */
export function thirdAt(x: number, width: number): Third {
  'worklet';
  if (x < width / 3) return 'left';
  if (x > (width * 2) / 3) return 'right';
  return 'middle';
}

/** Holding the left or right third plays at 2x, like Reels. */
export function isHoldZone(x: number, width: number): boolean {
  'worklet';
  return thirdAt(x, width) !== 'middle';
}

export interface PanEnd {
  translationX: number;
  translationY: number;
  velocityX: number;
}

export type SwipeOutcome = 'profile' | 'none';

/**
 * Whether a finished pan opens the reciter's profile: clearly sideways (so a
 * fast vertical flick that drifts left still just scrolls), leftward, and
 * either long enough or a quick flick.
 */
export function classifySwipe({
  translationX,
  translationY,
  velocityX,
}: PanEnd): SwipeOutcome {
  'worklet';
  if (translationX >= 0) return 'none';
  const dx = Math.abs(translationX);
  if (Math.abs(translationY) >= dx / 2) return 'none';
  if (dx >= SWIPE_DISTANCE) return 'profile';
  if (dx >= SWIPE_FLICK_DISTANCE && velocityX <= -SWIPE_FLICK_VELOCITY) {
    return 'profile';
  }
  return 'none';
}

/** How far the card slides with a leftward drag: damped, capped, never right. */
export function swipeFollowOffset(translationX: number): number {
  'worklet';
  if (translationX >= 0) return 0;
  return Math.max(-SWIPE_FOLLOW_MAX, translationX * SWIPE_FOLLOW_RATIO);
}

/** Hit slop that keeps the card's gestures out of the header. */
export function cardGestureHitSlop(topInset: number): {top: number} {
  return {top: -(topInset + HEADER_CLEARANCE)};
}
// @ai-end
