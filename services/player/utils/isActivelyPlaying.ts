// @ai-generated
import type {PlayerState} from '../types/state';

/**
 * Whether the main player counts as playing for its controls: audio is heard
 * ('playing'), or the stream stalled and the player is waiting to carry on by
 * itself ('buffering'). Both show Pause, and a tap pauses.
 *
 * Checking 'playing' alone showed a play button during a stall on iOS; the
 * first tap then called play() again and only the second one paused, and a
 * user who trusted the icon and walked away heard the audio resume.
 *
 * 'loading' is not part of it: a load shows a spinner and locks the
 * transport until it is done.
 */
export function isActivelyPlaying(state: PlayerState): boolean {
  return state === 'playing' || state === 'buffering';
}
