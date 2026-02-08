/**
 * Ambient Sounds Types
 *
 * Type definitions and metadata for ambient nature sounds
 * that play alongside Quran recitation.
 */

/**
 * Available ambient sound types
 */
export type AmbientSoundType =
  | 'rain'
  | 'forest'
  | 'ocean'
  | 'stream'
  | 'thunder'
  | 'fireplace'
  | 'wind';

/**
 * Metadata for an ambient sound
 */
export interface AmbientSoundMeta {
  /** Display label */
  label: string;
  /** SF Symbol / icon name for the UI */
  icon: string;
  /** Bundled audio asset (require() reference) */
  source: number;
}

/**
 * Map of all available ambient sounds with metadata.
 *
 * Audio files are bundled in assets/audio/ambient/.
 * Each file should be a 2-3 minute seamless loop at 128kbps MP3.
 */
export const AMBIENT_SOUNDS: Record<AmbientSoundType, AmbientSoundMeta> = {
  rain: {
    label: 'Rain',
    icon: 'rain',
    source: require('@/assets/audio/ambient/rain.mp3'),
  },
  forest: {
    label: 'Forest',
    icon: 'forest',
    source: require('@/assets/audio/ambient/forest.mp3'),
  },
  ocean: {
    label: 'Ocean',
    icon: 'ocean',
    source: require('@/assets/audio/ambient/ocean.mp3'),
  },
  stream: {
    label: 'Stream',
    icon: 'stream',
    source: require('@/assets/audio/ambient/stream.mp3'),
  },
  thunder: {
    label: 'Thunder',
    icon: 'thunder',
    source: require('@/assets/audio/ambient/thunder.mp3'),
  },
  fireplace: {
    label: 'Fireplace',
    icon: 'fireplace',
    source: require('@/assets/audio/ambient/fireplace.mp3'),
  },
  wind: {
    label: 'Wind',
    icon: 'wind',
    source: require('@/assets/audio/ambient/wind.mp3'),
  },
};

/**
 * Ordered list of ambient sound types for display in the picker.
 * 'none' is represented as null in the store — it's handled separately in the UI.
 */
export const AMBIENT_SOUND_LIST: AmbientSoundType[] = [
  'rain',
  'forest',
  'ocean',
  'stream',
  'thunder',
  'fireplace',
  'wind',
];

/** Default ambient volume (30%) */
export const DEFAULT_AMBIENT_VOLUME = 0.3;

/** Fade duration in milliseconds */
export const AMBIENT_FADE_DURATION = 500;

/** Fade step interval in milliseconds */
export const AMBIENT_FADE_STEP = 25;
