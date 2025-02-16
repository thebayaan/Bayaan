/**
 * @fileoverview Core queue state management and context provider.
 * This class serves as the central point for managing queue state and operations.
 */

import TrackPlayer, {Event, State} from 'react-native-track-player';
import {
  QueueState,
  QueueOperation,
  QueueConfig,
  QueueError,
  QueueOperationType,
} from './types';
import {Track} from '@/types/audio';
import {performance} from '@/utils/performance';
import {QueueOperationManager} from './QueueOperationManager';
import {BatchLoader} from './BatchLoader';
import {Reciter} from '@/data/reciterData';

/**
 * Basic EventEmitter implementation for React Native
 */
class EventEmitter {
  private listeners: Map<string, Set<(data: any) => void>> = new Map();
  private maxListeners = 10;

  setMaxListeners(n: number): void {
    this.maxListeners = n;
  }

  emit(event: string, data: any): boolean {
    const listeners = this.listeners.get(event);
    if (!listeners) return false;

    listeners.forEach(listener => {
      try {
        listener(data);
      } catch (error) {
        console.error(`Error in event listener for ${event}:`, error);
      }
    });
    return true;
  }

  on(event: string, listener: (data: any) => void): this {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    const listeners = this.listeners.get(event)!;

    if (listeners.size >= this.maxListeners) {
      console.warn(
        'MaxListenersExceededWarning: Possible EventEmitter memory leak detected. ' +
          `${listeners.size} ${event} listeners added. ` +
          'Use emitter.setMaxListeners() to increase limit',
      );
    }

    listeners.add(listener);
    return this;
  }

  off(event: string, listener: (data: any) => void): this {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.delete(listener);
      if (listeners.size === 0) {
        this.listeners.delete(event);
      }
    }
    return this;
  }

  removeAllListeners(event?: string): this {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
    return this;
  }
}

/**
 * Default configuration for the queue system
 */
const DEFAULT_CONFIG: QueueConfig = {
  batchSize: 5,
  loadThreshold: 3,
  operationDebounceTime: 500,
  maxRetryAttempts: 3,
  retryDelay: 1000,
};

/**
 * Events emitted by the QueueContext
 */
export enum QueueEvents {
  STATE_CHANGED = 'state_changed',
  ERROR = 'error',
  OPERATION_COMPLETED = 'operation_completed',
  BATCH_LOADED = 'batch_loaded',
  TRACK_CHANGED = 'track_changed',
  PLAYBACK_STATE_CHANGED = 'playback_state_changed',
}

/**
 * Manages the queue state and operations
 */
export class QueueContext {
  private static instance: QueueContext;
  private state: QueueState;
  private eventEmitter: EventEmitter;
  private config: QueueConfig;
  private operationManager: QueueOperationManager;
  public batchLoader: BatchLoader;
  private currentReciter: Reciter | null = null;

  /**
   * Private constructor to enforce singleton pattern
   */
  private constructor() {
    this.state = this.getInitialState();
    this.eventEmitter = new EventEmitter();
    this.config = DEFAULT_CONFIG;
    this.operationManager = new QueueOperationManager(this);
    this.batchLoader = new BatchLoader(this, this.config);
    this.setupEventListeners();
  }

  /**
   * Gets or creates the singleton instance
   */
  public static getInstance(): QueueContext {
    if (!QueueContext.instance) {
      QueueContext.instance = new QueueContext();
    }
    return QueueContext.instance;
  }

  /**
   * Gets the initial state for the queue
   */
  private getInitialState(): QueueState {
    return {
      tracks: [],
      currentIndex: -1,
      loadingState: 'idle',
      batchLoadingState: {
        nextLoadIndex: 0,
        isLoading: false,
        currentReciterId: null,
        availableSurahs: [],
      },
    };
  }

