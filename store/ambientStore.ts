/**
 * Ambient Sound Store
 *
 * Zustand store managing ambient sound preferences.
 * Persisted via AsyncStorage so user's choice survives app restarts.
 *
 * This store drives the AmbientAudioService:
 * - setEnabled/toggle -> play/stop with fade
 * - setSound -> fully stop old sound, load new, fade in
 * - setVolume -> update volume on the service
 */

import {create} from 'zustand';
import {createJSONStorage, persist} from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {AmbientSoundType, DEFAULT_AMBIENT_VOLUME} from '@/types/ambient';
import {ambientAudioService} from '@/services/audio/AmbientAudioService';

const STORAGE_KEY = 'ambient-store';

export interface AmbientStoreState {
  /** Whether ambient sounds are currently enabled */
  isEnabled: boolean;
  /** The currently selected ambient sound */
  currentSound: AmbientSoundType | null;
  /** Ambient volume (0.0 - 1.0) */
  volume: number;

  /** Enable or disable ambient playback */
  setEnabled: (enabled: boolean) => void;
  /** Toggle ambient on/off */
  toggle: () => void;
  /** Select a new ambient sound (stops old, loads new, plays) */
  setSound: (sound: AmbientSoundType) => void;
  /** Adjust ambient volume */
  setVolume: (volume: number) => void;
}

export const useAmbientStore = create<AmbientStoreState>()(
  persist(
    (set, get) => ({
      isEnabled: false,
      currentSound: null,
      volume: DEFAULT_AMBIENT_VOLUME,

      setEnabled: (enabled: boolean) => {
        const {currentSound, volume} = get();

        if (enabled && currentSound) {
          // Full stop first to ensure clean state, then load and fade in
          ambientAudioService.stop();
          ambientAudioService.loadSound(currentSound);
          ambientAudioService.setVolume(volume);
          ambientAudioService.fadeIn();
        } else if (!enabled) {
          // Full stop — pause, release player, reset state
          ambientAudioService.stop();
        }

        set({isEnabled: enabled});
      },

      toggle: () => {
        const {isEnabled, setEnabled} = get();
        setEnabled(!isEnabled);
      },

      setSound: (sound: AmbientSoundType) => {
        const {volume} = get();

        // 1. Fully stop whatever is currently playing (clears fades, pauses, releases)
        ambientAudioService.stop();

        // 2. Update store state
        set({currentSound: sound, isEnabled: true});

        // 3. Load the new sound and fade in
        ambientAudioService.loadSound(sound);
        ambientAudioService.setVolume(volume);
        ambientAudioService.fadeIn();
      },

      setVolume: (volume: number) => {
        const clampedVolume = Math.max(0, Math.min(1, volume));
        ambientAudioService.setVolume(clampedVolume);
        set({volume: clampedVolume});
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: state => ({
        // Only persist preferences, not runtime state
        currentSound: state.currentSound,
        volume: state.volume,
        // Don't persist isEnabled — ambient should not auto-start on app launch
      }),
    },
  ),
);
