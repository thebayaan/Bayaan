import {useCallback, useState} from 'react';
import TrackPlayer, {State} from 'react-native-track-player';
import {Track, toTrackPlayerTrack} from '@/types/audio';

export const usePlayerControls = () => {
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<{
    title: string;
    artist: string;
  } | null>(null);

  const handleError = useCallback((error: unknown, message: string) => {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`${message}: ${errorMessage}`);
  }, []);

  const loadAndPlayTrack = useCallback(
    async (track: Track, startPosition?: number) => {
      try {
        await Promise.all([
          TrackPlayer.reset(),
          TrackPlayer.add([toTrackPlayerTrack(track)]),
        ]);
        if (startPosition !== undefined) {
          await TrackPlayer.seekTo(startPosition);
        }
        await TrackPlayer.play();
        setIsPlayerReady(true);
      } catch (error) {
        handleError(error, 'Failed to load and play track');
        setIsPlayerReady(false);
      }
    },
    [handleError],
  );

  const togglePlayback = useCallback(async () => {
    if (!isPlayerReady) return;
    try {
      const state = await TrackPlayer.getState();
      if (state === State.Playing) {
        await TrackPlayer.pause();
      } else {
        await TrackPlayer.play();
      }
    } catch (error) {
      handleError(error, 'Failed to toggle playback');
    }
  }, [handleError, isPlayerReady]);

  const seekTo = useCallback(
    async (position: number) => {
      if (!isPlayerReady) return;
      try {
        await TrackPlayer.seekTo(position);
      } catch (error) {
        handleError(error, 'Failed to seek');
      }
    },
    [handleError, isPlayerReady],
  );

  const stop = useCallback(async () => {
    if (!isPlayerReady) return;
    try {
      await TrackPlayer.stop();
    } catch (error) {
      handleError(error, 'Failed to stop playback');
    }
  }, [handleError, isPlayerReady]);

  return {
    loadAndPlayTrack,
    togglePlayback,
    seekTo,
    stop,
    isPlayerReady,
    currentTrack,
    setCurrentTrack,
  };
};
