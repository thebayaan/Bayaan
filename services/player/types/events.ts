import {Track} from '@/types/audio';
import {PlaybackState, QueueState, ErrorState} from './state';

/**
 * All possible event types in the player system
 */
export enum PlayerEventType {
  // Playback Events
  PLAYBACK_STATE_CHANGED = 'playbackStateChanged',
  PLAYBACK_ERROR = 'playbackError',
  TRACK_CHANGED = 'trackChanged',
  PROGRESS_UPDATED = 'progressUpdated',

  // Queue Events
  QUEUE_UPDATED = 'queueUpdated',
  QUEUE_ENDED = 'queueEnded',
  BATCH_LOADED = 'batchLoaded',
  QUEUE_ERROR = 'queueError',

  // System Events
  STATE_RESTORED = 'stateRestored',
  STATE_SAVE_ERROR = 'stateSaveError',
  RECOVERY_ATTEMPTED = 'recoveryAttempted',
  SYSTEM_ERROR = 'systemError',
}

/**
 * Base interface for all player events
 */
export interface PlayerEventBase {
  timestamp: number;
  type: PlayerEventType;
}

/**
 * Playback-related events
 */
export interface PlaybackEvents {
  [PlayerEventType.PLAYBACK_STATE_CHANGED]: PlayerEventBase & {
    state: PlaybackState;
  };
  [PlayerEventType.PLAYBACK_ERROR]: PlayerEventBase & {
    error: Error;
    track?: Track;
  };
  [PlayerEventType.TRACK_CHANGED]: PlayerEventBase & {
    track: Track;
    previousTrack?: Track;
  };
  [PlayerEventType.PROGRESS_UPDATED]: PlayerEventBase & {
    position: number;
    duration: number;
  };
}

/**
 * Queue-related events
 */
export interface QueueEvents {
  [PlayerEventType.QUEUE_UPDATED]: PlayerEventBase & {
    state: QueueState;
  };
  [PlayerEventType.QUEUE_ENDED]: PlayerEventBase & {
    lastTrack: Track;
  };
  [PlayerEventType.BATCH_LOADED]: PlayerEventBase & {
    newTracks: Track[];
    startIndex: number;
  };
  [PlayerEventType.QUEUE_ERROR]: PlayerEventBase & {
    error: Error;
    queueState: QueueState;
  };
}

/**
 * System-level events
 */
export interface SystemEvents {
  [PlayerEventType.STATE_RESTORED]: PlayerEventBase & {
    success: boolean;
    error?: Error;
  };
  [PlayerEventType.STATE_SAVE_ERROR]: PlayerEventBase & {
    error: Error;
    partialState?: boolean;
  };
  [PlayerEventType.RECOVERY_ATTEMPTED]: PlayerEventBase & {
    success: boolean;
    error?: Error;
    attempts: number;
  };
  [PlayerEventType.SYSTEM_ERROR]: PlayerEventBase & {
    error: Error;
    critical: boolean;
  };
}

/**
 * Union of all event types
 */
export type PlayerEvents = PlaybackEvents & QueueEvents & SystemEvents;

/**
 * Event handler type for a specific event
 */
export type PlayerEventHandler<T extends PlayerEventType> = (
  event: PlayerEvents[T],
) => void | Promise<void>;

/**
 * Map of event handlers
 */
export type PlayerEventHandlers = {
  [K in PlayerEventType]?: PlayerEventHandler<K>;
};

/**
 * Event subscription handle
 */
export interface EventSubscription {
  /** Unsubscribe from the event */
  unsubscribe: () => void;
}

/**
 * Event emitter interface
 */
export interface PlayerEventEmitter {
  /**
   * Subscribe to a specific event type
   * @param type Event type to subscribe to
   * @param handler Handler function for the event
   * @returns Subscription handle
   */
  subscribe<T extends PlayerEventType>(
    type: T,
    handler: PlayerEventHandler<T>,
  ): EventSubscription;

  /**
   * Emit an event
   * @param type Event type to emit
   * @param event Event data
   */
  emit<T extends PlayerEventType>(type: T, event: PlayerEvents[T]): void;

  /**
   * Remove all event handlers
   */
  clear(): void;
}