  /**
   * Sets up event listeners for TrackPlayer events
   */
  private setupEventListeners(): void {
    // Track change events
    TrackPlayer.addEventListener(Event.PlaybackTrackChanged, async event => {
      if (event.nextTrack === undefined || event.nextTrack === null) return;

      await this.updateState(() => ({
        currentIndex: event.nextTrack,
      }));

      this.eventEmitter.emit(QueueEvents.TRACK_CHANGED, event.nextTrack);

      // Check if we need to load more tracks
      if (this.currentReciter) {
        await this.batchLoader.loadNextBatchIfNeeded(this.currentReciter);
      }
    });

    // Playback state events
    TrackPlayer.addEventListener(Event.PlaybackState, async event => {
      this.eventEmitter.emit(QueueEvents.PLAYBACK_STATE_CHANGED, event.state);

      // Handle errors
      if (event.state === State.Error) {
        this.handleError({
          code: 'PLAYBACK_ERROR',
          message: 'Playback encountered an error',
          context: {state: event.state},
        });
      }
    });

    // Queue ended event
    TrackPlayer.addEventListener(Event.PlaybackQueueEnded, event => {
      console.log('[QueueContext] Queue ended', event);
    });
  }

  /**
   * Updates the queue state
   * @param updater - Function that returns the state update
   */
  public async updateState(
    updater: (currentState: QueueState) => Partial<QueueState>,
  ): Promise<void> {
    const start = performance.now();
    try {
      const update = updater(this.state);
      const nextState = {...this.state, ...update};

      if (this.validateState(nextState)) {
        this.state = nextState;
        this.eventEmitter.emit(QueueEvents.STATE_CHANGED, this.state);
        console.log(
          `[QueueContext] State updated in ${performance.now() - start}ms`,
        );
      }
    } catch (error) {
      const queueError: QueueError = {
        code: 'STATE_UPDATE_ERROR',
        message: 'Failed to update queue state',
        originalError: error,
      };
      this.handleError(queueError);
    }
  }

  /**
   * Validates the queue state
   * @param state - State to validate
   */
  private validateState(state: QueueState): boolean {
    // Basic validation
    if (
      !Array.isArray(state.tracks) ||
      typeof state.currentIndex !== 'number' ||
      !state.batchLoadingState
    ) {
      return false;
    }

    // Validate current index
    if (
      state.currentIndex !== -1 &&
      (state.currentIndex < 0 || state.currentIndex >= state.tracks.length)
    ) {
      return false;
    }

    return true;
  }

  /**
   * Handles errors in the queue system
   * @param error - Error to handle
   */
  private handleError(error: QueueError): void {
    console.error('[QueueContext] Error:', error);
    this.eventEmitter.emit(QueueEvents.ERROR, error);
  }

  /**
   * Gets the current queue state
   */
  public getState(): QueueState {
    return {...this.state};
  }

  /**
   * Sets the current reciter
   * @param reciter - Reciter to set
   */
  public setCurrentReciter(reciter: Reciter): void {
    this.currentReciter = reciter;
  }

  /**
   * Subscribes to queue events
   * @param event - Event to subscribe to
   * @param handler - Event handler
   */
  public subscribe(
    event: QueueEvents,
    handler: (data: any) => void,
  ): () => void {
    this.eventEmitter.on(event, handler);
    return () => this.eventEmitter.off(event, handler);
  }

  /**
   * Enqueues a new operation
   * @param operation - Operation to enqueue
   */
  public async enqueueOperation(operation: QueueOperation): Promise<void> {
    const start = performance.now();
    try {
      await this.operationManager.executeOperation(operation);
      this.eventEmitter.emit(QueueEvents.OPERATION_COMPLETED, {
        operation,
        duration: performance.now() - start,
      });
    } catch (error) {
      this.handleError({
        code: 'OPERATION_FAILED',
        message: `Failed to execute operation: ${operation.type}`,
        originalError: error,
        context: {operation},
      });
    }
  }

  /**
   * Resets the queue system
   */
  public async reset(): Promise<void> {
    await this.batchLoader.reset();
    this.currentReciter = null;
    await this.updateState(() => this.getInitialState());
    await TrackPlayer.reset();
  }

  /**
   * Helper method to load next batch
   * @param reciter - Current reciter
   * @param force - Force load even if threshold not met
   */
  public async loadNextBatchIfNeeded(
    reciter: Reciter,
    force = false,
  ): Promise<void> {
    return this.batchLoader.loadNextBatchIfNeeded(reciter, force);
  }
}
