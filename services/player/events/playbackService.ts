import TrackPlayer, {
  Event,
  State,
  RepeatMode,
  Track,
} from 'react-native-track-player';
import {usePlayerStore} from '../store/playerStore';
import {useRecentlyPlayedStore} from '../store/recentlyPlayedStore';
import {isPlayerInitialized} from '../utils/setup';

// Get store instance outside of event handlers
let store = usePlayerStore.getState();
let recentlyPlayedStore = useRecentlyPlayedStore.getState();

// Subscribe to store changes
usePlayerStore.subscribe(newState => {
  store = newState;
});

useRecentlyPlayedStore.subscribe(newState => {
  recentlyPlayedStore = newState;
});

// Add a helper function to validate track state
async function validateTrackState(): Promise<{
  isValid: boolean;
  track: Track | null;
  duration: number;
  error?: string;
}> {
  try {
    const currentTrack = await TrackPlayer.getCurrentTrack();
    if (currentTrack === null) {
      return {
        isValid: false,
        track: null,
        duration: 0,
        error: 'No current track',
      };
    }

    const track = await TrackPlayer.getTrack(currentTrack);
    if (!track) {
      return {
        isValid: false,
        track: null,
        duration: 0,
        error: 'Track not found',
      };
    }

    // Validate track properties
    if (!track.url || !track.title || !track.artist) {
      return {
        isValid: false,
        track,
        duration: 0,
        error: 'Invalid track metadata',
      };
    }

    // Check if URL is accessible
    try {
      const response = await fetch(track.url, {method: 'HEAD'});
      if (!response.ok) {
        return {
          isValid: false,
          track,
          duration: 0,
          error: `Track URL not accessible: ${response.status}`,
        };
      }
    } catch (error) {
      return {
        isValid: false,
        track,
        duration: 0,
        error: `Track URL error: ${(error as Error).message}`,
      };
    }

    const duration = await TrackPlayer.getDuration();
    if (!duration || duration <= 0) {
      return {
        isValid: false,
        track,
        duration: 0,
        error: `Invalid duration: ${duration}`,
      };
    }

    return {
      isValid: true,
      track,
      duration,
    };
  } catch (error) {
    return {
      isValid: false,
      track: null,
      duration: 0,
      error: `Validation error: ${(error as Error).message}`,
    };
  }
}

// Add a helper function to recover from errors
async function recoverFromError(
  track: Track,
  desiredState: State,
): Promise<boolean> {
  try {
    console.log('[PlaybackService] Attempting track recovery:', {
      track: track?.title,
      desiredState,
    });

    // First check if the track is still in a valid state
    const currentTrack = await TrackPlayer.getCurrentTrack();
    const currentState = await TrackPlayer.getState();

    // If we're already in a good state, no need to recover
    if (currentTrack !== null && currentState === State.Ready) {
      console.log(
        '[PlaybackService] Track already in valid state, skipping recovery',
      );
      return true;
    }

    // Reset player and wait a moment
    await TrackPlayer.reset();
    await new Promise(resolve => setTimeout(resolve, 500));

    // Re-add the track
    await TrackPlayer.add([track]);

    // Wait for track to be ready
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      const state = await TrackPlayer.getState();
      const trackIndex = await TrackPlayer.getCurrentTrack();

      // Verify both state and track index
      if (state === State.Ready && trackIndex !== null) {
        // Double check the track is actually loaded
        const loadedTrack = await TrackPlayer.getTrack(trackIndex);
        if (!loadedTrack) {
          console.log(
            '[PlaybackService] Track not properly loaded, retrying...',
          );
          attempts++;
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }

        // If desired state was playing, attempt to play
        if (desiredState === State.Playing) {
          try {
            await TrackPlayer.play();
            // Wait briefly to ensure playback actually started
            await new Promise(resolve => setTimeout(resolve, 500));
            const finalState = await TrackPlayer.getState();
            if (finalState === State.Error) {
              console.log('[PlaybackService] Play attempt failed, retrying...');
              attempts++;
              continue;
            }
          } catch (playError) {
            console.error(
              '[PlaybackService] Error during play attempt:',
              playError,
            );
            attempts++;
            continue;
          }
        }

        console.log('[PlaybackService] Recovery successful');
        return true;
      }

      console.log('[PlaybackService] Waiting for track to be ready:', {
        attempt: attempts + 1,
        state,
        trackIndex,
      });

      attempts++;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(
      '[PlaybackService] Recovery failed after',
      maxAttempts,
      'attempts',
    );
    return false;
  } catch (error) {
    console.error('[PlaybackService] Recovery failed with error:', error);
    return false;
  }
}

