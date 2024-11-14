import {useCallback} from 'react';
import {useQueueStore} from '@/store/queueStore';
import {Reciter} from '@/data/reciterData';
import {Surah} from '@/data/surahData';
import {Track} from '@/types/audio';
import {generateAudioUrl} from '@/utils/audioUtils';

export const useQueueManagement = () => {
  const {
    queue,
    addToQueue: addToQueueStore,
    addNext,
    clearQueue,
    shuffleQueue,
    getQueue,
    skipToTrack,
    removeFromQueue,
  } = useQueueStore();

  const createTrack = (reciter: Reciter, surah: Surah): Track => ({
    id: surah.id.toString(),
    url: generateAudioUrl(reciter, surah.id.toString()),
    title: surah.name,
    artist: reciter.name,
    reciterId: reciter.id,
    artwork: reciter.image_url || undefined,
  });

  const addToQueue = useCallback(
    async (reciter: Reciter, surah: Surah) => {
      const track = createTrack(reciter, surah);
      await addToQueueStore(track);
    },
    [addToQueueStore],
  );

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
    addToQueue,
    addNext,
    clearQueue,
    shuffleQueue,
    getQueue,
    skipToTrack,
    removeFromQueue,
    handleQueuePress,
    handleTrackPress,
    handleRemoveTrack,
    refreshQueue,
  };
};
