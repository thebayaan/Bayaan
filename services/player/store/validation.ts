import {
  UnifiedPlayerState,
  PlaybackState,
  QueueState,
  LoadingState,
  ErrorState,
  PlaybackSettings,
  UIState,
  StateValidationError,
  PlayerState,
} from '../types/state';

/**
 * Valid PlayerState values for validation
 */
const VALID_PLAYER_STATES: readonly PlayerState[] = [
  'none',
  'loading',
  'buffering',
  'ready',
  'playing',
  'paused',
  'stopped',
  'ended',
  'error',
] as const;

/**
 * Type guard to check if a value is an Error
 */
function isError(value: unknown): value is Error {
  return value instanceof Error;
}

/**
 * Validates playback state
 * @throws {StateValidationError} if validation fails
 */
function validatePlaybackState(state: unknown): asserts state is PlaybackState {
  if (!state || typeof state !== 'object') {
    throw new StateValidationError('Invalid playback state structure');
  }

  const playback = state as PlaybackState;

  // Validate state
  if (!VALID_PLAYER_STATES.includes(playback.state)) {
    throw new StateValidationError(
      'Invalid playback state value',
      'state',
      'PlayerState',
      playback.state,
    );
  }

  // Validate numeric values
  if (typeof playback.position !== 'number' || playback.position < 0) {
    throw new StateValidationError(
      'Invalid position value',
      'position',
      'number >= 0',
      playback.position,
    );
  }

  if (typeof playback.duration !== 'number' || playback.duration < 0) {
    throw new StateValidationError(
      'Invalid duration value',
      'duration',
      'number >= 0',
      playback.duration,
    );
  }

  if (typeof playback.rate !== 'number' || playback.rate <= 0) {
    throw new StateValidationError(
      'Invalid rate value',
      'rate',
      'number > 0',
      playback.rate,
    );
  }

  if (typeof playback.buffering !== 'boolean') {
    throw new StateValidationError(
      'Invalid buffering value',
      'buffering',
      'boolean',
      playback.buffering,
    );
  }
}

/**
 * Validates queue state
 * @throws {StateValidationError} if validation fails
 */
function validateQueueState(state: unknown): asserts state is QueueState {
  if (!state || typeof state !== 'object') {
    throw new StateValidationError('Invalid queue state structure');
  }

  const queue = state as QueueState;

  // Validate tracks array
  if (!Array.isArray(queue.tracks)) {
    throw new StateValidationError(
      'Invalid tracks value',
      'tracks',
      'Track[]',
      queue.tracks,
    );
  }

  // Validate track objects
  queue.tracks.forEach((track, index) => {
    if (!track || typeof track !== 'object') {
      throw new StateValidationError(
        `Invalid track at index ${index}`,
        `tracks[${index}]`,
        'Track',
        track,
      );
    }
  });

  // Validate numeric values
  if (
    typeof queue.currentIndex !== 'number' ||
    queue.currentIndex < -1 ||
    queue.currentIndex >= queue.tracks.length
  ) {
    throw new StateValidationError(
      'Invalid currentIndex value',
      'currentIndex',
      'number within tracks range',
      queue.currentIndex,
    );
  }

  if (typeof queue.total !== 'number' || queue.total < 0) {
    throw new StateValidationError(
      'Invalid total value',
      'total',
      'number >= 0',
      queue.total,
    );
  }

  // Validate boolean values
  if (typeof queue.loading !== 'boolean') {
    throw new StateValidationError(
      'Invalid loading value',
      'loading',
      'boolean',
      queue.loading,
    );
  }

  if (typeof queue.endReached !== 'boolean') {
    throw new StateValidationError(
      'Invalid endReached value',
      'endReached',
      'boolean',
      queue.endReached,
    );
  }
}

/**
 * Validates loading state
 * @throws {StateValidationError} if validation fails
 */
function validateLoadingState(state: unknown): asserts state is LoadingState {
  if (!state || typeof state !== 'object') {
    throw new StateValidationError('Invalid loading state structure');
  }

  const loading = state as LoadingState;

  // Validate boolean values
  ['trackLoading', 'queueLoading', 'stateRestoring'].forEach(key => {
    if (typeof loading[key as keyof LoadingState] !== 'boolean') {
      throw new StateValidationError(
        `Invalid ${key} value`,
        key,
        'boolean',
        loading[key as keyof LoadingState],
      );
    }
  });
}

/**
 * Validates error state
 * @throws {StateValidationError} if validation fails
 */
