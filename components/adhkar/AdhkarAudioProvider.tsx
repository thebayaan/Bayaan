/**
 * AdhkarAudioProvider
 *
 * Manages the single audio player instance for adhkar playback.
 * Supports both single-dhikr and "Play All" modes.
 * Uses React Context to expose player status and controls directly,
 * avoiding complex store synchronization that causes feedback loops.
 */

import React, {createContext, useContext, useEffect, useRef} from 'react';
import {useAudioPlayer, useAudioPlayerStatus} from 'expo-audio';
import {useAdhkarAudioStore} from '@/store/adhkarAudioStore';
import {useAdhkarPlayAllStore} from '@/store/adhkarPlayAllStore';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {State as TrackPlayerState} from 'react-native-track-player';
import {getAudioSource} from '@/utils/adhkarAudio';

/**
 * Context value for direct player access
 */
interface AdhkarAudioContextValue {
  // Playback status (from player, not store)
  progress: number;
  duration: number;
  currentTime: number;
  // Direct seek function (no store round-trip)
  seek: (progress: number) => void;
}

const AdhkarAudioContext = createContext<AdhkarAudioContextValue>({
  progress: 0,
  duration: 0,
  currentTime: 0,
  seek: () => {},
});

/**
 * Hook to access player status and seek function
 */
export const useAdhkarAudioPlayer = () => useContext(AdhkarAudioContext);

/**
 * Internal component that manages the actual audio player.
 * Only rendered when there's a valid audio source.
 */
const AudioPlayerManager: React.FC<{
  audioSource: number;
  isPlayAllMode: boolean;
  children: React.ReactNode;
}> = ({audioSource, isPlayAllMode, children}) => {
  // Single-dhikr store state
  const singleShouldPlay = useAdhkarAudioStore(state => state.isPlaying);
  const isLooping = useAdhkarAudioStore(state => state.isLooping);
  const singlePause = useAdhkarAudioStore(state => state.pause);

  // Play All store state
  const playAllShouldPlay = useAdhkarPlayAllStore(state => state.isPlaying);
  const advanceToNext = useAdhkarPlayAllStore(state => state.advanceToNext);
  const playAllPause = useAdhkarPlayAllStore(state => state.pause);

  // Determine effective shouldPlay based on mode
  const shouldPlay = isPlayAllMode ? playAllShouldPlay : singleShouldPlay;
  const pause = isPlayAllMode ? playAllPause : singlePause;

  // Create audio player with the source
  const player = useAudioPlayer(audioSource);
  const status = useAudioPlayerStatus(player);

  // Track last command to avoid duplicate play/pause calls
  const lastCommand = useRef<'play' | 'pause' | null>(null);
  // Track last audio source to reset command on source change
  const lastAudioSource = useRef<number | null>(null);

  // Reset last command when audio source changes (new track loaded)
  useEffect(() => {
    if (audioSource !== lastAudioSource.current) {
      lastCommand.current = null;
      lastAudioSource.current = audioSource;
    }
  }, [audioSource]);

  // Sync loop setting with player (only in single-dhikr mode)
  useEffect(() => {
    if (player) {
      player.loop = isPlayAllMode ? false : isLooping;
    }
  }, [player, isLooping, isPlayAllMode]);

  // Handle play/pause - only react to shouldPlay changes
  useEffect(() => {
    if (!player) return;

    const command = shouldPlay ? 'play' : 'pause';
    if (lastCommand.current === command) return;

    lastCommand.current = command;

    try {
      if (shouldPlay) {
        player.play();
      } else {
        player.pause();
      }
    } catch (error) {
      console.warn('[AudioPlayerManager] Play/pause error:', error);
    }
  }, [player, shouldPlay]);

  // Handle playback end
  const hasHandledEnd = useRef(false);
  // Track the audio source we last handled end for (prevents duplicate handling)
  const lastHandledAudioSource = useRef<number | null>(null);

  useEffect(() => {
    if (shouldPlay) {
      hasHandledEnd.current = false;
    }
  }, [shouldPlay]);

  // Reset hasHandledEnd when audio source changes
  useEffect(() => {
    hasHandledEnd.current = false;
  }, [audioSource]);

  useEffect(() => {
    // In Play All mode, we don't loop - we advance to next
    const effectiveLooping = isPlayAllMode ? false : isLooping;

    if (!status || effectiveLooping || hasHandledEnd.current) return;

    const currentTime = status.currentTime ?? 0;
    const duration = status.duration ?? 0;

    // Additional guard: ensure we have valid duration and the track actually played
    // (currentTime > 1 second means the track actually started playing)
    const trackActuallyPlayed = currentTime > 1;

    if (
      duration > 0 &&
      currentTime >= duration - 0.1 &&
      !status.playing &&
      trackActuallyPlayed
    ) {
      // Prevent handling the same audio source twice
      if (lastHandledAudioSource.current === audioSource) {
        return;
      }

      hasHandledEnd.current = true;
      lastHandledAudioSource.current = audioSource;

      if (isPlayAllMode) {
        // In Play All mode, advance to next track
        advanceToNext();
        // If no next track, advanceToNext() already calls stopPlayAll()
      } else {
        // Single-dhikr mode: Reset to beginning before pausing
        if (player) {
          try {
            player.seekTo(0);
          } catch {
            // Ignore seek errors during cleanup
          }
        }
        pause();
      }
    }
  }, [status, isLooping, isPlayAllMode, pause, player, advanceToNext, audioSource]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (player) {
        try {
          player.pause();
        } catch {
          // Ignore cleanup errors
        }
      }
    };
  }, [player]);

  // Calculate context values from status
  const currentTime = status?.currentTime ?? 0;
  const duration = status?.duration ?? 0;
  const progress = duration > 0 ? Math.min(currentTime / duration, 1) : 0;

  // Direct seek function - no store involved
  const seek = (newProgress: number) => {
    if (player && duration > 0) {
      const seekTime = newProgress * duration;
      try {
        player.seekTo(seekTime);
      } catch (error) {
        console.warn('[AudioPlayerManager] Seek error:', error);
      }
    }
  };

  return (
    <AdhkarAudioContext.Provider
      value={{progress, duration, currentTime, seek}}>
      {children}
    </AdhkarAudioContext.Provider>
  );
};

