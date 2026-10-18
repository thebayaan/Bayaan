import {useTVPlayerStore} from '../store/tvPlayerStore';
import {MEDIA_SEEK_SECONDS, type MediaKey} from './remoteKeys';
import {resumeNewestContinue} from './resumeContinue';

/**
 * Transport commands from outside the app's own key handling: on Vega, the
 * system's media controls (the remote's transport keys and Alexa) arrive as
 * commands rather than key events. Routing them through the player store
 * keeps its rules (retry after an error, play again at the end, nothing while
 * a track is still loading) instead of driving the audio element directly.
 */
export type MediaTransport = {
  toggle: () => void;
  play: () => void;
  pause: () => void;
  next: () => void;
  previous: () => void;
  /** Moves within the surah by `seconds` (negative goes back). */
  seekBy: (seconds: number) => void;
};

// Buffering, and a verse repeat's gap (held), count as playing: they resume
// on their own, so Play has nothing to do and Pause has something to stop.
const isPlaying = (): boolean => {
  const {status, held} = useTVPlayerStore.getState();
  return held || status === 'playing' || status === 'buffering';
};

// Nothing queued (after a relaunch): Play resumes the newest Continue entry,
// as the sidebar tile offers to. True when it was that case.
const resumeWhenEmpty = (): boolean => {
  if (useTVPlayerStore.getState().queue.length > 0) return false;
  resumeNewestContinue('media-key');
  return true;
};

/** The recitation's transport (the player store). */
export const playerTransport: MediaTransport = {
  toggle: () => {
    if (!resumeWhenEmpty()) useTVPlayerStore.getState().toggle();
  },
  play: () => {
    if (resumeWhenEmpty()) return;
    if (!isPlaying()) useTVPlayerStore.getState().toggle();
  },
  pause: () => {
    if (!isPlaying()) return;
    const player = useTVPlayerStore.getState();
    // In the gap, toggle cancels the replay to come and stays paused.
    if (player.held) player.toggle();
    else player.engine?.pause();
  },
  next: () => {
    void useTVPlayerStore.getState().next();
  },
  previous: () => {
    void useTVPlayerStore.getState().prev();
  },
  seekBy: seconds => useTVPlayerStore.getState().seekBy(seconds),
};

/**
 * What an app-wide transport key does to the recitation (see
 * hooks/useGlobalRemoteKeys). Without a queue (after a relaunch), Play
 * resumes the newest Continue entry, as the sidebar tile offers to; the
 * other keys have nothing to act on.
 */
export function applyMediaKey(key: MediaKey): void {
  const player = useTVPlayerStore.getState();
  if (player.queue.length === 0) {
    if (key === 'playPause' || key === 'play') resumeWhenEmpty();
    return;
  }
  switch (key) {
    case 'playPause':
      player.toggle();
      return;
    case 'play':
      playerTransport.play();
      return;
    case 'pause':
      playerTransport.pause();
      return;
    case 'next':
      void player.next();
      return;
    case 'previous':
      void player.prev();
      return;
    case 'fastForward':
      player.seekBy(MEDIA_SEEK_SECONDS);
      return;
    case 'rewind':
      player.seekBy(-MEDIA_SEEK_SECONDS);
      return;
  }
}
