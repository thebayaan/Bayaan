/**
 * useAdhkarAudio Hook
 *
 * Custom hook for adhkar audio playback.
 * - Uses Zustand store for user intent (play/pause, loop)
 * - Uses Context for player status (progress, duration) and direct seek
 *
 * This separation avoids feedback loops between store and player.
 */

import {useMemo} from 'react';
import {useAdhkarAudioStore} from '@/store/adhkarAudioStore';
import {useAdhkarAudioPlayer} from '@/components/adhkar/AdhkarAudioProvider';

interface UseAdhkarAudioReturn {
  // Status
  isPlaying: boolean;
  isLooping: boolean;
  currentTime: number;
  duration: number;
  progress: number;

  // Controls
  play: () => void;
  pause: () => void;
  toggle: () => void;
  replay: () => void;
  seekToProgress: (progress: number) => void;
  toggleLooping: () => void;

  // Formatted time strings
  currentTimeFormatted: string;
  durationFormatted: string;
}

/**
 * Format seconds to M:SS string
 */
function formatTime(seconds: number): string {
  if (!seconds || !isFinite(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Hook for adhkar audio playback
 * @param audioFile - The audio filename (e.g., "adhkar_75.mp3") or null
 * @returns Audio player controls and status
 */
export function useAdhkarAudio(audioFile: string | null): UseAdhkarAudioReturn {
  // Get user intent from store
  const isPlaying = useAdhkarAudioStore(state => state.isPlaying);
  const isLooping = useAdhkarAudioStore(state => state.isLooping);
  const currentAudioFile = useAdhkarAudioStore(state => state.currentAudioFile);
  const play = useAdhkarAudioStore(state => state.play);
  const pause = useAdhkarAudioStore(state => state.pause);
  const toggle = useAdhkarAudioStore(state => state.toggle);
  const toggleLooping = useAdhkarAudioStore(state => state.toggleLooping);

  // Get player status from context (direct from player, no store)
  const {progress, duration, currentTime, seek} = useAdhkarAudioPlayer();

  // Check if this hook's audio file is the currently active one
  const isActive = currentAudioFile === audioFile;

  // Format time strings
  const currentTimeFormatted = useMemo(
    () => formatTime(currentTime),
    [currentTime],
  );

  const durationFormatted = useMemo(
    () => formatTime(duration),
    [duration],
  );

  // Replay function
  const replay = () => {
    seek(0);
    play();
  };

  return {
    // Only return playing state if this is the active audio
    isPlaying: isActive ? isPlaying : false,
    isLooping,
    currentTime: isActive ? currentTime : 0,
    duration: isActive ? duration : 0,
    progress: isActive ? progress : 0,

    // Controls
    play,
    pause,
    toggle,
    replay,
    seekToProgress: seek,
    toggleLooping,

    // Formatted strings
    currentTimeFormatted: isActive ? currentTimeFormatted : '0:00',
    durationFormatted: isActive ? durationFormatted : '0:00',
  };
}
