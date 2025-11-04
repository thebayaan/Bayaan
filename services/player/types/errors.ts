/**
 * Base error class for player-related errors.
 * @class PlayerError
 * @extends Error
 */
export class PlayerError extends Error {
  /**
   * Creates a new PlayerError instance.
   * @param {string} message - The error message
   * @param {Object} [options] - Additional error options
   */
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'PlayerError';
  }
}

/**
 * Error thrown when player setup fails.
 * @class PlayerSetupError
 * @extends PlayerError
 */
export class PlayerSetupError extends PlayerError {
  /**
   * Creates a new PlayerSetupError instance.
   * @param {string} message - The error message
   * @param {Object} [options] - Additional error options
   */
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'PlayerSetupError';
  }
}

/**
 * Error thrown when state restoration fails.
 * @class StateRestorationError
 * @extends PlayerError
 */
export class StateRestorationError extends PlayerError {
  /**
   * Creates a new StateRestorationError instance.
   * @param {string} message - The error message
   * @param {Object} [options] - Additional error options
   */
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'StateRestorationError';
  }
}

/**
 * Error thrown when audio session management fails.
 * @class AudioSessionError
 * @extends PlayerError
 */
export class AudioSessionError extends PlayerError {
  /**
   * Creates a new AudioSessionError instance.
   * @param {string} message - The error message
   * @param {Object} [options] - Additional error options
   */
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'AudioSessionError';
  }
} 