function validateErrorState(state: unknown): asserts state is ErrorState {
  if (!state || typeof state !== 'object') {
    throw new StateValidationError('Invalid error state structure');
  }

  const error = state as ErrorState;

  // Validate error objects
  ['playback', 'queue', 'system'].forEach(key => {
    const value = error[key as keyof ErrorState];
    if (value !== null && !isError(value)) {
      throw new StateValidationError(
        `Invalid ${key} error value`,
        key,
        'Error | null',
        value,
      );
    }
  });
}

/**
 * Validates playback settings
 * @throws {StateValidationError} if validation fails
 */
function validatePlaybackSettings(
  state: unknown,
): asserts state is PlaybackSettings {
  if (!state || typeof state !== 'object') {
    throw new StateValidationError('Invalid settings structure');
  }

  const settings = state as PlaybackSettings;

  // Validate repeat mode
  if (!['none', 'track', 'queue'].includes(settings.repeatMode)) {
    throw new StateValidationError(
      'Invalid repeatMode value',
      'repeatMode',
      "'none' | 'track' | 'queue'",
      settings.repeatMode,
    );
  }

  // Validate boolean values
  if (typeof settings.shuffle !== 'boolean') {
    throw new StateValidationError(
      'Invalid shuffle value',
      'shuffle',
      'boolean',
      settings.shuffle,
    );
  }

  if (typeof settings.skipSilence !== 'boolean') {
    throw new StateValidationError(
      'Invalid skipSilence value',
      'skipSilence',
      'boolean',
      settings.skipSilence,
    );
  }

  // Validate sleep timer
  if (
    typeof settings.sleepTimer !== 'number' ||
    settings.sleepTimer < 0 ||
    !Number.isInteger(settings.sleepTimer)
  ) {
    throw new StateValidationError(
      'Invalid sleepTimer value',
      'sleepTimer',
      'non-negative integer',
      settings.sleepTimer,
    );
  }

  // Validate sleep timer end time
  if (
    settings.sleepTimerEnd !== null &&
    (typeof settings.sleepTimerEnd !== 'number' || settings.sleepTimerEnd < 0)
  ) {
    throw new StateValidationError(
      'Invalid sleepTimerEnd value',
      'sleepTimerEnd',
      'positive number or null',
      settings.sleepTimerEnd,
    );
  }
}

/**
 * Validates UI state
 * @throws {StateValidationError} if validation fails
 */
function validateUIState(state: unknown): asserts state is UIState {
  if (!state || typeof state !== 'object') {
    throw new StateValidationError('Invalid UI state structure');
  }

  const ui = state as UIState;

  if (!['hidden', 'full'].includes(ui.sheetMode)) {
    throw new StateValidationError(
      'Invalid sheet mode value',
      'sheetMode',
      "'hidden' | 'full'",
      ui.sheetMode,
    );
  }

  if (typeof ui.isTransitioning !== 'boolean') {
    throw new StateValidationError(
      'Invalid transitioning value',
      'isTransitioning',
      'boolean',
      ui.isTransitioning,
    );
  }
}

/**
 * Validates the entire unified player state
 * @throws {StateValidationError} if validation fails
 */
export function validateUnifiedPlayerState(
  state: unknown,
): asserts state is UnifiedPlayerState {
  if (!state || typeof state !== 'object') {
    throw new StateValidationError('Invalid unified player state structure');
  }

  const unified = state as UnifiedPlayerState;

  try {
    validatePlaybackState(unified.playback);
    validateQueueState(unified.queue);
    validateLoadingState(unified.loading);
    validateErrorState(unified.error);
    validatePlaybackSettings(unified.settings);
    validateUIState(unified.ui);
  } catch (error) {
    if (error instanceof StateValidationError) {
      throw error;
    }
    throw new StateValidationError('Unexpected validation error');
  }
}

/**
 * Creates a default unified player state
 */
export function createDefaultUnifiedPlayerState(): UnifiedPlayerState {
  return {
    playback: {
      state: 'none',
      position: 0,
      duration: 0,
      rate: 1,
      buffering: false,
    },
    queue: {
      tracks: [],
      currentIndex: -1,
      total: 0,
      loading: false,
      endReached: false,
    },
    loading: {
      trackLoading: false,
      queueLoading: false,
      stateRestoring: false,
    },
    error: {
      playback: null,
      queue: null,
      system: null,
    },
    settings: {
      repeatMode: 'none',
      shuffle: false,
      sleepTimer: 0,
      sleepTimerEnd: null,
      sleepTimerInterval: null,
      skipSilence: false,
    },
    ui: {
      sheetMode: 'hidden',
      isTransitioning: false,
    },
  };
}

/**
 * Creates a default UI state
 */
export function createDefaultUIState(): UIState {
  return {
    sheetMode: 'hidden',
    isTransitioning: false,
  };
}