/**
 * Restores the player state from the store
 */
async function restorePlayerState() {
  try {
    // Check if player is initialized
    if (!isPlayerInitialized()) {
      console.log(
        '[PlaybackService] Player not initialized, skipping state restoration',
      );
      return;
    }

    // Check if service is running
    const isServiceRunning = await TrackPlayer.isServiceRunning();
    if (!isServiceRunning) {
      console.log(
        '[PlaybackService] Service not running, skipping state restoration',
      );
      return;
    }

    const {queue, playback, settings} = store;

    // Restore repeat mode
    const repeatMode = {
      none: RepeatMode.Off,
      queue: RepeatMode.Queue,
      track: RepeatMode.Track,
    }[settings.repeatMode];
    await TrackPlayer.setRepeatMode(repeatMode);

    console.log('[PlaybackService] Attempting to restore state:', {
      hasQueue: !!queue,
      hasTracks: !!queue?.tracks,
      trackCount: queue?.tracks?.length || 0,
      currentIndex: queue?.currentIndex,
      playbackState: playback?.state,
      storeState: store,
    });

    // Check if we have tracks to restore
    if (
      !queue?.tracks ||
      !Array.isArray(queue.tracks) ||
      queue.tracks.length === 0
    ) {
      console.log('[PlaybackService] No valid tracks to restore');
      return;
    }

    // Validate track objects
    const validTracks = queue.tracks.filter(track => {
      const isValid = track && track.url && track.title && track.artist;
      if (!isValid) {
        console.log('[PlaybackService] Invalid track found:', track);
      }
      return isValid;
    });

    if (validTracks.length === 0) {
      console.log('[PlaybackService] No valid tracks after filtering');
      return;
    }

    // Get the current track and its index
    const currentIndex = queue.currentIndex;
    if (currentIndex < 0 || currentIndex >= validTracks.length) {
      console.log('[PlaybackService] Invalid current index:', currentIndex);
      return;
    }

    console.log('[PlaybackService] Starting state restoration:', {
      originalTracks: queue.tracks.length,
      validTracks: validTracks.length,
      currentIndex,
      playbackState: playback.state,
    });

    // Reset and restore the queue
    await TrackPlayer.reset();
    console.log('[PlaybackService] Player reset complete');

    await TrackPlayer.add(validTracks);
    console.log('[PlaybackService] Tracks added to player');

    // Skip to the current track if needed
    if (currentIndex > 0) {
      await TrackPlayer.skip(currentIndex);
      console.log('[PlaybackService] Skipped to track:', currentIndex);
    }

    // Wait for track to be ready
    const playerState = await TrackPlayer.getState();
    const currentTrack = await TrackPlayer.getCurrentTrack();
    const trackInfo =
      currentTrack !== null ? await TrackPlayer.getTrack(currentTrack) : null;

    console.log('[PlaybackService] Player status:', {
      state: playerState,
      currentTrack,
      trackInfo,
    });

    // Restore playback position if available
    if (playback.position > 0) {
      await TrackPlayer.seekTo(playback.position);
      console.log('[PlaybackService] Position restored:', playback.position);
    }

    // Restore playback state
    if (playback.state === State.Playing || playback.state === State.Ready) {
      try {
        await TrackPlayer.play();
        console.log('[PlaybackService] Playback resumed');
      } catch (playError) {
        console.error('[PlaybackService] Error resuming playback:', playError);
      }
    }

    // Update store state to match actual player state
    const finalState = await TrackPlayer.getState();
    const finalPosition = await TrackPlayer.getPosition();
    const finalDuration = await TrackPlayer.getDuration();

    store.updatePlaybackState({
      state: finalState,
      position: finalPosition,
      duration: finalDuration,
    });

    console.log('[PlaybackService] Final player state:', {
      state: finalState,
      position: finalPosition,
      duration: finalDuration,
      currentTrack: await TrackPlayer.getCurrentTrack(),
    });
  } catch (error) {
    console.error('[PlaybackService] Error restoring state:', error);
    // Try to reset to a clean state
    try {
      await TrackPlayer.reset();
      store.updatePlaybackState({
        state: State.None,
        position: 0,
        duration: 0,
      });
    } catch (resetError) {
      console.error('[PlaybackService] Error resetting player:', resetError);
    }
  }
}

