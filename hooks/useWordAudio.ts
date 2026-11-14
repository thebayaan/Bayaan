// @ai-generated
/**
 * Plays the recording of one word (wordAudioUrl) with its own expo-audio
 * player, as the word sheet did, without touching the main player.
 *
 *  - toggle() plays the word from the start: it releases the previous player
 *    and creates a new one, so there is one player at a time. While the word
 *    is loading or playing, toggle() stops it.
 *  - The state follows the player's status: 'loading' until it plays,
 *    'playing', then 'idle' when it finishes, is paused or is interrupted.
 *    'error' when the player cannot be created or reports a playback error;
 *    toggle() tries again.
 *  - The player and its status subscription are released when the url
 *    changes and on unmount (the subscription is kept in a ref, not patched
 *    onto the player's remove()).
 */
import {useCallback, useEffect, useRef, useState} from 'react';
import {
  createAudioPlayer,
  type AudioPlayer,
  type AudioStatus,
} from 'expo-audio';

export type WordAudioState = 'idle' | 'loading' | 'playing' | 'error';

export interface WordAudio {
  state: WordAudioState;
  toggle: () => void;
}

interface Subscription {
  remove: () => void;
}

export function useWordAudio(url: string | null): WordAudio {
  // The state of the url it was set for: another url starts idle.
  const [status, setStatus] = useState<{
    url: string | null;
    state: WordAudioState;
  }>({url, state: 'idle'});
  const playerRef = useRef<AudioPlayer | null>(null);
  const subscriptionRef = useRef<Subscription | null>(null);

  const release = useCallback(() => {
    const player = playerRef.current;
    const subscription = subscriptionRef.current;
    playerRef.current = null;
    subscriptionRef.current = null;
    try {
      subscription?.remove();
    } catch {
      // Already removed.
    }
    if (!player) return;
    try {
      player.pause();
    } catch {
      // Not loaded yet.
    }
    try {
      player.remove();
    } catch {
      // Already released.
    }
  }, []);

  // A new word starts idle; its player is stopped and released when the
  // word changes and on unmount. (Resetting the stored state also keeps a
  // word from showing a stale state when it comes back: A, B, then A.)
  useEffect(() => {
    setStatus(s => (s.url === url ? s : {url, state: 'idle'}));
    return release;
  }, [url, release]);

  // Until that runs, another url than the stored one is idle.
  const state: WordAudioState = status.url === url ? status.state : 'idle';

  const toggle = useCallback(() => {
    if (!url) return;
    if (state === 'loading' || state === 'playing') {
      release();
      setStatus({url, state: 'idle'});
      return;
    }
    release();
    let player: AudioPlayer;
    try {
      player = createAudioPlayer({uri: url});
    } catch (error) {
      console.warn('[useWordAudio] Could not create the player:', error);
      setStatus({url, state: 'error'});
      return;
    }
    playerRef.current = player;
    let started = false;
    const onStatus = (s: AudioStatus) => {
      // A released player's late updates are ignored.
      if (playerRef.current !== player) return;
      if (s.error) {
        setStatus({url, state: 'error'});
      } else if (s.didJustFinish) {
        started = false;
        setStatus({url, state: 'idle'});
      } else if (s.playing) {
        started = true;
        setStatus({url, state: 'playing'});
      } else if (started) {
        // Paused or interrupted after it started.
        started = false;
        setStatus({url, state: 'idle'});
      }
    };
    try {
      subscriptionRef.current = player.addListener(
        'playbackStatusUpdate',
        onStatus,
      );
      setStatus({url, state: 'loading'});
      player.play();
    } catch (error) {
      console.warn('[useWordAudio] Playback failed:', error);
      release();
      setStatus({url, state: 'error'});
    }
  }, [url, state, release]);

  return {state, toggle};
}
