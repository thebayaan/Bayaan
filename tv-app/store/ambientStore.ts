import {create} from 'zustand';
import {readJSON, writeJSON} from '../services/storage';

export type AmbientSound =
  | 'rain'
  | 'forest'
  | 'ocean'
  | 'stream'
  | 'wind'
  | 'fireplace';

/** The sounds in the order the Sound panel offers them, with their names. */
export const AMBIENT_SOUND_OPTIONS: readonly {
  value: AmbientSound;
  label: string;
}[] = [
  {value: 'rain', label: 'Rain'},
  {value: 'stream', label: 'Stream'},
  {value: 'ocean', label: 'Ocean'},
  {value: 'forest', label: 'Forest'},
  {value: 'wind', label: 'Wind'},
  {value: 'fireplace', label: 'Fireplace'},
];

/** Volume steps for the ambience under the recitation. */
export const AMBIENT_VOLUMES: readonly {value: number; label: string}[] = [
  {value: 0.25, label: 'Soft'},
  {value: 0.5, label: 'Medium'},
  {value: 0.8, label: 'Loud'},
];

export function ambientLabel(sound: AmbientSound): string {
  return AMBIENT_SOUND_OPTIONS.find(o => o.value === sound)?.label ?? 'Rain';
}

/** The ambience choice as one value: off, or the sound that plays. */
export type AmbientChoice = AmbientSound | 'off';

/** What the tray and Settings show: "Off" or the sound's name. */
export function ambientChoiceLabel(choice: AmbientChoice): string {
  return choice === 'off' ? 'Off' : ambientLabel(choice);
}

/**
 * Whether the ambience should be sounding: only while it is on and the
 * recitation plays, like the phone (ExpoAudioProvider pauses it with the
 * audio). While a track loads or buffers it keeps whatever it was doing, so
 * moving to the next surah doesn't stutter it.
 */
export function ambientShouldPlay(
  enabled: boolean,
  status: string,
  wasPlaying: boolean,
): boolean {
  if (!enabled) return false;
  if (status === 'playing') return true;
  if (status === 'loading' || status === 'buffering') return wasPlaying;
  return false;
}

type AmbientState = {
  enabled: boolean;
  currentSound: AmbientSound;
  volume: number;
  toggle: () => void;
  setSound: (s: AmbientSound) => void;
  /** Off, or turn on with this sound. */
  choose: (choice: AmbientChoice) => void;
  setVolume: (v: number) => void;
  reset: () => void;
};

type PersistedAmbient = {
  enabled: boolean;
  currentSound: AmbientSound;
  volume: number;
};

// MMKV key for the persisted ambient backdrop preference so the choice
// survives relaunch (mirrors overlayStore's speed persistence).
const AMBIENT_KEY = 'bayaan_tv_ambient';

const VALID_SOUNDS: readonly AmbientSound[] = [
  'rain',
  'forest',
  'ocean',
  'stream',
  'wind',
  'fireplace',
];

const DEFAULTS: PersistedAmbient = {
  enabled: false,
  currentSound: 'rain',
  volume: 0.5,
};

function clamp(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function isAmbientSound(value: unknown): value is AmbientSound {
  return typeof value === 'string' && VALID_SOUNDS.some(s => s === value);
}

/** Read the persisted ambient preference from MMKV, falling back to defaults. */
export function readPersistedAmbient(): PersistedAmbient {
  const raw = readJSON<unknown>(AMBIENT_KEY);
  if (raw === null || typeof raw !== 'object') return DEFAULTS;
  const enabled =
    'enabled' in raw && typeof raw.enabled === 'boolean'
      ? raw.enabled
      : DEFAULTS.enabled;
  const currentSound =
    'currentSound' in raw && isAmbientSound(raw.currentSound)
      ? raw.currentSound
      : DEFAULTS.currentSound;
  const volume =
    'volume' in raw && typeof raw.volume === 'number'
      ? clamp(raw.volume)
      : DEFAULTS.volume;
  return {enabled, currentSound, volume};
}

function persist(state: PersistedAmbient): void {
  writeJSON<PersistedAmbient>(AMBIENT_KEY, {
    enabled: state.enabled,
    currentSound: state.currentSound,
    volume: state.volume,
  });
}

export const useAmbientStore = create<AmbientState>((set, get) => ({
  ...readPersistedAmbient(),
  toggle: () => {
    set(s => ({enabled: !s.enabled}));
    persist(get());
  },
  setSound: sound => {
    set({currentSound: sound});
    persist(get());
  },
  choose: choice => {
    set(
      choice === 'off'
        ? {enabled: false}
        : {enabled: true, currentSound: choice},
    );
    persist(get());
  },
  setVolume: v => {
    set({volume: clamp(v)});
    persist(get());
  },
  reset: () => {
    set({...DEFAULTS});
    persist(get());
  },
}));
