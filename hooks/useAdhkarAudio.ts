/**
 * useAdhkarAudio Hook
 *
 * Custom hook for adhkar audio playback using expo-audio.
 * Provides a clean interface for playing dhikr audio files with
 * controls, status, and formatted time strings.
 */

import {useCallback, useMemo} from 'react';
import {useAudioPlayer, useAudioPlayerStatus, AudioPlayer} from 'expo-audio';
import {getAudioSource} from '@/utils/adhkarAudio';

/**
 * Format seconds to M:SS string (e.g., 90 -> "1:30")
 */
function formatTime(seconds: number): string {
  if (!seconds || !isFinite(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

interface UseAdhkarAudioReturn {
  // Player instance (for advanced use)
  player: AudioPlayer;

  // Status
  isPlaying: boolean;
  isLoaded: boolean;
  currentTime: number; // seconds
  duration: number; // seconds
  progress: number; // 0-1 percentage

  // Controls
  play: () => void;
  pause: () => void;
  toggle: () => void;
  replay: () => void; // seek to 0 and play
  seekTo: (seconds: number) => void;
  seekToProgress: (progress: number) => void; // 0-1 percentage

  // Formatted time strings
  currentTimeFormatted: string; // "0:45"
  durationFormatted: string; // "2:30"
}

/**
 * Hook for adhkar audio playback
 * @param audioFile - The audio filename (e.g., "dhikr_75.mp3") or null
 * @returns Audio player controls and status
 */
export function useAdhkarAudio(audioFile: string | null): UseAdhkarAudioReturn {
  // Get the audio source from the mapping
  const source = useMemo(() => getAudioSource(audioFile), [audioFile]);

  // Create the audio player with the source
  const player = useAudioPlayer(source);

  // Get real-time status from the player
  const status = useAudioPlayerStatus(player);

  // Extract status values with safe defaults
  const isPlaying = status?.playing ?? false;
  const isLoaded = status?.isLoaded ?? false;
  const currentTime = status?.currentTime ?? 0;
  const duration = status?.duration ?? 0;

  // Calculate progress (0-1), handling division by zero
  const progress = useMemo(() => {
    if (!duration || duration === 0) return 0;
    return Math.min(Math.max(currentTime / duration, 0), 1);
  }, [currentTime, duration]);

  // Format time strings
  const currentTimeFormatted = useMemo(
    () => formatTime(currentTime),
    [currentTime],
  );
  const durationFormatted = useMemo(() => formatTime(duration), [duration]);

  // Control functions
  const play = useCallback(() => {
    if (source) {
      player.play();
    }
  }, [player, source]);

  const pause = useCallback(() => {
    player.pause();
  }, [player]);

  const toggle = useCallback(() => {
    if (isPlaying) {
      player.pause();
    } else if (source) {
      player.play();
    }
  }, [player, isPlaying, source]);

  const replay = useCallback(() => {
    if (source) {
      player.seekTo(0);
      player.play();
    }
  }, [player, source]);

  const seekTo = useCallback(
    (seconds: number) => {
      player.seekTo(seconds);
    },
    [player],
  );

  const seekToProgress = useCallback(
    (progressValue: number) => {
      if (duration > 0) {
        const seconds = progressValue * duration;
        player.seekTo(seconds);
      }
    },
    [player, duration],
  );

  return {
    player,
    isPlaying,
    isLoaded,
    currentTime,
    duration,
    progress,
    play,
    pause,
    toggle,
    replay,
    seekTo,
    seekToProgress,
    currentTimeFormatted,
    durationFormatted,
  };
}
