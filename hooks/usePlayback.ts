// hooks/usePlayback.ts
import {usePlayerStore} from '@/store/playerStore';
import {useQueueStore} from '@/store/queueStore';
import {generateSmartAudioUrl} from '@/utils/audioUtils';
import {getReciterArtwork} from '@/utils/artworkUtils';
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
import debounce from 'lodash/debounce';
import {useUnifiedPlayer} from '@/hooks/useUnifiedPlayer';
import {useDownloadStore} from '@/services/player/store/downloadStore';

// Queue state management
const QueueState = {
  INITIALIZING: 'initializing',
  READY: 'ready',
  LOADING_BATCH: 'loading_batch',
} as const;

type QueueStateType = (typeof QueueState)[keyof typeof QueueState];

// Debug counters
let playFromSurahCount = 0;
let loadNextBatchCount = 0;
let trackChangedCount = 0;

export const usePlayback = () => {
  const {getQueue} = useQueueStore();
  const {addRecentReciter, updateProgress} = useRecentRecitersStore();
  const queueManager = QueueManager.getInstance();
  const loadTrack = usePlayerStore(state => state.loadAndPlayTrack);
  useUnifiedPlayer();

  // Queue state management
  let queueState: QueueStateType = QueueState.READY;
  let isLoadingBatch = false;

  // Constants for queue management
  const INITIAL_BATCH_SIZE = 3;
  const NEXT_BATCH_SIZE = 5;
  const LOAD_THRESHOLD = 2;

  // Helper function to check if a surah is available for a reciter
  const isSurahAvailable = (reciter: Reciter, surahId: number): boolean => {
    const rewayat = reciter.rewayat[0];
    if (!rewayat || !rewayat.surah_list) return false;

    // Check if the surah exists in the list
    return rewayat.surah_list.includes(surahId);
  };

  // Helper function to get next available surahs up to a limit
  const getNextAvailableSurahs = (
    reciter: Reciter,
    allSurahs: Surah[],
    startIndex: number,
    limit: number,
  ): Surah[] => {
    const result: Surah[] = [];
    let currentIndex = startIndex;

    while (result.length < limit && currentIndex < allSurahs.length) {
      if (isSurahAvailable(reciter, allSurahs[currentIndex].id)) {
        result.push(allSurahs[currentIndex]);
      }
      currentIndex++;
    }

    return result;
  };

  // Debounced loadNextBatch to prevent rapid consecutive calls
  const debouncedLoadNextBatch = debounce(async () => {
    if (queueState !== QueueState.READY) {
      console.log(
        `[DEBUG] Skipping loadNextBatch - Queue state: ${queueState}`,
      );
      return;
    }

    if (isLoadingBatch) {
      console.log('[DEBUG] loadNextBatch - Skipped: Already loading a batch');
      return;
    }

    loadNextBatchCount++;
    console.log(`[DEBUG] loadNextBatch called #${loadNextBatchCount}`);

    try {
      queueState = QueueState.LOADING_BATCH;
      isLoadingBatch = true;

      const {nextLoadIndex, allSurahs, currentReciter} =
        useQueueStore.getState();
      const currentTrack = usePlayerStore.getState().currentTrack;
      console.log(
        `[DEBUG] Current state - nextLoadIndex: ${nextLoadIndex}, currentReciter: ${currentReciter?.name}`,
      );

      // Safety checks
      if (!currentReciter || nextLoadIndex >= allSurahs.length) {
        console.log(
          '[DEBUG] loadNextBatch - Early return: no reciter or at end of surahs',
        );
        return;
      }
      if (!currentTrack) {
        console.log('[DEBUG] loadNextBatch - Early return: no current track');
        return;
      }

      // Verify we're still playing from the same reciter
      if (currentTrack.reciterId !== currentReciter.id) {
        console.log('[DEBUG] loadNextBatch - Early return: reciter changed');
        return;
      }

      // Get next batch of available surahs
      const nextSurahs = getNextAvailableSurahs(
        currentReciter,
        allSurahs,
        nextLoadIndex,
        NEXT_BATCH_SIZE,
      );

      if (nextSurahs.length > 0) {
        const nextTracks = createTracksFromSurahs(currentReciter, nextSurahs);
        console.log(`[DEBUG] Next batch size: ${nextTracks.length} tracks`);

        // Only add to queue if we're still playing from the same sequence
        const queue = await TrackPlayer.getQueue();
        const lastTrack = queue[queue.length - 1];
        console.log(
          `[DEBUG] Current queue length before adding: ${queue.length}`,
        );

        if (lastTrack && lastTrack.reciterId === currentReciter.id) {
          await queueManager.addToQueue(nextTracks);
          useQueueStore.getState().setQueueContext({
            nextLoadIndex: nextLoadIndex + nextSurahs.length,
            allSurahs,
            currentReciter,
          });
          console.log(
            `[DEBUG] Added ${
              nextTracks.length
            } tracks to queue. New nextLoadIndex: ${
              nextLoadIndex + nextSurahs.length
            }`,
          );
        } else {
          console.log(
            '[DEBUG] loadNextBatch - Skipped adding tracks: reciter mismatch',
          );
        }
      } else {
        console.log('[DEBUG] loadNextBatch - No next surahs available');
      }
    } finally {
      isLoadingBatch = false;
      queueState = QueueState.READY;
    }
  }, 500); // 500ms debounce

  // Keep existing progress tracking but add queue state checks
  useTrackPlayerEvents(
    [
      Event.PlaybackProgressUpdated,
      Event.PlaybackState,
      Event.PlaybackTrackChanged,
    ],
    async event => {
      if (event.type === Event.PlaybackProgressUpdated) {
        if (queueState === QueueState.INITIALIZING) return;

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
        if (queueState === QueueState.INITIALIZING) {
          console.log('[DEBUG] Ignoring track change during initialization');
          return;
        }

        trackChangedCount++;
        console.log(`[DEBUG] Track Changed Event #${trackChangedCount}`);

        // Check if we need to load more tracks
        const queue = await TrackPlayer.getQueue();
        const currentIndex = await TrackPlayer.getCurrentTrack();
        console.log(
          `[DEBUG] Current queue length: ${queue.length}, Current track index: ${currentIndex}`,
        );

        if (
          currentIndex !== null &&
          queue.length - currentIndex <= LOAD_THRESHOLD
        ) {
          console.log(`[DEBUG] Load threshold reached, calling loadNextBatch`);
          await debouncedLoadNextBatch();
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
        url: generateSmartAudioUrl(reciter, surah.id.toString()),
        title: surah.name,
        artist: reciter.name,
        artwork: getReciterArtwork(reciter),
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

    // Get initial batch of available surahs
    const availableSurahs = getNextAvailableSurahs(
      reciter,
      surahs,
      0,
      INITIAL_BATCH_SIZE,
    );

    if (availableSurahs.length === 0) {
      console.warn('No available surahs found for this reciter');
      return;
    }

    const tracks = createTracksFromSurahs(reciter, availableSurahs);
    await queueManager.playMultipleTracksWithOptions(tracks, {
      shuffle,
      clearQueue: true,
    });

    // Store queue state for lazy loading of remaining surahs
    useQueueStore.getState().setQueueContext({
      nextLoadIndex: availableSurahs.length,
      allSurahs: surahs,
      currentReciter: reciter,
    });
  };

  const playFromSurah = async (
    reciter: Reciter,
    surah: Surah,
    allSurahs: Surah[],
    startPosition?: number,
  ) => {
    playFromSurahCount++;
    console.log(`[DEBUG] playFromSurah called #${playFromSurahCount}`);
    console.log(`[DEBUG] Playing ${surah.name} from ${reciter.name}`);

    try {
      queueState = QueueState.INITIALIZING;

      const startIndex = allSurahs.findIndex(s => s.id === surah.id);
      if (startIndex === -1) {
        throw new Error('Surah not found in the list');
      }

      // Verify the starting surah is available
      if (!isSurahAvailable(reciter, surah.id)) {
        throw new Error(
          `Surah ${surah.id} is not available for reciter ${reciter.name}`,
        );
      }

      // Set queue context BEFORE any track operations
      useQueueStore.getState().setQueueContext({
        nextLoadIndex: startIndex + INITIAL_BATCH_SIZE,
        allSurahs,
        currentReciter: reciter,
      });
      console.log(
        `[DEBUG] Queue context set, nextLoadIndex: ${
          startIndex + INITIAL_BATCH_SIZE
        }`,
      );

      // Get initial batch of available surahs (but don't create all tracks yet!)
      const initialSurahs = getNextAvailableSurahs(
        reciter,
        allSurahs,
        startIndex,
        INITIAL_BATCH_SIZE,
      );

      console.log(`[DEBUG] Initial batch size: ${initialSurahs.length} surahs`);

      // HYBRID APPROACH: Best of both worlds
      // 1. Create ONLY first track → play immediately (fastest start)
      // 2. Create remaining tracks in parallel while playing
      // 3. Add remaining tracks all at once (single efficient add call)
      if (initialSurahs.length > 0) {
        const [firstSurah, ...remainingSurahs] = initialSurahs;

        // Optimize: Get artwork once (same for all tracks from same reciter)
        const artwork = getReciterArtwork(reciter);

        // OPTIMIZATION: Ensure download store is "warm" (hydrated) before checking
        useDownloadStore.getState(); // Trigger hydration if not already done

        // STEP 1: Create ONLY first track (instant - ~5ms)
        // Use generateSmartAudioUrl - store is now warm, so check is fast (<1ms)
        const firstTrack = {
          id: `${reciter.id}:${firstSurah.id}`,
          url: generateSmartAudioUrl(reciter, firstSurah.id.toString()), // Fast now - store is warm
          title: firstSurah.name,
          artist: reciter.name,
          reciterId: reciter.id,
          artwork,
          surahId: firstSurah.id.toString(),
          reciterName: reciter.name,
        };

        console.log(
          `[DEBUG] Playing first track immediately: ${firstTrack.title}`,
        );

        // STEP 2: Add first track and start playback IMMEDIATELY
        // This is the critical path - must be as fast as possible
        await TrackPlayer.reset();
        await TrackPlayer.add(firstTrack);

        if (startPosition !== undefined && startPosition > 0) {
          await TrackPlayer.seekTo(startPosition);
        }

        await TrackPlayer.play();

        // STEP 3: Create remaining tracks in parallel (while audio is playing!)
        // This happens in background, doesn't block playback
        if (remainingSurahs.length > 0) {
          console.log(
            `[DEBUG] Creating ${remainingSurahs.length} remaining tracks in parallel (background)`,
          );

          // Create tracks in parallel using Promise.all (like continue playing)
          // This is fast because all URL generation happens simultaneously
          const remainingTracksPromise = Promise.all(
            remainingSurahs.map(() => ({
              id: `${reciter.id}:${surah.id}`,
              url: generateSmartAudioUrl(reciter, surah.id.toString()),
              title: surah.name,
              artist: reciter.name,
              reciterId: reciter.id,
              artwork, // Reuse pre-computed artwork
              surahId: surah.id.toString(),
              reciterName: reciter.name,
            })),
          );

          // Add remaining tracks all at once when ready (single efficient add call)
          remainingTracksPromise
            .then(remainingTracks => {
              console.log(
                `[DEBUG] Adding ${remainingTracks.length} remaining tracks all at once`,
              );
              // Use addToQueue which adds all at once (not one by one)
              return queueManager.addToQueue(remainingTracks);
            })
            .then(() => {
              console.log(
                `[DEBUG] Successfully added ${remainingSurahs.length} tracks to queue`,
              );
            })
            .catch(error => {
              console.error('[DEBUG] Error adding remaining tracks:', error);
            });
        }

        // Add to recently played AFTER playback starts (non-blocking)
        addRecentReciter(reciter, surah, 0, 0);

        // Set queue state to ready after initial setup is complete
        queueState = QueueState.READY;
      }
    } catch (error) {
      console.error('Error in playFromSurah:', error);
      queueState = QueueState.READY; // Reset state even if there's an error
      throw error;
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
      const track: Track = {
        id: `${reciter.id}:${surah.id}`,
        url: generateSmartAudioUrl(reciter, surah.id.toString()),
        title: surah.name,
        artist: reciter.name,
        artwork: getReciterArtwork(reciter),
        reciterId: reciter.id,
        reciterName: reciter.name,
        surahId: surah.id.toString(),
      };

      // Play the track immediately - don't block on recent history
      await queueManager.playTrackWithOptions(track, {clearQueue: true});

      // Add to recent history AFTER playback starts (non-blocking)
      addRecentReciter(reciter, surah, 0, 0);

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
      url: generateSmartAudioUrl(reciter, surah.id.toString()),
      title: surah.name,
      artist: reciter.name,
      reciterId: reciter.id,
      artwork: getReciterArtwork(reciter),
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
