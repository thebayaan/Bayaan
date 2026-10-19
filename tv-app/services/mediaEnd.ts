/**
 * At the natural end of a track an HTMLMediaElement-style player (Vega's W3C
 * media) fires `pause` and then `ended`. Taken at its word, that pause turns
 * the end into playing -> paused -> idle, which the player store doesn't
 * count as a finished track (no next surah, no repeat, no "sleep at end of
 * surah"). A pause this close to the end is the end arriving, not a pause.
 */
export const END_PAUSE_WINDOW_SECONDS = 0.5;

export function isEndOfMediaPause(
  positionSeconds: number,
  durationSeconds: number,
  ended: boolean = false,
): boolean {
  if (ended) return true;
  return (
    durationSeconds > 0 &&
    positionSeconds >= durationSeconds - END_PAUSE_WINDOW_SECONDS
  );
}
