/**
 * Adhkar Audio Store
 *
 * Minimal state management for adhkar audio playback.
 * Only stores user INTENT (play/pause, loop preference).
 * Does NOT store playback progress - that comes directly from the player.
 */

import {create} from 'zustand';
import {getAudioSource} from '@/utils/adhkarAudio';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {State as TrackPlayerState} from 'react-native-track-player';

interface AdhkarAudioState {
  // Current audio
  currentAudioFile: string | null;
  audioSource: number | null;

  // User intent (not player state)
  isPlaying: boolean;
  isLooping: boolean;
  hasInteracted: boolean; // True once play is pressed, reset on page change

  // Actions
  setAudio: (audioFile: string | null) => void;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  stop: () => void;
  setLooping: (loop: boolean) => void;
  toggleLooping: () => void;
}

export const useAdhkarAudioStore = create<AdhkarAudioState>((set, get) => ({
  // Initial state
  currentAudioFile: null,
  audioSource: null,
  isPlaying: false,
  isLooping: false,
  hasInteracted: false,

  // Set the current audio file (called when swiping to new dhikr)
  setAudio: (audioFile: string | null) => {
    const currentFile = get().currentAudioFile;

    // If same file, don't reset
    if (audioFile === currentFile) return;

    const source = getAudioSource(audioFile);

    // Stop current playback and reset state
    set({
      currentAudioFile: audioFile,
      audioSource: source,
      isPlaying: false,
      hasInteracted: false,
    });
  },

  // Play audio (also pauses main Quran player)
  play: () => {
    const {audioSource} = get();
    if (!audioSource) return;

    // Pause main Quran player if it's playing
    const mainPlayerState = usePlayerStore.getState();
    if (mainPlayerState.playback.state === TrackPlayerState.Playing) {
      mainPlayerState.pause();
    }

    set({isPlaying: true, hasInteracted: true});
  },

  // Pause audio
  pause: () => {
    set({isPlaying: false});
  },

  // Toggle play/pause
  toggle: () => {
    const {isPlaying, audioSource} = get();
    if (!audioSource) return;

    if (isPlaying) {
      get().pause();
    } else {
      get().play();
    }
  },

  // Stop and reset playback
  stop: () => {
    set({isPlaying: false});
  },

  // Set looping
  setLooping: (loop: boolean) => {
    set({isLooping: loop});
  },

  // Toggle looping
  toggleLooping: () => {
    set(state => ({isLooping: !state.isLooping}));
  },
}));
