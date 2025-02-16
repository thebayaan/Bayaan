/**
 * @fileoverview React hook for interacting with the queue system.
 * Provides a simple interface for components to interact with the queue
 * while maintaining proper state management and error handling.
 */

import {useCallback, useEffect, useState, useRef} from 'react';
import {QueueContext, QueueEvents} from '@/services/queue/QueueContext';
import {
  QueueState,
  QueueError,
  PlayTrackPayload,
  EmptyPayload,
  SeekToPayload,
} from '@/services/queue/types';
import {Track} from '@/types/audio';
import {Reciter} from '@/data/reciterData';

/**
 * Hook return type
 */
interface UseQueueReturn {
  // State
  state: QueueState;
  currentTrack: Track | null;
  isLoading: boolean;
  error: QueueError | null;

  // Track Operations
  playTrack: (payload: PlayTrackPayload) => Promise<void>;
  pauseTrack: () => Promise<void>;
  resumeTrack: () => Promise<void>;
  skipToNext: () => Promise<void>;
  skipToPrevious: () => Promise<void>;
  seekTo: (position: number) => Promise<void>;

  // Queue Operations
  addToQueue: (tracks: Track | Track[]) => Promise<void>;
  removeFromQueue: (index: number) => Promise<void>;
  clearQueue: () => Promise<void>;

  // Batch Operations
  setCurrentReciter: (reciter: Reciter) => void;
  loadNextBatch: (force?: boolean) => Promise<void>;
}

/**
 * Hook for interacting with the queue system
 */
export function useQueue(): UseQueueReturn {
  const contextRef = useRef(QueueContext.getInstance());
  const context = contextRef.current;

  const [state, setState] = useState<QueueState>(context.getState());
  const [error, setError] = useState<QueueError | null>(null);

  // Set up event listeners
  useEffect(() => {
    const unsubscribers = [
      // State changes
      context.subscribe(QueueEvents.STATE_CHANGED, (newState: QueueState) => {
        setState(newState);
      }),

      // Errors
      context.subscribe(QueueEvents.ERROR, (newError: QueueError) => {
        setError(newError);
        console.error('[useQueue] Error:', newError);
      }),

      // Track changes
      context.subscribe(QueueEvents.TRACK_CHANGED, () => {
        setState(context.getState());
      }),
    ];

    return () => {
      unsubscribers.forEach(unsubscribe => unsubscribe());
    };
  }, [context]);

  // Track Operations
  const playTrack = useCallback(
    async (payload: PlayTrackPayload) => {
      await context.enqueueOperation({
        id: `play-${Date.now()}`,
        type: 'PLAY_TRACK',
        payload,
        priority: 'high',
        timestamp: Date.now(),
      });
    },
    [context],
  );

  const pauseTrack = useCallback(async () => {
    const payload: EmptyPayload = {type: 'empty'};
    await context.enqueueOperation({
      id: `pause-${Date.now()}`,
      type: 'PAUSE_TRACK',
      payload,
      priority: 'high',
      timestamp: Date.now(),
    });
  }, [context]);

  const resumeTrack = useCallback(async () => {
    const payload: EmptyPayload = {type: 'empty'};
    await context.enqueueOperation({
      id: `resume-${Date.now()}`,
      type: 'RESUME_TRACK',
      payload,
      priority: 'high',
      timestamp: Date.now(),
    });
  }, [context]);

  const skipToNext = useCallback(async () => {
    const payload: EmptyPayload = {type: 'empty'};
    await context.enqueueOperation({
      id: `skip-next-${Date.now()}`,
      type: 'SKIP_TO_NEXT',
      payload,
      priority: 'high',
      timestamp: Date.now(),
    });
  }, [context]);

  const skipToPrevious = useCallback(async () => {
    const payload: EmptyPayload = {type: 'empty'};
    await context.enqueueOperation({
      id: `skip-prev-${Date.now()}`,
      type: 'SKIP_TO_PREVIOUS',
      payload,
      priority: 'high',
      timestamp: Date.now(),
    });
  }, [context]);

  const seekTo = useCallback(
    async (position: number) => {
      const payload: SeekToPayload = {position};
      await context.enqueueOperation({
        id: `seek-${Date.now()}`,
        type: 'SEEK_TO',
        payload,
        priority: 'high',
        timestamp: Date.now(),
      });
    },
    [context],
  );

  // Queue Operations
  const addToQueue = useCallback(
    async (tracks: Track | Track[]) => {
      await context.enqueueOperation({
        id: `add-${Date.now()}`,
        type: 'ADD_TO_QUEUE',
        payload: {tracks},
        priority: 'normal',
        timestamp: Date.now(),
      });
    },
    [context],
  );

  const removeFromQueue = useCallback(
    async (index: number) => {
      await context.enqueueOperation({
        id: `remove-${Date.now()}`,
        type: 'REMOVE_FROM_QUEUE',
        payload: {index},
        priority: 'normal',
        timestamp: Date.now(),
      });
    },
    [context],
  );

  const clearQueue = useCallback(async () => {
    const payload: EmptyPayload = {type: 'empty'};
    await context.enqueueOperation({
      id: `clear-${Date.now()}`,
      type: 'CLEAR_QUEUE',
      payload,
      priority: 'normal',
      timestamp: Date.now(),
    });
  }, [context]);

  // Batch Operations
  const setCurrentReciter = useCallback(
    (reciter: Reciter) => {
      context.setCurrentReciter(reciter);
    },
    [context],
  );

  const loadNextBatch = useCallback(
    async (force = false) => {
      const currentReciter =
        context.getState().batchLoadingState.currentReciterId;
      if (!currentReciter) {
        throw new Error('No current reciter set');
      }
      // Note: This assumes we have the reciter object available
      // In a real implementation, we might need to fetch it
      const reciter = {id: currentReciter} as Reciter; // TODO: Get actual reciter
      await context.batchLoader.loadNextBatchIfNeeded(reciter, force);
    },
    [context],
  );

  return {
    // State
    state,
    currentTrack: state.tracks[state.currentIndex] || null,
    isLoading: state.loadingState === 'loading',
    error,

    // Track Operations
    playTrack,
    pauseTrack,
    resumeTrack,
    skipToNext,
    skipToPrevious,
    seekTo,

    // Queue Operations
    addToQueue,
    removeFromQueue,
    clearQueue,

    // Batch Operations
    setCurrentReciter,
    loadNextBatch,
  };
}
