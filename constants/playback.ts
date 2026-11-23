// @ai-generated
/** Playback speeds offered by the speed menu and sheet. */
export const PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

/** Sleep timer lengths in minutes. */
export const SLEEP_TIMER_OPTIONS = [5, 15, 30, 45, 60];

/** Minutes the menu marks as chosen: the remaining time within 2 minutes. */
export function selectedTimerOption(
  remaining: number | null,
  chosen: number,
): number | undefined {
  const compare = remaining !== null && remaining > 0 ? remaining : chosen;
  if (compare <= 0) return undefined;
  return SLEEP_TIMER_OPTIONS.find(minutes => Math.abs(compare - minutes) <= 2);
}
