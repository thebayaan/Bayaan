import {useTVPlayerStore} from '../store/tvPlayerStore';
import {MEDIA_SEEK_SECONDS, type MediaKey} from './remoteKeys';

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
};

// Buffering counts as playing: it resumes on its own, so Play has nothing to
// do and Pause has something to stop.
const isPlaying = (): boolean => {
  const {status} = useTVPlayerStore.getState();
  return status === 'playing' || status === 'buffering';
};

/** The recitation's transport (the player store). */
export const playerTransport: MediaTransport = {
  toggle: () => useTVPlayerStore.getState().toggle(),
  play: () => {
    if (!isPlaying()) useTVPlayerStore.getState().toggle();
  },
  pause: () => {
    if (isPlaying()) useTVPlayerStore.getState().engine?.pause();
  },
  next: () => {
    void useTVPlayerStore.getState().next();
  },
  previous: () => {
    void useTVPlayerStore.getState().prev();
  },
};

/**
 * What an app-wide transport key does to the recitation (see
 * hooks/useGlobalRemoteKeys). Nothing without a queue.
 */
export function applyMediaKey(key: MediaKey): void {
  const player = useTVPlayerStore.getState();
  if (player.queue.length === 0) return;
  switch (key) {
    case 'playPause':
      player.toggle();
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
