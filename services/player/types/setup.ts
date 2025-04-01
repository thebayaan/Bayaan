import {Capability, AppKilledPlaybackBehavior} from 'react-native-track-player';

/**
 * Interface for Android notification content intent
 * @interface AndroidContentIntent
 */
export interface AndroidContentIntent {
  component: string;
  package: string;
  action: string;
  category: string;
  flags?: string[];
}

/**
 * Configuration options for the TrackPlayer setup.
 * @interface SetupConfig
 */
export interface SetupConfig {
  /**
   * Configuration options for the TrackPlayer instance.
   * @property {Object} player - Player-specific configuration options
   * @property {boolean} [player.waitForBuffer=false] - Whether to wait for buffer before playing
   * @property {number} [player.minBuffer=15] - Minimum buffer size in seconds
   * @property {number} [player.maxBuffer=50] - Maximum buffer size in seconds
   * @property {boolean} [player.autoHandleInterruptions=true] - Whether to handle audio interruptions automatically
   */
  player: {
    waitForBuffer?: boolean;
    minBuffer?: number;
    maxBuffer?: number;
    autoHandleInterruptions?: boolean;
  };

  /**
   * Configuration options for the player capabilities and behavior.
   * @property {Object} options - Player options and capabilities
   * @property {Capability[]} [options.capabilities] - Array of player capabilities
   * @property {Capability[]} [options.notificationCapabilities] - Array of notification capabilities
   * @property {Capability[]} [options.compactCapabilities] - Array of compact view capabilities
   * @property {number} [options.progressUpdateEventInterval] - Interval for progress updates in seconds
   */
  options: {
    capabilities?: Capability[];
    notificationCapabilities?: Capability[];
    compactCapabilities?: Capability[];
    progressUpdateEventInterval?: number;
    android?: {
      appKilledPlaybackBehavior?: AppKilledPlaybackBehavior;
      alwaysPauseOnInterruption?: boolean;
      notification?: {
        channelId: string;
        channelName: string;
        color?: number;
        icon?: string;
        largeIcon?: boolean;
        smallIcon?: string;
        /**
         * The action to be executed when notification is clicked
         */
        clickAction?: string;
        /**
         * The content intent configuration for notification click
         */
        contentIntent?: AndroidContentIntent;
      };
    };
    ios?: {
      capabilities?: Capability[];
      backgroundOptions?: {
        appIconBadgeNumber?: boolean;
        backgroundPlayback?: boolean;
      };
      artwork?: {
        enabled?: boolean;
        imageFormat?: 'JPEG' | 'PNG';
        quality?: number;
        maxWidth?: number;
        maxHeight?: number;
      };
    };
  };
}

/**
 * Status of the TrackPlayer setup process.
 * @interface SetupStatus
 */
export interface SetupStatus {
  /**
   * Whether the TrackPlayer has been successfully initialized.
   */
  isInitialized: boolean;

  /**
   * Any error that occurred during initialization.
   */
  error?: Error;
}

/**
 * Events emitted during the setup process.
 * @interface SetupEvents
 */
export interface SetupEvents {
  /**
   * Emitted when setup is complete.
   */
  setupComplete: () => void;

  /**
   * Emitted when an error occurs during setup.
   * @param error - The error that occurred
   */
  setupError: (error: Error) => void;

  /**
   * Emitted when state restoration begins.
   */
  stateRestoreStart: () => void;

  /**
   * Emitted when state restoration is complete.
   */
  stateRestoreComplete: () => void;
}
