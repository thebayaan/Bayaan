import TrackPlayer, {
  Capability,
  IOSCategory,
  IOSCategoryMode,
  IOSCategoryOptions,
  AppKilledPlaybackBehavior,
} from 'react-native-track-player';
import {SetupConfig, SetupStatus} from '../types/setup';
import {PlayerSetupError} from '../types/errors';
import {setupEventBridge} from '../events/bridge';

/**
 * Tracks the initialization status of TrackPlayer
 * @private
 */
let isSetup = false;

/**
 * Default configuration for TrackPlayer setup
 * @private
 */
const DEFAULT_CONFIG: SetupConfig = {
  player: {
    waitForBuffer: false,
    minBuffer: 15,
    maxBuffer: 50,
    autoHandleInterruptions: true,
  },
  options: {
    capabilities: [
      Capability.Play,
      Capability.Pause,
      Capability.SkipToNext,
      Capability.SkipToPrevious,
      Capability.SeekTo,
      Capability.Stop,
      Capability.JumpForward,
      Capability.JumpBackward,
    ],
    notificationCapabilities: [
      Capability.Play,
      Capability.Pause,
      Capability.SkipToNext,
      Capability.SkipToPrevious,
      Capability.SeekTo,
      Capability.Stop,
    ],
    compactCapabilities: [
      Capability.Play,
      Capability.Pause,
      Capability.SkipToNext,
      Capability.SkipToPrevious,
    ],
    progressUpdateEventInterval: 2,
    android: {
      appKilledPlaybackBehavior: AppKilledPlaybackBehavior.ContinuePlayback,
      alwaysPauseOnInterruption: false,
      notification: {
        channelId: 'com.bayaan.player',
        channelName: 'Bayaan Player',
        color: 0x000000,
        icon: 'notification_icon',
        largeIcon: true,
        smallIcon: 'notification_icon',
      },
    },
    ios: {
      capabilities: [
        Capability.Play,
        Capability.Pause,
        Capability.SkipToNext,
        Capability.SkipToPrevious,
        Capability.Stop,
        Capability.SeekTo,
      ],
      backgroundOptions: {
        appIconBadgeNumber: true,
        backgroundPlayback: true,
      },
      // Configure iOS artwork settings
      artwork: {
        enabled: true,
        imageFormat: 'JPEG',
        quality: 0.8,
        maxWidth: 1024,
        maxHeight: 1024,
      },
    },
  },
};

/**
 * Sets up the TrackPlayer instance with the specified configuration.
 * This function should be called once during app initialization.
 *
 * @async
 * @param {Partial<SetupConfig>} [config] - Optional configuration to override defaults
 * @returns {Promise<SetupStatus>} The setup status
 * @throws {PlayerSetupError} If setup fails
 *
 * @example
 * ```typescript
 * try {
 *   const status = await setupTrackPlayer({
 *     player: { minBuffer: 30 }
 *   });
 *   console.log('Setup complete:', status);
 * } catch (error) {
 *   console.error('Setup failed:', error);
 * }
 * ```
 */
export async function setupTrackPlayer(
  config?: Partial<SetupConfig>,
): Promise<SetupStatus> {
  try {
    // First check if the service is running
    const serviceRunning = await TrackPlayer.isServiceRunning();
    console.log('[Player Setup] Service running status:', serviceRunning);

    // If service is running, try to get player state
    if (serviceRunning) {
      try {
        const state = await TrackPlayer.getState();
        console.log('[Player Setup] Current player state:', state);

        // If we can get the state, player is already initialized
        console.log(
          '[Player Setup] Player already initialized, updating capabilities',
        );
        await TrackPlayer.updateOptions({
          ...DEFAULT_CONFIG.options,
          ...config?.options,
          android: {
            appKilledPlaybackBehavior:
              AppKilledPlaybackBehavior.ContinuePlayback,
            alwaysPauseOnInterruption: false,
          },
        });

        isSetup = true;
        setupEventBridge.emit('setupComplete');
        return {isInitialized: true};
      } catch (stateError) {
        // If we can't get state, service might be in an inconsistent state
        console.log(
          '[Player Setup] Service running but state check failed, resetting player',
        );
        try {
          await TrackPlayer.reset();
        } catch (resetError) {
          console.log(
            '[Player Setup] Reset failed, proceeding with setup',
            resetError,
          );
        }
      }
    }

    // Proceed with fresh setup
    console.log('[Player Setup] Proceeding with fresh setup');
    await TrackPlayer.setupPlayer({
      ...DEFAULT_CONFIG.player,
      ...config?.player,
      iosCategory: IOSCategory.Playback,
      iosCategoryMode: IOSCategoryMode.SpokenAudio,
      iosCategoryOptions: [
        IOSCategoryOptions.AllowAirPlay,
        IOSCategoryOptions.AllowBluetooth,
        IOSCategoryOptions.AllowBluetoothA2DP,
        IOSCategoryOptions.DuckOthers,
      ],
    });

    await TrackPlayer.updateOptions({
      ...DEFAULT_CONFIG.options,
      ...config?.options,
      android: {
        appKilledPlaybackBehavior: AppKilledPlaybackBehavior.ContinuePlayback,
        alwaysPauseOnInterruption: false,
      },
    });

    isSetup = true;
    setupEventBridge.emit('setupComplete');
    return {isInitialized: true};
  } catch (error) {
    console.error('[Player Setup] Setup failed:', error);
    // Only reset isSetup if we actually failed to initialize
    if (!(await TrackPlayer.isServiceRunning())) {
      isSetup = false;
    }
    const setupError = new PlayerSetupError(
      error instanceof Error ? error.message : 'Failed to setup TrackPlayer',
    );
    setupEventBridge.emit('setupError', setupError);
    return {
      isInitialized: false,
      error: setupError,
    };
  }
}

/**
 * Checks if TrackPlayer has been initialized.
 * @returns {boolean} Whether TrackPlayer is initialized
 */
export function isPlayerInitialized(): boolean {
  return isSetup;
}

/**
 * Resets the TrackPlayer setup state.
 * This is mainly used for testing purposes.
 * @private
 */
export function _resetSetupState(): void {
  isSetup = false;
}
