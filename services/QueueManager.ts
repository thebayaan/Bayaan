import TrackPlayer from 'react-native-track-player';
import {Track, ensureTrackFields} from '@/types/audio';
import {usePlayerStore} from '@/store/playerStore';
import {performance} from '@/utils/performance';

export class QueueManager {
  private static instance: QueueManager;
  private isInitialized = false;

  private constructor() {
    // Private constructor to enforce singleton
  }

  static getInstance(): QueueManager {
    if (!QueueManager.instance) {
      QueueManager.instance = new QueueManager();
    }
    return QueueManager.instance;
  }

  private async initialize(): Promise<void> {
    if (!this.isInitialized) {
      // Initial setup if needed
      this.isInitialized = true;
    }
  }

  // Enhanced methods with proper state management
  async addToQueue(trackOrTracks: Track | Track[]): Promise<void> {
    const start = performance.now();
    console.log('[QueueManager] Adding track(s) to queue');

    try {
      const tracksToAdd = Array.isArray(trackOrTracks)
        ? trackOrTracks
        : [trackOrTracks];
      const processedTracks = tracksToAdd.map(t => ensureTrackFields(t));

      // Get current state
      const playerStore = usePlayerStore.getState();
      const currentQueue = await this.getQueue();

      // Add tracks to TrackPlayer
      await TrackPlayer.add(processedTracks);
      const newQueue = [...currentQueue, ...processedTracks];

      // Update states
      playerStore.setQueue(newQueue);

      // If this is the first track, set it as current
      if (newQueue.length === 1) {
        playerStore.setCurrentTrack(newQueue[0]);
      }

      const duration = performance.now() - start;
      console.log(
        `[QueueManager] Added ${processedTracks.length} track(s) in ${duration}ms`,
      );
    } catch (error) {
      console.error('[QueueManager] Error adding track(s):', error);
      throw error;
    }
  }

  async removeFromQueue(index: number): Promise<void> {
    const start = performance.now();
    console.log('[QueueManager] Removing track at index:', index);

    try {
      const playerStore = usePlayerStore.getState();
      const currentQueue = await this.getQueue();

      // Remove from TrackPlayer
      await TrackPlayer.remove(index);
      const newQueue = currentQueue.filter((_, i) => i !== index);

      // Update states
      playerStore.setQueue(newQueue);
      await this.updateCurrentTrackAfterRemoval(index, newQueue);

      const duration = performance.now() - start;
      console.log(`[QueueManager] Removed track in ${duration}ms`);
    } catch (error) {
      console.error('[QueueManager] Error removing track:', error);
      throw error;
    }
  }

  private async updateCurrentTrackAfterRemoval(
    removedIndex: number,
    newQueue: Track[],
  ) {
    const currentTrack = await TrackPlayer.getCurrentTrack();
    if (currentTrack !== null) {
      const track = await TrackPlayer.getTrack(currentTrack);
      if (track) {
        usePlayerStore.getState().setCurrentTrack(ensureTrackFields(track));
      } else if (newQueue.length > 0) {
        // If current track was removed, set the next available track
        usePlayerStore.getState().setCurrentTrack(newQueue[0]);
      } else {
        usePlayerStore.getState().setCurrentTrack(null);
      }
    }
  }

  async clearQueue(): Promise<void> {
    const start = performance.now();
    console.log('[QueueManager] Clearing queue');

    try {
      const playerStore = usePlayerStore.getState();

      // Reset TrackPlayer
      await TrackPlayer.reset();

      // Update states
      playerStore.setQueue([]);
      playerStore.setCurrentTrack(null);

      const duration = performance.now() - start;
      console.log(`[QueueManager] Cleared queue in ${duration}ms`);
    } catch (error) {
      console.error('[QueueManager] Error clearing queue:', error);
      throw error;
    }
  }

  async getQueue(): Promise<Track[]> {
    try {
      const queue = await TrackPlayer.getQueue();
      return queue.map(track => ensureTrackFields(track));
    } catch (error) {
      console.error('[QueueManager] Error getting queue:', error);
      throw error;
    }
  }

