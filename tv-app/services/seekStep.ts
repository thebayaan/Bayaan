/**
 * Left/Right steps for recitations without verse timings. One press moves
 * 15 seconds; pressing again quickly in the same direction moves further
 * (30 s, 1 min, 2 min), so a two-hour surah can be crossed without hundreds
 * of presses.
 */
export const SEEK_STEPS: readonly number[] = [15, 30, 60, 120];
/** Presses closer together than this count as one run. */
export const SEEK_STREAK_MS = 800;
/** Presses in a run before the step grows to the next size. */
const PRESSES_PER_STEP = 2;

/** Returns a function giving the seconds to seek for each press. */
export function createSeekStepper(
  now: () => number = Date.now,
): (direction: 1 | -1) => number {
  let lastAt = -Infinity;
  let lastDirection = 0;
  let streak = 0;
  return direction => {
    const t = now();
    streak =
      t - lastAt < SEEK_STREAK_MS && direction === lastDirection
        ? streak + 1
        : 0;
    lastAt = t;
    lastDirection = direction;
    const level = Math.min(
      SEEK_STEPS.length - 1,
      Math.floor(streak / PRESSES_PER_STEP),
    );
    return direction * SEEK_STEPS[level];
  };
}
