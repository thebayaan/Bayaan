/**
 * @fileoverview Core types and interfaces for the queue management system.
 * This file serves as the foundation for type safety and documentation across
 * the entire queue management implementation.
 */

import {Track} from '@/types/audio';
import {Reciter} from '@/data/reciterData';
import {Surah} from '@/data/surahData';

/**
 * Represents the current state of the queue system
 * @interface QueueState
 */
export interface QueueState {
  /** List of tracks currently in the queue */
  tracks: Track[];

  /** Index of the currently playing track */
  currentIndex: number;

  /** Current loading state of the queue */
  loadingState: QueueLoadingState;

  /** State information for batch loading operations */
  batchLoadingState: BatchLoadingState;

  /** Last error that occurred, if any */
  lastError?: QueueError;
}

/**
 * Represents the possible loading states of the queue
 * @enum {string}
 */
export type QueueLoadingState = 'idle' | 'loading' | 'error';

/**
 * Represents the state of batch loading operations
 * @interface BatchLoadingState
 */
export interface BatchLoadingState {
  /** Index for the next batch of tracks to be loaded */
  nextLoadIndex: number;

  /** Whether a batch is currently being loaded */
  isLoading: boolean;

  /** ID of the current reciter */
  currentReciterId: string | null;

  /** List of all available surahs for the current reciter */
  availableSurahs: Surah[];
}

/**
 * Represents a queue operation with its metadata
 * @interface QueueOperation
 */
export interface QueueOperation {
  /** Unique identifier for the operation */
  id: string;

  /** Type of operation to be performed */
  type: QueueOperationType;

  /** Operation-specific payload */
  payload: QueueOperationPayload;

  /** Priority level for the operation */
  priority: QueueOperationPriority;

  /** Timestamp when the operation was created */
  timestamp: number;
}

/**
 * Available priority levels for queue operations
 * @enum {string}
 */
export type QueueOperationPriority = 'high' | 'normal' | 'low';

/**
 * Available types of queue operations
 * @enum {string}
 */
export type QueueOperationType =
  | 'PLAY_TRACK'
  | 'ADD_TO_QUEUE'
  | 'REMOVE_FROM_QUEUE'
  | 'CLEAR_QUEUE'
  | 'ADD_BATCH'
  | 'SKIP_TO_TRACK'
  | 'UPDATE_TRACK'
  | 'PAUSE_TRACK'
  | 'RESUME_TRACK'
  | 'SKIP_TO_NEXT'
  | 'SKIP_TO_PREVIOUS'
  | 'SEEK_TO';

/**
 * Union type for all possible operation payloads
 * @type {QueueOperationPayload}
 */
export type QueueOperationPayload =
  | PlayTrackPayload
  | AddToQueuePayload
  | RemoveFromQueuePayload
  | AddBatchPayload
  | SkipToTrackPayload
  | UpdateTrackPayload
  | EmptyPayload
  | SeekToPayload;

/**
 * Payload for playing a track
 * @interface PlayTrackPayload
 */
export interface PlayTrackPayload {
  /** Track to be played */
  track: Track;
  /** Starting position in seconds */
  startPosition?: number;
  /** Whether to clear the queue before playing */
  clearQueue?: boolean;
}

/**
 * Payload for adding tracks to the queue
 * @interface AddToQueuePayload
 */
export interface AddToQueuePayload {
  /** Track(s) to be added */
  tracks: Track | Track[];
  /** Position to add the track(s) at */
  position?: number;
}

/**
 * Payload for removing tracks from the queue
 * @interface RemoveFromQueuePayload
 */
export interface RemoveFromQueuePayload {
  /** Index of the track to remove */
  index: number;
}

/**
 * Payload for adding a batch of tracks
 * @interface AddBatchPayload
 */
export interface AddBatchPayload {
  /** Tracks to be added as a batch */
  tracks: Track[];
  /** Reciter associated with the batch */
  reciter: Reciter;
  /** Next index to load from */
  nextLoadIndex: number;
}

/**
 * Payload for skipping to a specific track
 * @interface SkipToTrackPayload
 */
export interface SkipToTrackPayload {
  /** Index to skip to */
  index: number;
}

/**
 * Payload for updating track information
 * @interface UpdateTrackPayload
 */
export interface UpdateTrackPayload {
  /** Track to update */
  track: Track;
  /** Index of the track in the queue */
  index: number;
}

/**
 * Empty payload for operations that don't need data
 * @interface EmptyPayload
 */
export interface EmptyPayload {
  type?: 'empty';
}

/**
 * Payload for seeking to a position
 * @interface SeekToPayload
 */
export interface SeekToPayload {
  position: number;
}

/**
 * Represents an error in the queue system
 * @interface QueueError
 */
export interface QueueError {
  /** Error code */
  code: string;
  /** Error message */
  message: string;
  /** Original error object */
  originalError?: unknown;
  /** Context of where the error occurred */
  context?: Record<string, unknown>;
}

/**
 * Configuration options for the queue system
 * @interface QueueConfig
 */
export interface QueueConfig {
  /** Maximum size of a batch */
  batchSize: number;
  /** Threshold for loading next batch */
  loadThreshold: number;
  /** Debounce time for queue operations (ms) */
  operationDebounceTime: number;
  /** Maximum retry attempts for failed operations */
  maxRetryAttempts: number;
  /** Delay between retry attempts (ms) */
  retryDelay: number;
}
