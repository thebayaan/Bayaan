/**
 * Spots a pause the app didn't make. ExpoAudioService only changes state
 * when the app calls it, so when the system stops the player (another app
 * takes the audio, the TV's own controls, an HDMI-CEC pause) it keeps saying
 * "playing" and the UI would too. The engine polls the real player; two polls
 * in a row with it stopped mid-track, loaded and not buffering, count as a
 * pause. One poll is not enough: right after play() the player can take a
 * moment to report that it is playing.
 */
export const STOPPED_POLLS_FOR_PAUSE = 2;

export type PlayerSample = {
  /** What the app last asked for maps to playing. */
  reportedPlaying: boolean;
  /** The native player is actually playing. */
  isPlaying: boolean;
  isBuffering: boolean;
  isLoaded: boolean;
};

export function createPauseDetector(): (sample: PlayerSample) => boolean {
  let stoppedPolls = 0;
  return function pausedBehindOurBack(sample: PlayerSample): boolean {
    const stopped =
      sample.reportedPlaying &&
      sample.isLoaded &&
      !sample.isPlaying &&
      !sample.isBuffering;
    stoppedPolls = stopped ? stoppedPolls + 1 : 0;
    return stoppedPolls >= STOPPED_POLLS_FOR_PAUSE;
  };
}
