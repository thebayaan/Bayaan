import TrackPlayer, {Event, State, RepeatMode} from 'react-native-track-player';
import {usePlayerStore} from '../store/playerStore';
import {useRecentlyPlayedStore} from '../store/recentlyPlayedStore';

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

/**
 * Restores the player state from the store
 */
async function restorePlayerState() {
  try {
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
  TrackPlayer.addEventListener(Event.PlaybackState, ({state}) => {
    batchedStateUpdate(() => {
      store.updatePlaybackState({state});
      store.updateLoadingState({trackLoading: false});
    });
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

      // Update playback state immediately
      store.updatePlaybackState({
        position: 0,
        duration: track.duration || 0,
        state: State.Ready,
      });

      // Update recently played
      if (track.reciterId && track.surahId) {
        recentlyPlayedStore.updateProgress(
          track.reciterId,
          parseInt(track.surahId, 10),
          0,
          track.duration || 0,
        );
      }
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
