import {useCallback} from 'react';
import {useQueueStore} from '@/store/queueStore';

export const useQueueManagement = () => {
  const {
    queue,
    addToQueue,
    addNext,
    clearQueue,
    shuffleQueue,
    getQueue,
    skipToTrack,
    removeFromQueue,
  } = useQueueStore();

  const refreshQueue = useCallback(async () => {
    await getQueue();
  }, [getQueue]);

  const handleQueuePress = useCallback(async () => {
    await refreshQueue();
  }, [refreshQueue]);

  const handleTrackPress = useCallback(
    async (trackId: string) => {
      const index = queue.findIndex(track => track.id === trackId);
      if (index !== -1) {
        await skipToTrack(index);
      }
    },
    [queue, skipToTrack],
  );

  const handleRemoveTrack = useCallback(
    async (trackId: string) => {
      const index = queue.findIndex(track => track.id === trackId);
      if (index !== -1) {
        await removeFromQueue(index);
      }
    },
    [queue, removeFromQueue],
  );

  return {
    queue,
    handleQueuePress,
    handleTrackPress,
    handleRemoveTrack,
    refreshQueue,
    addToQueue,
    addNext,
    clearQueue,
    shuffleQueue,
    skipToTrack,
    removeFromQueue,
  };
};
