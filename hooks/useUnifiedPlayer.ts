import {useCallback, useEffect, useRef} from 'react';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {Track} from '@/types/audio';
import {PlaybackSettings} from '@/services/player/types/state';

/**
 * Hook to interact with the unified player system
 */
export function useUnifiedPlayer() {
  const store = usePlayerStore();
  const storeRef = useRef(store);

  // Update store ref when store changes
  useEffect(() => {
    storeRef.current = store;
  }, [store]);

  // Memoized actions
  const play = useCallback(async () => {
    await store.play();
  }, [store]);

  const pause = useCallback(async () => {
    await store.pause();
  }, [store]);

  const skipToNext = useCallback(async () => {
    await store.skipToNext();
  }, [store]);

  const skipToPrevious = useCallback(async () => {
    await store.skipToPrevious();
  }, [store]);

  const seekTo = useCallback(
    async (position: number) => {
      await store.seekTo(position);
    },
    [store],
  );

  const setRate = useCallback(
    async (rate: number) => {
      await store.setRate(rate);
    },
    [store],
  );

  const updateQueue = useCallback(
    async (tracks: Track[], startIndex = 0) => {
      await store.updateQueue(tracks, startIndex);
    },
    [store],
  );

  const addToQueue = useCallback(
    async (tracks: Track[]) => {
      await store.addToQueue(tracks);
    },
    [store],
  );

  const removeFromQueue = useCallback(
    async (indices: number[]) => {
      await store.removeFromQueue(indices);
    },
    [store],
  );

  const updateSettings = useCallback(
    (settings: Partial<PlaybackSettings>) => {
      if ('repeatMode' in settings && settings.repeatMode !== undefined) {
        store.setRepeatMode(settings.repeatMode);
      }
      if ('shuffle' in settings) {
        store.toggleShuffle();
      }
      if ('sleepTimer' in settings && settings.sleepTimer !== undefined) {
        store.setSleepTimer(settings.sleepTimer as number);
      }
      if ('skipSilence' in settings) {
        store.toggleSkipSilence();
      }
    },
    [store],
  );

  return {
    // State
    playback: store.playback,
    queue: store.queue,
    loading: store.loading,
    error: store.error,
    settings: store.settings,
    sheetMode: store.sheetMode,
    setSheetMode: store.setSheetMode,

    // Actions
    play,
    pause,
    skipToNext,
    skipToPrevious,
    seekTo,
    setRate,
    updateQueue,
    addToQueue,
    removeFromQueue,

    // Settings Management
    updateSettings,
  };
}