/**
 * Handles all playback events and remote control events for the player.
 * This service runs in the background and manages the player's state.
 */
export async function playbackService() {
  // Restore player state when service starts
  await restorePlayerState();

  // Remote Controls
  TrackPlayer.addEventListener(Event.RemotePlay, () => store.play());
  TrackPlayer.addEventListener(Event.RemotePause, () => store.pause());
  TrackPlayer.addEventListener(Event.RemoteStop, () => store.pause());
  TrackPlayer.addEventListener(Event.RemoteNext, () => store.skipToNext());
  TrackPlayer.addEventListener(Event.RemotePrevious, () =>
    store.skipToPrevious(),
  );

  // Seek Controls
  TrackPlayer.addEventListener(Event.RemoteSeek, ({position}) =>
    store.seekTo(position),
  );

  TrackPlayer.addEventListener(Event.RemoteJumpForward, async () => {
    const position = await TrackPlayer.getPosition();
    store.seekTo(position + 15);
  });

  TrackPlayer.addEventListener(Event.RemoteJumpBackward, async () => {
    const position = await TrackPlayer.getPosition();
    store.seekTo(Math.max(0, position - 15));
  });

  // State Management - Batch updates to prevent cascading re-renders
  let batchTimeout: NodeJS.Timeout | null = null;
  const batchedStateUpdate = (updates: () => void) => {
    if (batchTimeout) {
      clearTimeout(batchTimeout);
    }
    batchTimeout = setTimeout(() => {
      updates();
      batchTimeout = null;
    }, 100); // Batch updates within 100ms window
  };

  // Playback State
  TrackPlayer.addEventListener(Event.PlaybackState, async ({state}) => {
    try {
      if (state === State.Error) {
        console.error('[PlaybackService] Playback error state detected');
        const validation = await validateTrackState();

        if (validation.error) {
          console.error(
            '[PlaybackService] Validation error:',
            validation.error,
          );
          store.setError('playback', new Error(validation.error));
        }

        if (validation.track) {
          const recovered = await recoverFromError(
            validation.track,
            State.Playing,
          );
          if (!recovered) {
            store.setError(
              'playback',
              new Error(
                'Unable to recover from playback error after multiple attempts',
              ),
            );
            // Reset the player to a clean state
            await TrackPlayer.reset();
            store.updatePlaybackState({
              state: State.None,
              position: 0,
              duration: 0,
            });
          }
        }
        return;
      }

      // For Ready or Playing states, validate track
      if (state === State.Ready || state === State.Playing) {
        const validation = await validateTrackState();
        if (!validation.isValid) {
          console.warn(
            '[PlaybackService] Invalid track state:',
            validation.error,
          );
          if (validation.track) {
            const recovered = await recoverFromError(validation.track, state);
            if (!recovered) {
              store.setError(
                'playback',
                new Error(validation.error || 'Track validation failed'),
              );
              return;
            }
          }
        }

        // Update store with validated duration
        batchedStateUpdate(() => {
          store.updatePlaybackState({
            state,
            position: 0,
            duration: validation.duration,
          });
          store.updateLoadingState({trackLoading: false});
          // Clear any previous errors
          store.setError('playback', null);
        });
      } else {
        // For other states, just update the store
        const position = await TrackPlayer.getPosition();
        const duration = await TrackPlayer.getDuration();

        batchedStateUpdate(() => {
          store.updatePlaybackState({
            state,
            position: position || 0,
            duration: duration || 0,
          });
          store.updateLoadingState({trackLoading: false});
        });
      }
    } catch (error) {
      console.error('[PlaybackService] Error handling playback state:', error);
      store.setError(
        'playback',
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  });

  // Track Changes
  TrackPlayer.addEventListener(Event.PlaybackTrackChanged, async event => {
    // Ensure we have a valid track index
    if (typeof event.nextTrack !== 'number' || event.nextTrack < 0) {
      console.log('[PlaybackService] Invalid track index:', event.nextTrack);
      return;
    }

    try {
      // Update queue state immediately
      store.updateQueueState({
        currentIndex: event.nextTrack,
      });

      // Get current queue to validate track index
      const queue = await TrackPlayer.getQueue();
      if (event.nextTrack >= queue.length) {
        console.log(
          '[PlaybackService] Track index out of bounds:',
          event.nextTrack,
        );
        return;
      }

      // Get the new track information
      const track = await TrackPlayer.getTrack(event.nextTrack);
      if (!track) {
        console.log(
          '[PlaybackService] No track found at index:',
          event.nextTrack,
        );
        return;
      }

      // Wait for track to be ready and get actual duration
      let duration = track.duration || 0;
      try {
        // Wait for track to be ready
        const state = await TrackPlayer.getState();
        if (state === State.Ready || state === State.Playing) {
          const actualDuration = await TrackPlayer.getDuration();
          if (actualDuration > 0) {
            duration = actualDuration;
          }
        }
      } catch (error) {
        console.warn('[PlaybackService] Error getting track duration:', error);
      }

      // Update playback state with accurate duration
      store.updatePlaybackState({
        position: 0,
        duration,
        state: State.Ready,
      });

      // Update recently played with accurate duration
      if (track.reciterId && track.surahId) {
        recentlyPlayedStore.updateProgress(
          track.reciterId,
          parseInt(track.surahId, 10),
          0,
          duration,
        );
      }

      console.log('[PlaybackService] Track change completed:', {
        index: event.nextTrack,
        duration,
        track: track.title,
      });
    } catch (error) {
      console.error('[PlaybackService] Error handling track change:', error);
    }
  });

  // Audio Session Management
  TrackPlayer.addEventListener(Event.RemoteDuck, async event => {
    if (event.permanent) {
      await store.pause();
    } else {
      if (event.paused) {
        await store.pause();
      } else {
        const playerState = await TrackPlayer.getState();
        if (playerState !== State.Playing) {
          await store.play();
        }
      }
    }
  });

  // Progress Updates - Use throttling to prevent excessive updates
  let lastProgressUpdate = 0;
  const PROGRESS_THROTTLE = 1000; // 1 second

  TrackPlayer.addEventListener(
    Event.PlaybackProgressUpdated,
    async ({position, duration}) => {
      const now = Date.now();
      if (now - lastProgressUpdate > PROGRESS_THROTTLE) {
        store.updatePlaybackState({position, duration});
        // Update recently played progress
        if (duration > 0) {
          const currentTrack = await TrackPlayer.getCurrentTrack();
          if (currentTrack !== null) {
            const track = await TrackPlayer.getTrack(currentTrack);
            if (track && track.reciterId && track.surahId) {
              const progress = position / duration;
              recentlyPlayedStore.updateProgress(
                track.reciterId,
                parseInt(track.surahId, 10),
                progress,
                duration,
              );
            }
          }
        }
        lastProgressUpdate = now;
      }
    },
  );

  // Error Handling
  TrackPlayer.addEventListener(Event.PlaybackError, error => {
    store.setError(
      'playback',
      error instanceof Error ? error : new Error(error.message),
    );
  });
}

export default playbackService;
