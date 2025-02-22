import TrackPlayer, {State, RepeatMode} from 'react-native-track-player';
import {usePlayerStore} from '../store/playerStore';
import {StateRestorationError} from '../types/errors';
import {Track} from '@/types/audio';
import {isPlayerInitialized} from './setup';

/**
 * Interface for persisted player state
 * @interface PersistedState
 */
interface PersistedState {
  queue?: {
    tracks: Track[];
    currentIndex: number;
  };
  playback?: {
    position: number;
    rate: number;
  };
  settings?: {
    repeatMode: 'off' | 'track' | 'queue';
    shuffle: boolean;
    skipSilence: boolean;
  };
}

/**
 * Waits for track to be ready and returns its duration
 */
async function waitForTrackReady(timeoutMs = 5000): Promise<number> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    try {
      const state = await TrackPlayer.getState();
      if (state === State.Ready || state === State.Playing) {
        const duration = await TrackPlayer.getDuration();
        if (duration > 0) {
          return duration;
        }
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.warn('[State Recovery] Error waiting for track:', error);
    }
  }
  throw new Error('Timeout waiting for track to be ready');
}

/**
 * Restores the player state from persistence.
 * This includes queue, playback position, and settings.
 *
 * @async
 * @throws {StateRestorationError} If state restoration fails
 *
 * @example
 * ```typescript
 * try {
 *   await restorePlayerState();
 *   console.log('State restored successfully');
 * } catch (error) {
 *   console.error('State restoration failed:', error);
 * }
 * ```
 */
export async function restorePlayerState(): Promise<void> {
  try {
    // Check if player is initialized
    if (!isPlayerInitialized()) {
      throw new StateRestorationError('Player is not initialized');
    }

    // Check if service is running
    const isServiceRunning = await TrackPlayer.isServiceRunning();
    if (!isServiceRunning) {
      throw new StateRestorationError('Player service is not running');
    }

    console.log('[State Recovery] Starting state restoration...');
    const store = usePlayerStore.getState();

    console.log('[State Recovery] Getting persisted state...');
    const persistedState = (await store.getPersistedState()) as PersistedState;
    console.log('[State Recovery] Persisted state:', persistedState);

    if (!persistedState?.queue?.tracks) {
      console.log('[State Recovery] No persisted state or tracks found');
      return;
    }

    // Reset player before restoring state
    await TrackPlayer.reset();
    console.log('[State Recovery] Player reset complete');

    console.log('[State Recovery] Restoring queue...');
    const tracks = persistedState.queue.tracks;
    const currentIndex = persistedState.queue.currentIndex || 0;

    // Validate tracks
    const validTracks = tracks.filter(
      track => track && track.url && track.title && track.artist,
    );

    if (validTracks.length === 0) {
      console.log('[State Recovery] No valid tracks found');
      return;
    }

    // Add tracks to queue
    await TrackPlayer.add(validTracks);
    console.log('[State Recovery] Tracks added to queue');

    // Skip to correct track
    if (currentIndex > 0 && currentIndex < validTracks.length) {
      await TrackPlayer.skip(currentIndex);
      console.log('[State Recovery] Skipped to track:', currentIndex);
    }

    // Wait for track to be ready and get duration
    let duration = 0;
    try {
      duration = await waitForTrackReady();
      console.log('[State Recovery] Track ready with duration:', duration);
    } catch (error) {
      console.warn('[State Recovery] Error waiting for track:', error);
      // Try to get duration directly as fallback
      duration = await TrackPlayer.getDuration();
    }

    // Update queue state
    store.updateQueueState({
      tracks: validTracks,
      currentIndex,
      total: validTracks.length,
    });
    console.log('[State Recovery] Queue state updated');

    // Restore playback state
    console.log('[State Recovery] Restoring playback state...');
    if (persistedState.playback) {
      const {position, rate} = persistedState.playback;

      // Set playback rate
      if (typeof rate === 'number') {
        await TrackPlayer.setRate(rate);
      }

      // Only seek if we have a valid duration and position
      if (
        duration > 0 &&
        typeof position === 'number' &&
        position > 0 &&
        position < duration
      ) {
        await TrackPlayer.seekTo(position);
        console.log('[State Recovery] Seeked to position:', position);
      }

      // Update playback state in store
      const currentState = await TrackPlayer.getState();
      store.updatePlaybackState({
        state: currentState,
        position: position || 0,
        duration: duration || 0,
        rate: rate || 1,
      });
      console.log('[State Recovery] Playback state restored');
    }

    // Restore settings
    console.log('[State Recovery] Restoring settings...');
    if (persistedState.settings) {
      const {repeatMode, shuffle, skipSilence} = persistedState.settings;

      // Update repeat mode
      if (repeatMode) {
        // Map our repeat mode to TrackPlayer's RepeatMode
        const trackPlayerRepeatMode = {
          off: RepeatMode.Off,
          track: RepeatMode.Track,
          queue: RepeatMode.Queue,
        }[repeatMode];

        await TrackPlayer.setRepeatMode(trackPlayerRepeatMode);
      }

      // Update other settings through individual actions
      if (typeof shuffle === 'boolean' && shuffle !== store.settings.shuffle) {
        store.toggleShuffle();
      }
      if (
        typeof skipSilence === 'boolean' &&
        skipSilence !== store.settings.skipSilence
      ) {
        store.toggleSkipSilence();
      }

      console.log('[State Recovery] Settings restored');
    }

    console.log('[State Recovery] State restoration completed successfully');
  } catch (error) {
    console.error('[State Recovery] State restoration failed:', error);
    throw new StateRestorationError(
      error instanceof Error ? error.message : 'Failed to restore player state',
    );
  }
}

/**
 * Persists the current player state.
 * This should be called before the app is closed or backgrounded.
 *
 * @async
 * @throws {StateRestorationError} If state persistence fails
 */
export async function persistPlayerState(): Promise<void> {
  try {
    console.log('[State Recovery] Starting state persistence...');
    const store = usePlayerStore.getState();
    const {queue, playback, settings} = store;

    console.log('[State Recovery] Persisting state...');
    await store.persistState({
      queue,
      playback,
      settings,
    });
    console.log('[State Recovery] State persisted successfully');
  } catch (error) {
    console.error('[State Recovery] State persistence failed:', error);
    throw new StateRestorationError(
      error instanceof Error ? error.message : 'Failed to persist player state',
    );
  }
}
