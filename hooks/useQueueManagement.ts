import {useCallback} from 'react';
import {Track} from '@/types/audio';
import {QueueManager} from '@/services/QueueManager';
import {usePlayerStore} from '@/store/playerStore';

export const useQueueManagement = () => {
  const queueManager = QueueManager.getInstance();
  const queue = usePlayerStore(state => state.queue);

  const addToQueue = useCallback(
    async (track: Track) => {
      await queueManager.addToQueue(track);
    },
    [queueManager],
  );

  const removeFromQueue = useCallback(
    async (index: number) => {
      await queueManager.removeFromQueue(index);
    },
    [queueManager],
  );

  const clearQueue = useCallback(async () => {
    await queueManager.clearQueue();
  }, [queueManager]);

  const skipToTrack = useCallback(
    async (index: number) => {
      await queueManager.skipToTrack(index);
    },
    [queueManager],
  );

  const playTrack = useCallback(
    async (track: Track, startPosition?: number) => {
      await queueManager.playTrackWithOptions(track, {startPosition});
    },
    [queueManager],
  );

  const playMultipleTracks = useCallback(
    async (tracks: Track[], startIndex = 0) => {
      await queueManager.playMultipleTracksWithOptions(tracks, {startIndex});
    },
    [queueManager],
  );

  return {
    queue,
    addToQueue,
    removeFromQueue,
    clearQueue,
    skipToTrack,
    playTrack,
    playMultipleTracks,
  };
};
