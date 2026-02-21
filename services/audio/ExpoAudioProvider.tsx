/**
 * ExpoAudioProvider - React provider that bridges expo-audio to the store
 *
 * This provider:
 * 1. Creates and manages the expo-audio player instance
 * 2. Connects the player to ExpoAudioService
 * 3. Uses useAudioPlayerStatus to get reactive updates
 * 4. Updates the playerStore with progress/state changes
 * 5. Handles track end (didJustFinish) to auto-advance to next track
 *
 * Must be mounted at the app root level for audio to work.
 */

import React, {useEffect, useRef, useCallback} from 'react';
import {AppState, Platform} from 'react-native';
import {useAudioPlayer, useAudioPlayerStatus} from 'expo-audio';
import {expoAudioService} from './ExpoAudioService';
import {lockScreenService} from './LockScreenService';
import {ambientAudioService} from './AmbientAudioService';
import {audioCoordinator} from './AudioCoordinator';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {useRecentlyPlayedStore} from '@/services/player/store/recentlyPlayedStore';
import {useAmbientStore} from '@/store/ambientStore';
import {useMushafPlayerStore} from '@/store/mushafPlayerStore';
import {mushafAudioService} from './MushafAudioService';

// Throttle interval for progress updates — wider on Android to reduce re-renders
const PROGRESS_UPDATE_INTERVAL = Platform.OS === 'android' ? 2000 : 1000;
const PROGRESS_PERSIST_INTERVAL = 10000;

interface ExpoAudioProviderProps {
  children: React.ReactNode;
}

