// hooks/usePlayback.ts
import {usePlayerStore} from '@/store/playerStore';
import {useQueueStore} from '@/store/queueStore';
import {generateAudioUrl} from '@/utils/audioUtils';
import {Track} from '@/types/audio';
import {Reciter} from '@/data/reciterData';
import {Surah} from '@/data/surahData';
import {getSurahById} from '@/services/dataService';
import TrackPlayer, {
  Event,
  useTrackPlayerEvents,
} from 'react-native-track-player';
import {getReciterById} from '@/services/dataService';
import {useRecentRecitersStore} from '@/store/recentRecitersStore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {QueueManager} from '@/services/QueueManager';

export const usePlayback = () => {
  const {getQueue} = useQueueStore();
  const {addRecentReciter, updateProgress} = useRecentRecitersStore();
  const queueManager = QueueManager.getInstance();
  const loadTrack = usePlayerStore(state => state.loadAndPlayTrack);

  // Constants for queue management
  const INITIAL_BATCH_SIZE = 3; // Load first 3 tracks initially
  const NEXT_BATCH_SIZE = 5; // Load 5 tracks in subsequent batches
  const LOAD_THRESHOLD = 2; // Start loading more when 2 tracks remain

  // Keep existing progress tracking
  useTrackPlayerEvents(
    [
      Event.PlaybackProgressUpdated,
      Event.PlaybackState,
      Event.PlaybackTrackChanged,
    ],
    async event => {
      if (event.type === Event.PlaybackProgressUpdated) {
        const {position} = event;
        const currentTrack = await TrackPlayer.getCurrentTrack();
        if (currentTrack !== null) {
          const track = await TrackPlayer.getTrack(currentTrack);
          if (track && track.reciterId) {
            const duration = await TrackPlayer.getDuration();
            if (duration > 0) {
              const progressValue = position / duration;
              updateProgress(
                track.reciterId,
                parseInt(track.surahId || '0', 10),
                progressValue,
                duration,
              );
            }
          }
        }
      } else if (event.type === Event.PlaybackTrackChanged) {
        // Check if we need to load more tracks
        const queue = await TrackPlayer.getQueue();
        const currentIndex = await TrackPlayer.getCurrentTrack();

        if (
          currentIndex !== null &&
          queue.length - currentIndex <= LOAD_THRESHOLD
        ) {
          await loadNextBatch();
        }
      }
    },
  );

  const playTrack = async (reciter: Reciter, surahId: number) => {
    try {
      const [surah, storedDuration] = await Promise.all([
        getSurahById(surahId),
        AsyncStorage.getItem(`progress_${reciter.id}_${surahId}`),
        AsyncStorage.getItem(`duration_${reciter.id}_${surahId}`),
      ]);

      if (!surah) throw new Error('Surah not found');

      const track: Track = {
        id: `${reciter.id}:${surah.id}`,
        url: generateAudioUrl(reciter, surah.id.toString()),
        title: surah.name,
        artist: reciter.name,
        artwork: reciter.image_url || undefined,
        reciterId: reciter.id,
        reciterName: reciter.name,
        surahId: surah.id.toString(),
        duration: storedDuration ? parseFloat(storedDuration) : undefined,
      };

      await loadTrack(track);

      return track;
    } catch (error) {
      console.error('Error in playTrack:', error);
      throw error;
    }
  };

  const playAll = async (
    reciter: Reciter,
    surahs: Surah[],
    shuffle = false,
  ) => {
    if (surahs.length === 0) return;

    const tracks = createTracksFromSurahs(reciter, surahs);
    await queueManager.playMultipleTracksWithOptions(tracks, {
      shuffle,
      clearQueue: true,
    });
  };

  const playFromSurah = async (
    reciter: Reciter,
    surah: Surah,
    allSurahs: Surah[],
    startPosition?: number,
  ) => {
    try {
      const startIndex = allSurahs.findIndex(s => s.id === surah.id);
      if (startIndex === -1) {
        throw new Error('Surah not found in the list');
      }

      // Get initial batch of tracks
      const initialTracks = createTracksFromSurahs(
        reciter,
        allSurahs.slice(startIndex, startIndex + INITIAL_BATCH_SIZE),
      );

      // Add to recently played
      await addRecentReciter(reciter, surah, 0, 0);

      // Play the first track with the start position
      if (initialTracks.length > 0) {
        const [firstTrack, ...remainingInitialTracks] = initialTracks;
        await queueManager.playTrackWithOptions(firstTrack, {
          startPosition,
          clearQueue: true,
        });

        // Queue the remaining initial tracks if any
        if (remainingInitialTracks.length > 0) {
          await queueManager.addToQueue(remainingInitialTracks);
        }

        // Store queue state for lazy loading
        useQueueStore.getState().setQueueContext({
          nextLoadIndex: startIndex + INITIAL_BATCH_SIZE,
          allSurahs,
          currentReciter: reciter,
        });
      }
    } catch (error) {
      console.error('Error in playFromSurah:', error);
      throw error;
    }
  };

  // Add new function to load next batch of tracks
  const loadNextBatch = async () => {
    const {nextLoadIndex, allSurahs, currentReciter} = useQueueStore.getState();
    const currentTrack = usePlayerStore.getState().currentTrack;

    // Safety checks
    if (!currentReciter || nextLoadIndex >= allSurahs.length) return;
    if (!currentTrack) return;

    // Verify we're still playing from the same reciter
    if (currentTrack.reciterId !== currentReciter.id) {
      // If reciter changed, don't load more tracks
      return;
    }

    const nextTracks = createTracksFromSurahs(
      currentReciter,
      allSurahs.slice(nextLoadIndex, nextLoadIndex + NEXT_BATCH_SIZE),
    );

    if (nextTracks.length > 0) {
      // Only add to queue if we're still playing from the same sequence
      const queue = await TrackPlayer.getQueue();
      const lastTrack = queue[queue.length - 1];

      if (lastTrack && lastTrack.reciterId === currentReciter.id) {
        await queueManager.addToQueue(nextTracks);
        useQueueStore.getState().setQueueContext({
          nextLoadIndex: nextLoadIndex + NEXT_BATCH_SIZE,
          allSurahs,
          currentReciter,
        });
      }
    }
  };

  const playLovedTrack = async (trackId: string, lovedTrackIds: string[]) => {
    try {
      const currentIndex = lovedTrackIds.indexOf(trackId);
      if (currentIndex === -1) return;

      const [reciterId, surahId] = trackId.split(':');
      const reciter = await getReciterById(reciterId);
      const surah = await getSurahById(parseInt(surahId, 10));

      if (!reciter || !surah) {
        console.error('Could not find reciter or surah');
        return;
      }

      await playTrack(reciter, surah.id);
      await getQueue(); // Update queue
    } catch (error) {
      console.error('Error in playLovedTrack:', error);
      const store = usePlayerStore.getState();
      store.setIsPlaying(false);
      store.setIsLoading(false);
      store.setCurrentTrack(null);
      throw error;
    }
  };

  const addToQueue = async (reciter: Reciter, surah: Surah) => {
    const store = usePlayerStore.getState();
    store.setIsLoading(true);

    try {
      // First add to recent history
      await addRecentReciter(reciter, surah, 0, 0);

      const track: Track = {
        id: `${reciter.id}:${surah.id}`,
        url: generateAudioUrl(reciter, surah.id.toString()),
        title: surah.name,
        artist: reciter.name,
        artwork: reciter.image_url || undefined,
        reciterId: reciter.id,
        reciterName: reciter.name,
        surahId: surah.id.toString(),
      };

      // Then play the track
      await queueManager.playTrackWithOptions(track, {clearQueue: true});
      store.setIsLoading(false);
    } catch (error) {
      console.error('Error in addToQueue:', error);
      store.setIsLoading(false);
      throw error;
    }
  };

  const skipTrack = async (index: number) => {
    try {
      await queueManager.skipToTrack(index);
      await TrackPlayer.play();
    } catch (error) {
      console.error('Error in skipTrack:', error);
      throw error;
    }
  };

  const removeTrack = async (index: number) => {
    try {
      await queueManager.removeFromQueue(index);
    } catch (error) {
      console.error('Error in removeTrack:', error);
      throw error;
    }
  };

  // Keep existing helper functions
  const createTracksFromSurahs = (
    reciter: Reciter,
    surahs: Surah[],
  ): Track[] => {
    return surahs.map(surah => ({
      id: `${reciter.id}:${surah.id}`,
      url: generateAudioUrl(reciter, surah.id.toString()),
      title: surah.name,
      artist: reciter.name,
      reciterId: reciter.id,
      artwork: reciter.image_url || undefined,
      surahId: surah.id.toString(),
      reciterName: reciter.name,
    }));
  };

  return {
    playTrack,
    playAll,
    playFromSurah,
    addToQueue,
    skipTrack,
    removeTrack,
    playLovedTrack,
  };
};
