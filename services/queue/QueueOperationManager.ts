/**
 * @fileoverview Manages queue operations and their execution.
 * This class handles the actual implementation of queue operations,
 * ensuring proper state management and error handling.
 */

import TrackPlayer from 'react-native-track-player';
import {
  QueueOperation,
  QueueState,
  PlayTrackPayload,
  AddToQueuePayload,
  RemoveFromQueuePayload,
  AddBatchPayload,
  QueueError,
} from './types';
import {QueueContext} from './QueueContext';
import {performance} from '@/utils/performance';

/**
 * Manages the execution of queue operations
 */
export class QueueOperationManager {
  private context: QueueContext;

  constructor(context: QueueContext) {
    this.context = context;
  }

  /**
   * Executes a queue operation
   * @param operation - Operation to execute
   */
  public async executeOperation(operation: QueueOperation): Promise<void> {
    const start = performance.now();
    console.log(
      `[QueueOperationManager] Executing operation: ${operation.type}`,
    );

    try {
      switch (operation.type) {
        case 'PLAY_TRACK':
          await this.handlePlayTrack(operation.payload as PlayTrackPayload);
          break;
        case 'ADD_TO_QUEUE':
          await this.handleAddToQueue(operation.payload as AddToQueuePayload);
          break;
        case 'REMOVE_FROM_QUEUE':
          await this.handleRemoveFromQueue(
            operation.payload as RemoveFromQueuePayload,
          );
          break;
        case 'CLEAR_QUEUE':
          await this.handleClearQueue();
          break;
        case 'ADD_BATCH':
          await this.handleAddBatch(operation.payload as AddBatchPayload);
          break;
        default:
          throw new Error(`Unknown operation type: ${operation.type}`);
      }

      console.log(
        `[QueueOperationManager] Operation completed in ${
          performance.now() - start
        }ms`,
      );
    } catch (error) {
      throw this.createError(
        'OPERATION_FAILED',
        `Failed to execute operation`,
        {
          operation,
          error,
        },
      );
    }
  }

  /**
   * Handles playing a track
   * @param payload - Play track payload
   */
  private async handlePlayTrack(payload: PlayTrackPayload): Promise<void> {
    const {track, startPosition = 0, clearQueue = false} = payload;

    try {
      if (clearQueue) {
        await this.handleClearQueue();
      }

      // Update state first
      await this.context.updateState(state => ({
        tracks: clearQueue ? [track] : [...state.tracks, track],
        currentIndex: clearQueue ? 0 : state.tracks.length,
        loadingState: 'loading',
      }));

      // Then update TrackPlayer
      await TrackPlayer.reset();
      await TrackPlayer.add(track);
      if (startPosition > 0) {
        await TrackPlayer.seekTo(startPosition);
      }
      await TrackPlayer.play();

      await this.context.updateState(() => ({
        loadingState: 'idle',
      }));
    } catch (error) {
      throw this.createError('PLAY_TRACK_FAILED', 'Failed to play track', {
        track,
        error,
      });
    }
  }

  /**
   * Handles adding tracks to the queue
   * @param payload - Add to queue payload
   */
  private async handleAddToQueue(payload: AddToQueuePayload): Promise<void> {
    const {tracks: newTracks, position} = payload;
    const tracksArray = Array.isArray(newTracks) ? newTracks : [newTracks];

    try {
      await this.context.updateState(state => {
        const currentTracks = [...state.tracks];
        if (typeof position === 'number') {
          currentTracks.splice(position, 0, ...tracksArray);
        } else {
          currentTracks.push(...tracksArray);
        }

        return {
          tracks: currentTracks,
        };
      });

      // Add to TrackPlayer queue
      await TrackPlayer.add(tracksArray, position);
    } catch (error) {
      throw this.createError('ADD_TO_QUEUE_FAILED', 'Failed to add to queue', {
        tracks: tracksArray,
        error,
      });
    }
  }

  /**
   * Handles removing tracks from the queue
   * @param payload - Remove from queue payload
   */
  private async handleRemoveFromQueue(
    payload: RemoveFromQueuePayload,
  ): Promise<void> {
    const {index} = payload;

    try {
      await this.context.updateState(state => {
        const newTracks = [...state.tracks];
        newTracks.splice(index, 1);

        // Adjust currentIndex if necessary
        let newIndex = state.currentIndex;
        if (index < state.currentIndex) {
          newIndex--;
        } else if (index === state.currentIndex) {
          // If removing current track, move to next track
          newIndex = Math.min(newIndex, newTracks.length - 1);
        }

        return {
          tracks: newTracks,
          currentIndex: newIndex,
        };
      });

      // Remove from TrackPlayer queue
      await TrackPlayer.remove(index);
    } catch (error) {
      throw this.createError(
        'REMOVE_FROM_QUEUE_FAILED',
        'Failed to remove from queue',
        {index, error},
      );
    }
  }

  /**
   * Handles clearing the queue
   */
  private async handleClearQueue(): Promise<void> {
    try {
      await this.context.updateState(() => ({
        tracks: [],
        currentIndex: -1,
        loadingState: 'idle',
      }));

      await TrackPlayer.reset();
    } catch (error) {
      throw this.createError('CLEAR_QUEUE_FAILED', 'Failed to clear queue', {
        error,
      });
    }
  }

  /**
   * Handles adding a batch of tracks
   * @param payload - Add batch payload
   */
  private async handleAddBatch(payload: AddBatchPayload): Promise<void> {
    const {tracks, reciter, nextLoadIndex} = payload;

    try {
      await this.context.updateState(state => ({
        tracks: [...state.tracks, ...tracks],
        batchLoadingState: {
          ...state.batchLoadingState,
          nextLoadIndex,
          currentReciterId: reciter.id,
          isLoading: false,
        },
      }));

      // Add to TrackPlayer queue
      await TrackPlayer.add(tracks);
    } catch (error) {
      throw this.createError('ADD_BATCH_FAILED', 'Failed to add batch', {
        tracks,
        error,
      });
    }
  }

  /**
   * Creates a standardized error object
   * @param code - Error code
   * @param message - Error message
   * @param context - Error context
   */
  private createError(
    code: string,
    message: string,
    context?: Record<string, unknown>,
  ): QueueError {
    return {
      code,
      message,
      context,
    };
  }

  /**
   * Validates the current state of the queue
   * @param state - Current queue state
   */
  private validateQueueState(state: QueueState): boolean {
    if (!Array.isArray(state.tracks)) {
      return false;
    }

    // Validate current index is within bounds
    if (
      state.currentIndex !== -1 &&
      (state.currentIndex < 0 || state.currentIndex >= state.tracks.length)
    ) {
      return false;
    }

    // Validate batch loading state
    if (
      !state.batchLoadingState ||
      typeof state.batchLoadingState.nextLoadIndex !== 'number' ||
      typeof state.batchLoadingState.isLoading !== 'boolean'
    ) {
      return false;
    }

    return true;
  }
}
