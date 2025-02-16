import TrackPlayer from 'react-native-track-player';
import { usePlayerStore } from '../store/playerStore';
import { StateRestorationError } from '../types/errors';
import { setupEventBridge } from '../events/bridge';
import { Track } from '@/types/audio';

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
    console.log('[State Recovery] Starting state restoration...');
    const store = usePlayerStore.getState();
    
    console.log('[State Recovery] Getting persisted state...');
    const persistedState = await store.getPersistedState() as PersistedState;
    console.log('[State Recovery] Persisted state:', persistedState);

    if (!persistedState) {
      console.log('[State Recovery] No persisted state found');
      return;
    }

    console.log('[State Recovery] Restoring queue...');
    if (persistedState.queue?.tracks?.length > 0) {
      await store.updateQueue(
        persistedState.queue.tracks,
        persistedState.queue.currentIndex,
      );
      console.log('[State Recovery] Queue restored');
    }

    console.log('[State Recovery] Restoring playback state...');
    if (persistedState.playback) {
      const {position, rate} = persistedState.playback;
      if (typeof position === 'number') {
        await store.seekTo(position);
      }
      if (typeof rate === 'number') {
        await store.setRate(rate);
      }
      console.log('[State Recovery] Playback state restored');
    }

    console.log('[State Recovery] Restoring settings...');
    if (persistedState.settings) {
      store.updateSettings(persistedState.settings);
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