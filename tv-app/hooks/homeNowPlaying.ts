/**
 * Home's "Now playing" entry, at the top of the hero whenever the player
 * holds a track, so the player is one press from Home. What it says and
 * what OK does follow the player's state, like the sidebar tile. Pure, so
 * it is unit-tested.
 */
import type {PlayerStatus} from '../types/player';

/** What OK does besides opening the player. */
export type NowPlayingAction = 'open' | 'resume' | 'replay' | 'retry';

export type NowPlayingView = {
  /** The sky label above the title. */
  kicker: string;
  /** The hint at the end of the entry, naming what OK does. */
  hint: string;
  action: NowPlayingAction;
};

export function nowPlayingView({
  status,
  finished,
  pending,
}: {
  status: PlayerStatus;
  finished: boolean;
  pending: boolean;
}): NowPlayingView {
  if (status === 'error') {
    return {kicker: "COULDN'T PLAY", hint: 'Try again', action: 'retry'};
  }
  if (pending || status === 'loading' || status === 'buffering') {
    return {kicker: 'LOADING', hint: 'Open player', action: 'open'};
  }
  if (finished) {
    return {kicker: 'FINISHED', hint: 'Play again', action: 'replay'};
  }
  if (status === 'playing') {
    return {kicker: 'NOW PLAYING', hint: 'Open player', action: 'open'};
  }
  // Paused, or stopped by something else (idle with a track in hand).
  return {kicker: 'PAUSED', hint: 'Resume', action: 'resume'};
}
