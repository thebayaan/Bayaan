/**
 * AdhkarAudioProvider
 *
 * Manages the single audio player instance for adhkar playback.
 * Uses React Context to expose player status and controls directly,
 * avoiding complex store synchronization that causes feedback loops.
 */

import React, {createContext, useContext, useEffect, useRef} from 'react';
import {useAudioPlayer, useAudioPlayerStatus} from 'expo-audio';
import {useAdhkarAudioStore} from '@/store/adhkarAudioStore';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {State as TrackPlayerState} from 'react-native-track-player';

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
  children: React.ReactNode;
}> = ({audioSource, children}) => {
  const shouldPlay = useAdhkarAudioStore(state => state.isPlaying);
  const isLooping = useAdhkarAudioStore(state => state.isLooping);
  const pause = useAdhkarAudioStore(state => state.pause);

  // Create audio player with the source
  const player = useAudioPlayer(audioSource);
  const status = useAudioPlayerStatus(player);

  // Track last command to avoid duplicate play/pause calls
  const lastCommand = useRef<'play' | 'pause' | null>(null);

  // Sync loop setting with player
  useEffect(() => {
    if (player) {
      player.loop = isLooping;
    }
  }, [player, isLooping]);

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

  // Handle playback end (when not looping)
  const hasHandledEnd = useRef(false);

  useEffect(() => {
    if (shouldPlay) {
      hasHandledEnd.current = false;
    }
  }, [shouldPlay]);

  useEffect(() => {
    if (!status || isLooping || hasHandledEnd.current) return;

    const currentTime = status.currentTime ?? 0;
    const duration = status.duration ?? 0;

    if (duration > 0 && currentTime >= duration - 0.1 && !status.playing) {
      hasHandledEnd.current = true;
      pause();
    }
  }, [status, isLooping, pause]);

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
    <AdhkarAudioContext.Provider value={{progress, duration, currentTime, seek}}>
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
 */
export const AdhkarAudioProvider: React.FC<{children: React.ReactNode}> = ({
  children,
}) => {
  const audioSource = useAdhkarAudioStore(state => state.audioSource);
  const pauseAdhkar = useAdhkarAudioStore(state => state.pause);

  // Get main player state for bidirectional pause
  const mainPlayerState = usePlayerStore(state => state.playback.state);
  const prevMainPlayerState = useRef(mainPlayerState);

  // Bidirectional pause: When main Quran player starts, pause adhkar
  useEffect(() => {
    const wasPlaying = prevMainPlayerState.current === TrackPlayerState.Playing;
    const isNowPlaying = mainPlayerState === TrackPlayerState.Playing;

    if (!wasPlaying && isNowPlaying) {
      const adhkarIsPlaying = useAdhkarAudioStore.getState().isPlaying;
      if (adhkarIsPlaying) {
        pauseAdhkar();
      }
    }

    prevMainPlayerState.current = mainPlayerState;
  }, [mainPlayerState, pauseAdhkar]);

  // Render with or without audio player
  if (audioSource) {
    return (
      <AudioPlayerManager audioSource={audioSource}>
        {children}
      </AudioPlayerManager>
    );
  }

  return <NoAudioProvider>{children}</NoAudioProvider>;
};

export default AdhkarAudioProvider;
