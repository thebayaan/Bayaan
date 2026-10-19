/**
 * Spots a recitation that never loads. ExpoAudioService stops waiting for a
 * new source after a few seconds but still calls it ready, and play() then
 * reports "playing" over silence (offline, a dead server). The engine polls
 * the real player; this many polls in a row asked to play with nothing
 * loaded count as a failed load. It is generous, so a slow link that is
 * still loading isn't cut off.
 */
export const UNLOADED_POLLS_FOR_ERROR = 20;

/**
 * The failed load's message. It reads as a connection problem to the store
 * (isNetworkError), which is by far the likeliest cause, so the player shows
 * its offline card with Try again.
 */
export const LOAD_TIMEOUT_MESSAGE = 'The network connection timed out';

export type LoadSample = {
  /** What the app last asked for maps to playing. */
  reportedPlaying: boolean;
  isLoaded: boolean;
};

export function createLoadStallDetector(): (sample: LoadSample) => boolean {
  let unloadedPolls = 0;
  return function neverLoaded(sample: LoadSample): boolean {
    unloadedPolls =
      sample.reportedPlaying && !sample.isLoaded ? unloadedPolls + 1 : 0;
    return unloadedPolls >= UNLOADED_POLLS_FOR_ERROR;
  };
}
