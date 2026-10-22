// @ai-start
/**
 * Light in-session feedback for the Moments feed.
 *
 * Each reciter carries a weight multiplier for the rest of the session. A
 * quick skip lowers it; finishing a moment, liking it, favoriting the reciter
 * or tapping Continue raises it a little. Only that reciter's weight changes,
 * and `buildFeed` reads the multipliers through `FeedOptions.adjustments`.
 */

/** Reciter id to a weight multiplier. Missing means 1. */
export type FeedAdjustments = Readonly<Record<string, number>>;

export type FeedbackSignal = 'skip' | 'positive';

/** A swipe away before this much listening counts as a skip. */
export const QUICK_SKIP_MS = 4_000;
export const SKIP_FACTOR = 0.5;
export const POSITIVE_FACTOR = 1.15;
export const MIN_ADJUSTMENT = 0.125;
export const MAX_ADJUSTMENT = 2;

/** Returns new adjustments with one reciter's multiplier moved by a signal. */
export function applyFeedback(
  adjustments: FeedAdjustments,
  reciterId: string,
  signal: FeedbackSignal,
): FeedAdjustments {
  const current = adjustments[reciterId] ?? 1;
  const factor = signal === 'skip' ? SKIP_FACTOR : POSITIVE_FACTOR;
  const next = Math.min(
    MAX_ADJUSTMENT,
    Math.max(MIN_ADJUSTMENT, current * factor),
  );
  return {...adjustments, [reciterId]: next};
}

/** The signal a finished card gives, if any. */
export function signalForEnd(
  reason: 'completed' | 'swiped' | 'left',
  listenedMs: number,
): FeedbackSignal | null {
  if (reason === 'completed') return 'positive';
  if (reason === 'swiped' && listenedMs < QUICK_SKIP_MS) return 'skip';
  return null;
}
// @ai-end
