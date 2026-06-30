import {Animated} from 'react-native';

/**
 * Shared focus-motion config for the TV focus primitives (FocusableCard and
 * FocusableButton). Tuned for a 10-foot UI where holding the D-pad produces a
 * fast stream of focus / blur events as the cursor sweeps across a row.
 *
 * Why these numbers:
 *  - overshootClamping keeps the scale monotonic toward its target. When a
 *    spring is interrupted mid-flight by the next focus event (D-pad repeat),
 *    an underdamped spring visibly wobbles or double-bounces on every card;
 *    clamping removes that bounce so rapid repeat reads as one smooth sweep.
 *  - stiffness 300 / damping 26 (mass 1) gives a damping ratio near 0.75: a
 *    confident, snappy scale-up that settles in roughly 200ms instead of the
 *    previous loose, springy 18-damping feel (ratio near 0.58).
 *  - The rest thresholds terminate the animation promptly instead of trailing
 *    a long low-amplitude tail, so cards left behind during a fast sweep stop
 *    cleanly rather than micro-animating after blur.
 *
 * Both primitives drive scale with the native driver, so this motion runs on
 * the UI thread and stays smooth even while the JS thread handles focus state.
 */
// Moderate focus scale. Kept small (1.05) so a focused card grows just enough
// to read as "active" at 10 feet without spilling past its rail/grid container
// and getting clipped. Containers still reserve breathing room (padding) for it.
export const focusScaleDefault = 1.05;

export function animateFocusScale(
  value: Animated.Value,
  toValue: number,
): void {
  Animated.spring(value, {
    toValue,
    stiffness: 300,
    damping: 26,
    mass: 1,
    overshootClamping: true,
    restDisplacementThreshold: 0.001,
    restSpeedThreshold: 0.01,
    useNativeDriver: true,
  }).start();
}