/**
 * Fallback provider when no audio is loaded
 */
const NoAudioProvider: React.FC<{children: React.ReactNode}> = ({children}) => {
  const noopSeek = () => {};
  return (
    <AdhkarAudioContext.Provider
      value={{progress: 0, duration: 0, currentTime: 0, seek: noopSeek}}>
      {children}
    </AdhkarAudioContext.Provider>
  );
};

/**
 * Main provider component.
 * Handles both single-dhikr and Play All modes.
 */
export const AdhkarAudioProvider: React.FC<{children: React.ReactNode}> = ({
  children,
}) => {
  // Single-dhikr store
  const singleAudioSource = useAdhkarAudioStore(state => state.audioSource);
  const pauseAdhkar = useAdhkarAudioStore(state => state.pause);

  // Play All store
  const isPlayAllMode = useAdhkarPlayAllStore(state => state.isPlayAllMode);
  const playAllCurrentDhikr = useAdhkarPlayAllStore(state =>
    state.getCurrentDhikr(),
  );
  const playAllPause = useAdhkarPlayAllStore(state => state.pause);

  // Determine effective audio source based on mode
  const playAllAudioSource = playAllCurrentDhikr?.audioFile
    ? getAudioSource(playAllCurrentDhikr.audioFile)
    : null;

  const effectiveAudioSource = isPlayAllMode
    ? playAllAudioSource
    : singleAudioSource;

  // Get main player state for bidirectional pause
  const mainPlayerState = usePlayerStore(state => state.playback.state);
  const prevMainPlayerState = useRef(mainPlayerState);

  // Bidirectional pause: When main Quran player starts, pause adhkar (both modes)
  useEffect(() => {
    const wasPlaying = prevMainPlayerState.current === TrackPlayerState.Playing;
    const isNowPlaying = mainPlayerState === TrackPlayerState.Playing;

    if (!wasPlaying && isNowPlaying) {
      // Pause whichever mode is active
      if (isPlayAllMode) {
        const playAllIsPlaying = useAdhkarPlayAllStore.getState().isPlaying;
        if (playAllIsPlaying) {
          playAllPause();
        }
      } else {
        const adhkarIsPlaying = useAdhkarAudioStore.getState().isPlaying;
        if (adhkarIsPlaying) {
          pauseAdhkar();
        }
      }
    }

    prevMainPlayerState.current = mainPlayerState;
  }, [mainPlayerState, pauseAdhkar, playAllPause, isPlayAllMode]);

  // Render with or without audio player
  if (effectiveAudioSource) {
    return (
      <AudioPlayerManager
        audioSource={effectiveAudioSource}
        isPlayAllMode={isPlayAllMode}>
        {children}
      </AudioPlayerManager>
    );
  }

  return <NoAudioProvider>{children}</NoAudioProvider>;
};

export default AdhkarAudioProvider;