  async skipToTrack(index: number): Promise<Track> {
    const start = performance.now();
    console.log('[QueueManager] Skipping to track at index:', index);

    try {
      await TrackPlayer.skip(index);
      const track = await TrackPlayer.getTrack(index);
      if (!track) {
        throw new Error('Track not found at index ' + index);
      }

      const processedTrack = ensureTrackFields(track);
      usePlayerStore.getState().setCurrentTrack(processedTrack);

      const duration = performance.now() - start;
      console.log(`[QueueManager] Skipped to track in ${duration}ms`);
      return processedTrack;
    } catch (error) {
      console.error('[QueueManager] Error skipping to track:', error);
      throw error;
    }
  }

  async playTrackWithOptions(
    track: Track,
    options?: {
      startPosition?: number;
      clearQueue?: boolean;
    },
  ): Promise<void> {
    const start = performance.now();
    try {
      const playerStore = usePlayerStore.getState();

      if (options?.clearQueue) {
        await this.clearQueue();
      }

      await this.addToQueue(track);

      if (options?.startPosition !== undefined) {
        await TrackPlayer.seekTo(options.startPosition);
      }

      await TrackPlayer.play();
      playerStore.setIsPlaying(true);

      const duration = performance.now() - start;
      console.log(`[QueueManager] Played track in ${duration}ms`);
    } catch (error) {
      console.error('[QueueManager] Error playing track:', error);
      const store = usePlayerStore.getState();
      store.setIsPlaying(false);
      throw error;
    }
  }

  private pendingTracks: Track[] = [];
  private isLoadingMore = false;
  private readonly BATCH_SIZE = 10;

  async playMultipleTracksWithOptions(
    tracks: Track[],
    options?: {
      startIndex?: number;
      shuffle?: boolean;
      clearQueue?: boolean;
    },
  ): Promise<void> {
    const start = performance.now();
    try {
      const playerStore = usePlayerStore.getState();

      if (options?.clearQueue) {
        await this.clearQueue();
      }

      // Store all tracks but only load the first batch
      this.pendingTracks = options?.shuffle
        ? this.shuffleTracks(tracks)
        : tracks;

      // Load first batch
      const firstBatch = this.pendingTracks.slice(0, this.BATCH_SIZE);
      await this.addToQueue(firstBatch);

      if (options?.startIndex !== undefined) {
        await this.skipToTrack(options.startIndex);
      }

      await TrackPlayer.play();
      playerStore.setIsPlaying(true);

      const duration = performance.now() - start;
      console.log(
        `[QueueManager] Started playing ${firstBatch.length} tracks in ${duration}ms`,
      );
    } catch (error) {
      console.error(
        '[QueueManager] Error in playMultipleTracksWithOptions:',
        error,
      );
      const store = usePlayerStore.getState();
      store.setIsPlaying(false);
      throw error;
    }
  }

  private shuffleTracks(tracks: Track[]): Track[] {
    const shuffled = [...tracks];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  async loadMoreTracks(): Promise<void> {
    if (this.isLoadingMore || this.pendingTracks.length === 0) return;

    try {
      this.isLoadingMore = true;
      const currentQueue = await this.getQueue();
      const nextBatchStart = currentQueue.length;
      const nextBatch = this.pendingTracks.slice(
        nextBatchStart,
        nextBatchStart + this.BATCH_SIZE,
      );

      if (nextBatch.length > 0) {
        await this.addToQueue(nextBatch);
        console.log(`[QueueManager] Loaded ${nextBatch.length} more tracks`);
      }
    } catch (error) {
      console.error('[QueueManager] Error loading more tracks:', error);
    } finally {
      this.isLoadingMore = false;
    }
  }

  async checkQueuePosition(): Promise<void> {
    try {
      const currentTrack = await TrackPlayer.getCurrentTrack();
      const queue = await this.getQueue();

      if (currentTrack === null || queue.length === 0) return;

      // Load more tracks when we're 3 tracks away from the end
      if (currentTrack >= queue.length - 3) {
        await this.loadMoreTracks();
      }
    } catch (error) {
      console.error('[QueueManager] Error checking queue position:', error);
    }
  }
}
