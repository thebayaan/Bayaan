/**
 * Custom error class for state validation errors
 */
export class StateValidationError extends Error {
  constructor(
    message: string,
    public readonly field?: string,
    public readonly expected?: string,
    public readonly received?: unknown,
  ) {
    super(message);
    this.name = 'StateValidationError';
  }
}

import {Track} from '@/types/audio';

export type PlayerState =
  | 'none'
  | 'loading'
  | 'buffering'
  | 'ready'
  | 'playing'
  | 'paused'
  | 'stopped'
  | 'ended'
  | 'error';

export type RepeatMode = 'none' | 'queue' | 'track';

/**
 * Represents the current state of audio playback
 */
export interface PlaybackState {
  /** Current playback state */
  state: PlayerState;
  /** Current track position in seconds */
  position: number;
  /** Current track duration in seconds */
  duration: number;
  /** Playback rate (speed) */
  rate: number;
  /** Whether audio is buffering */
  buffering: boolean;
}

/**
 * Represents the current state of the queue
 */
export interface QueueState {
  /** All tracks in the queue */
  tracks: Track[];
  /** Current track index */
  currentIndex: number;
  /** Whether more tracks are being loaded */
  loading: boolean;
  /** Whether all tracks have been loaded */
  endReached: boolean;
  /** Total number of tracks available */
  total: number;
}

/**
 * Represents loading states for different operations
 */
export interface LoadingState {
  /** Whether a track is being loaded */
  trackLoading: boolean;
  /** Whether the queue is being updated */
  queueLoading: boolean;
  /** Whether state is being restored */
  stateRestoring: boolean;
}

/**
 * Represents different types of errors that can occur
 */
export interface ErrorState {
  /** Playback-related error */
  playback: Error | null;
  /** Queue-related error */
  queue: Error | null;
  /** System-level error */
  system: Error | null;
}

/**
 * Settings for playback behavior
 */
export interface PlaybackSettings {
  /** Repeat mode (none, queue, track) */
  repeatMode: RepeatMode;
  /** Whether shuffle is enabled */
  shuffle: boolean;
  /** Sleep timer duration in minutes (0 = disabled) */
  sleepTimer: number;
  /** Timestamp when the sleep timer should end (null if disabled) */
  sleepTimerEnd: number | null;
  /** Interval for updating the sleep timer */
  sleepTimerInterval?: NodeJS.Timeout | null;
  /** Whether to skip silence */
  skipSilence: boolean;
}

/**
 * Represents UI state
 */
export interface UIState {
  sheetMode: 'hidden' | 'full';
  isTransitioning: boolean;
  isImmersive: boolean;
}

/**
 * Complete unified state for the player system
 */
export interface UnifiedPlayerState {
  /** Current playback state */
  playback: PlaybackState;
  /** Current queue state */
  queue: QueueState;
  /** Loading states */
  loading: LoadingState;
  /** Error states */
  error: ErrorState;
  /** Playback settings */
  settings: PlaybackSettings;
  /** UI state */
  ui: UIState;
}

/**
 * Actions that can be performed on the player
 */
export type PlayerAction =
  | {type: 'PLAY'}
  | {type: 'PAUSE'}
  | {type: 'SKIP_NEXT'}
  | {type: 'SKIP_PREVIOUS'}
  | {type: 'SEEK'; payload: number}
  | {type: 'SET_RATE'; payload: number}
  | {type: 'SET_REPEAT_MODE'; payload: PlaybackSettings['repeatMode']}
  | {type: 'TOGGLE_SHUFFLE'}
  | {type: 'SET_SLEEP_TIMER'; payload: number}
  | {type: 'TOGGLE_SKIP_SILENCE'};

/**
 * Recovery options for state restoration
 */
export interface StateRecoveryOptions {
  /** Whether to attempt recovery */
  attemptRecovery: boolean;
  /** Maximum number of retry attempts */
  maxRetries: number;
  /** Delay between retries in milliseconds */
  retryDelay: number;
}
