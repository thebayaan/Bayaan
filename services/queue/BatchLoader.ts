/**
 * @fileoverview Manages efficient batch loading of tracks.
 * This class handles the loading of track batches with optimizations
 * for performance and memory usage.
 */

import {QueueConfig, AddBatchPayload, QueueError} from './types';
import {Track} from '@/types/audio';
import {QueueContext} from './QueueContext';
import {Reciter, Rewayat} from '@/data/reciterData';
import {performance} from '@/utils/performance';

/**
 * Manages the loading of track batches
 */
export class BatchLoader {
  private context: QueueContext;
  private config: QueueConfig;
  private loadPromise: Promise<void> | null = null;

  constructor(context: QueueContext, config: QueueConfig) {
    this.context = context;
    this.config = config;
  }

  /**
   * Checks if more tracks should be loaded
   * @param currentIndex - Current track index
   * @param totalTracks - Total number of tracks
   */
  public shouldLoadMore(currentIndex: number, totalTracks: number): boolean {
    if (currentIndex === -1) return false;

    const remainingTracks = totalTracks - (currentIndex + 1);
    return remainingTracks <= this.config.loadThreshold;
  }

  /**
   * Loads the next batch of tracks if needed
   * @param reciter - Current reciter
   * @param force - Force load even if threshold not met
   */
  public async loadNextBatchIfNeeded(
    reciter: Reciter,
    force = false,
  ): Promise<void> {
    // Prevent concurrent loads
    if (this.loadPromise) {
      return this.loadPromise;
    }

    const state = this.context.getState();
    const {currentIndex, tracks} = state;
    const shouldLoad =
      force || this.shouldLoadMore(currentIndex, tracks.length);

    if (!shouldLoad) {
      return;
    }

    try {
      this.loadPromise = this.loadNextBatch(reciter);
      await this.loadPromise;
    } finally {
      this.loadPromise = null;
    }
  }

  /**
   * Loads the next batch of tracks
   * @param reciter - Current reciter
   */
  private async loadNextBatch(reciter: Reciter): Promise<void> {
    const start = performance.now();
    console.log('[BatchLoader] Loading next batch');

    try {
      // Update loading state
      await this.context.updateState(state => ({
        batchLoadingState: {
          ...state.batchLoadingState,
          isLoading: true,
          currentReciterId: reciter.id,
        },
      }));

      const state = this.context.getState();
      const {nextLoadIndex} = state.batchLoadingState;

      // Get the active rewayat
      const activeRewayat = reciter.rewayat[0]; // TODO: Allow selection of rewayat
      if (!activeRewayat) {
        throw new Error('No rewayat available for reciter');
      }

      // Prepare next batch of tracks
      const tracks = await this.prepareBatchTracks(
        reciter,
        activeRewayat,
        nextLoadIndex,
      );

      if (tracks.length === 0) {
        console.log('[BatchLoader] No more tracks to load');
        return;
      }

      // Create and enqueue the batch operation
      const batchPayload: AddBatchPayload = {
        tracks,
        reciter,
        nextLoadIndex: nextLoadIndex + tracks.length,
      };

      await this.context.enqueueOperation({
        id: `batch-${Date.now()}`,
        type: 'ADD_BATCH',
        payload: batchPayload,
        priority: 'normal',
        timestamp: Date.now(),
      });

      console.log(
        `[BatchLoader] Batch loaded in ${performance.now() - start}ms`,
      );
    } catch (error) {
      const queueError: QueueError = {
        code: 'BATCH_LOAD_ERROR',
        message: 'Failed to load next batch',
        originalError: error,
      };
      throw queueError;
    } finally {
      // Reset loading state
      await this.context.updateState(state => ({
        batchLoadingState: {
          ...state.batchLoadingState,
          isLoading: false,
        },
      }));
    }
  }

  /**
   * Prepares tracks for the next batch
   * @param reciter - Current reciter
   * @param rewayat - Active rewayat
   * @param startIndex - Starting index for the batch
   */
  private async prepareBatchTracks(
    reciter: Reciter,
    rewayat: Rewayat,
    startIndex: number,
  ): Promise<Track[]> {
    const surahList = rewayat.surah_list.filter(
      (surahNumber): surahNumber is number => surahNumber !== null,
    );

    const endIndex = Math.min(
      startIndex + this.config.batchSize,
      surahList.length,
    );

    if (startIndex >= endIndex) {
      return [];
    }

    const batchSurahNumbers = surahList.slice(startIndex, endIndex);
    return this.createTracksFromSurahNumbers(
      reciter,
      rewayat,
      batchSurahNumbers,
    );
  }

  /**
   * Creates track objects from surah numbers
   * @param reciter - Current reciter
   * @param rewayat - Active rewayat
   * @param surahNumbers - Surah numbers to create tracks from
   */
  private createTracksFromSurahNumbers(
    reciter: Reciter,
    rewayat: Rewayat,
    surahNumbers: number[],
  ): Track[] {
    return surahNumbers.map(surahNumber => ({
      id: `${reciter.id}-${surahNumber}`,
      url: `${rewayat.server}/${surahNumber}.mp3`,
      title: `Surah ${surahNumber}`, // TODO: Get actual surah name
      artist: reciter.name,
      artwork: reciter.image_url || undefined,
      reciterId: reciter.id,
      reciterName: reciter.name,
      surahId: surahNumber.toString(),
    }));
  }

  /**
   * Resets the batch loader state
   */
  public async reset(): Promise<void> {
    this.loadPromise = null;
    await this.context.updateState(state => ({
      batchLoadingState: {
        ...state.batchLoadingState,
        nextLoadIndex: 0,
        isLoading: false,
        currentReciterId: null,
      },
    }));
  }
}