export function ExpoAudioProvider({children}: ExpoAudioProviderProps) {
  // Create the audio player instance
  const player = useAudioPlayer(null);

  // Get reactive status updates
  const status = useAudioPlayerStatus(player);

  // Refs for tracking state
  const lastProgressUpdate = useRef(0);
  const lastPersistedAt = useRef(0);
  const lastPersistedProgress = useRef(0);
  const latestStatusRef = useRef({
    isLoaded: false,
    currentTime: 0,
    duration: 0,
  });
  const isHandlingTrackEnd = useRef(false);
  const wasPlaying = useRef(false);

  // Get store actions
  const updatePlaybackState = usePlayerStore(
    state => state.updatePlaybackState,
  );
  const skipToNext = usePlayerStore(state => state.skipToNext);

  const persistCurrentProgress = useCallback(
    (position: number, duration: number, force = false) => {
      if (duration <= 0 || position < 0) return;

      const store = usePlayerStore.getState();
      const currentTrack = store.queue.tracks[store.queue.currentIndex];
      if (!currentTrack?.reciterId || !currentTrack?.surahId) return;

      const progress = Math.max(0, Math.min(1, position / duration));
      const now = Date.now();
      const progressDelta = Math.abs(progress - lastPersistedProgress.current);
      const elapsed = now - lastPersistedAt.current;

      // Avoid writing every second; persist meaningful progress or forced events.
      if (!force && elapsed < PROGRESS_PERSIST_INTERVAL && progressDelta < 0.01) {
        return;
      }

      useRecentlyPlayedStore
        .getState()
        .updateProgress(
          currentTrack.reciterId,
          parseInt(currentTrack.surahId, 10),
          progress,
          duration,
        );

      lastPersistedAt.current = now;
      lastPersistedProgress.current = progress;
    },
    [],
  );

  // Connect player to service on mount
  useEffect(() => {
    const initializePlayer = async () => {
      try {
        // Initialize the audio service
        await expoAudioService.initialize();

        // Connect the player instance to the service
        expoAudioService.setPlayer(player);

        // Start lock screen sync after player is connected
        await lockScreenService.startSync();

        if (__DEV__)
          console.log('[ExpoAudioProvider] Player connected to service');
      } catch (error) {
        console.error('[ExpoAudioProvider] Failed to initialize:', error);
      }
    };

    initializePlayer();

    // Cleanup on unmount
    return () => {
      lockScreenService.stopSync();
      if (__DEV__) console.log('[ExpoAudioProvider] Unmounting, cleaning up');
    };
  }, [player]);

  // Merged progress + playback state effect (throttled)
  useEffect(() => {
    if (!status.isLoaded) return;

    const now = Date.now();
    const shouldUpdateProgress =
      now - lastProgressUpdate.current >= PROGRESS_UPDATE_INTERVAL;

    // Throttled position/duration update
    if (shouldUpdateProgress) {
      lastProgressUpdate.current = now;
      updatePlaybackState({
        position: status.currentTime,
        duration: status.duration,
        buffering: status.isBuffering,
      });

      if (status.playing) {
        persistCurrentProgress(status.currentTime, status.duration);
      }
    }

    // Playback state mapping (always check, not throttled)
    let state: 'playing' | 'paused' | 'buffering' | 'ready' = 'ready';
    if (status.isBuffering) {
      state = 'buffering';
    } else if (status.playing) {
      state = 'playing';
    } else {
      state = 'paused';
    }

    const currentState = usePlayerStore.getState().playback.state;
    if (currentState !== state && currentState !== 'loading') {
      // When main player starts playing, coordinate with mushaf player
      if (state === 'playing' && currentState !== 'playing') {
        audioCoordinator.mainWillPlay();
      }

      updatePlaybackState({state});

      // Save progress when pausing (to capture final position)
      if (state === 'paused' && wasPlaying.current && status.duration > 0) {
        persistCurrentProgress(status.currentTime, status.duration, true);
      }
    }

    wasPlaying.current = status.playing;
  }, [
    status.currentTime,
    status.duration,
    status.isLoaded,
    status.isBuffering,
    status.playing,
    updatePlaybackState,
    persistCurrentProgress,
  ]);

  // Keep latest status in refs for background persistence events.
  useEffect(() => {
    latestStatusRef.current = {
      isLoaded: status.isLoaded,
      currentTime: status.currentTime,
      duration: status.duration,
    };
  }, [status.isLoaded, status.currentTime, status.duration]);

  // Persist playback progress when app goes to background/inactive.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextState => {
      if (nextState === 'active') return;
      const latest = latestStatusRef.current;
      if (!latest.isLoaded || latest.duration <= 0) return;
      persistCurrentProgress(latest.currentTime, latest.duration, true);
    });

    return () => {
      subscription.remove();
    };
  }, [persistCurrentProgress]);

  // Handle track end (didJustFinish)
  const handleTrackEnd = useCallback(async () => {
    if (isHandlingTrackEnd.current) {
      return;
    }

    isHandlingTrackEnd.current = true;
    if (__DEV__) console.log('[ExpoAudioProvider] Track ended');

    try {
      const store = usePlayerStore.getState();
      const {repeatMode} = store.settings;
      const {currentIndex, tracks} = store.queue;

      if (repeatMode === 'track') {
        // Repeat current track
        if (__DEV__)
          console.log('[ExpoAudioProvider] Repeat mode: track - restarting');
        await expoAudioService.seekTo(0);
        await expoAudioService.play();
      } else if (currentIndex < tracks.length - 1 || repeatMode === 'queue') {
        // Auto-advance to next track
        if (__DEV__)
          console.log('[ExpoAudioProvider] Auto-advancing to next track');
        await skipToNext();
      } else {
        // End of queue, no repeat
        if (__DEV__) console.log('[ExpoAudioProvider] End of queue reached');
        updatePlaybackState({state: 'ended'});
      }
    } catch (error) {
      console.error('[ExpoAudioProvider] Error handling track end:', error);
    } finally {
      isHandlingTrackEnd.current = false;
    }
  }, [skipToNext, updatePlaybackState]);

  // Monitor for track end via didJustFinish
  useEffect(() => {
    // expo-audio sets didJustFinish to true when track completes
    if (status.didJustFinish) {
      handleTrackEnd();
    }
  }, [status.didJustFinish, handleTrackEnd]);

  // ========== AMBIENT SOUND SYNC ==========
  // Sync ambient playback with the active audio source (main or mushaf).
  // Ambient should pause when audio pauses, resume when audio plays,
  // and fade out when the queue ends.
  const prevAudioPlaying = useRef(false);

  // Subscribe to mushaf playback state for ambient sync
  const mushafPlaybackState = useMushafPlayerStore(s => s.playbackState);

  useEffect(() => {
    // Determine if any Quran audio source is currently playing
    const activeSource = audioCoordinator.getActiveSource();
    const isAudioPlaying =
      activeSource === 'mushaf'
        ? mushafPlaybackState === 'playing'
        : status.playing;
    const wasAudioPlaying = prevAudioPlaying.current;
    prevAudioPlaying.current = isAudioPlaying;

    // Only act on actual transitions
    if (isAudioPlaying === wasAudioPlaying) return;

    const {isEnabled, currentSound} = useAmbientStore.getState();
    if (!isEnabled || !currentSound) return;

    if (isAudioPlaying) {
      // Audio started playing -> resume ambient
      if (
        ambientAudioService.hasPlayer() &&
        !ambientAudioService.getIsPlaying()
      ) {
        ambientAudioService.play();
        if (__DEV__)
          console.log('[ExpoAudioProvider] Ambient resumed with audio');
      }
    } else {
      // Audio paused -> pause ambient
      if (ambientAudioService.getIsPlaying()) {
        ambientAudioService.pause();
        if (__DEV__)
          console.log('[ExpoAudioProvider] Ambient paused with audio');
      }
    }
  }, [status.playing, mushafPlaybackState]);

  // Handle queue end — fade out ambient when queue is done
  useEffect(() => {
    const currentState = usePlayerStore.getState().playback.state;
    if (currentState === 'ended') {
      const {isEnabled} = useAmbientStore.getState();
      if (isEnabled && ambientAudioService.getIsPlaying()) {
        ambientAudioService.fadeOut();
        if (__DEV__)
          console.log('[ExpoAudioProvider] Ambient fading out (queue ended)');
      }
    }
  }, [status.didJustFinish]);

  // Render children - this provider doesn't render any UI
  return <>{children}</>;
}

export default ExpoAudioProvider;
