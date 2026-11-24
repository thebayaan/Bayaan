// @ai-generated
import {useCallback, useEffect, useRef, useState} from 'react';
import {createAudioPlayer, AudioPlayer} from 'expo-audio';
import {useFocusEffect} from 'expo-router';
import type {Reciter} from '@/data/reciterData';
import {generateSmartAudioUrl} from '@/utils/audioUtils';
import {usePlayerStore} from '@/services/player/store/playerStore';

const PREVIEW_SURAH = '1';

export interface ReciterPreview {
  /** `${reciterId}:${rewayatId}` of the preview that is playing, or null. */
  playingKey: string | null;
  /** 0–1 through the preview. */
  progress: number;
  toggle: (reciter: Reciter, rewayatId: string) => void;
  stop: () => void;
}

export const previewKey = (reciterId: string, rewayatId: string) =>
  `${reciterId}:${rewayatId}`;

/**
 * Plays Al-Fatihah in a reciter's voice on a throwaway player, so trying a
 * voice never touches the queue. The main player is paused while a preview
 * plays, and the preview stops when the screen loses focus.
 */
export function useReciterPreview(): ReciterPreview {
  const playerRef = useRef<AudioPlayer | null>(null);
  const subscriptionRef = useRef<{remove: () => void} | null>(null);
  const [playingKey, setPlayingKey] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const release = useCallback(() => {
    subscriptionRef.current?.remove();
    subscriptionRef.current = null;
    const player = playerRef.current;
    playerRef.current = null;
    if (player) {
      try {
        player.pause();
        player.remove();
      } catch {
        // The player may already be gone.
      }
    }
  }, []);

  const stop = useCallback(() => {
    release();
    setPlayingKey(null);
    setProgress(0);
  }, [release]);

  const toggle = useCallback(
    (reciter: Reciter, rewayatId: string) => {
      const key = previewKey(reciter.id, rewayatId);
      if (playingKey === key) {
        stop();
        return;
      }
      release();
      setProgress(0);
      setPlayingKey(key);

      const main = usePlayerStore.getState();
      if (main.playback.state === 'playing') {
        main.pause().catch(error => {
          console.warn('[useReciterPreview] Could not pause playback:', error);
        });
      }

      try {
        const player = createAudioPlayer({
          uri: generateSmartAudioUrl(reciter, PREVIEW_SURAH, rewayatId),
        });
        playerRef.current = player;
        subscriptionRef.current = player.addListener(
          'playbackStatusUpdate',
          status => {
            if (status.duration > 0) {
              setProgress(Math.min(1, status.currentTime / status.duration));
            }
            if (status.didJustFinish) stop();
          },
        );
        player.play();
      } catch (error) {
        console.error('[useReciterPreview] Preview failed:', error);
        stop();
      }
    },
    [playingKey, release, stop],
  );

  useFocusEffect(useCallback(() => stop, [stop]));
  useEffect(() => release, [release]);

  return {playingKey, progress, toggle, stop};
}
