import {create} from 'zustand';
import {readJSON, writeJSON} from '../services/storage';

export type AmbientSound =
  | 'rain'
  | 'forest'
  | 'ocean'
  | 'stream'
  | 'wind'
  | 'fireplace';

type AmbientState = {
  enabled: boolean;
  currentSound: AmbientSound;
  volume: number;
  toggle: () => void;
  setSound: (s: AmbientSound) => void;
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
  setVolume: v => {
    set({volume: clamp(v)});
    persist(get());
  },
  reset: () => {
    set({...DEFAULTS});
    persist(get());
  },
}));
