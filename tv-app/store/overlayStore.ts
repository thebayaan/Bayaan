// tv-app/store/overlayStore.ts
import {create} from 'zustand';
import {readJSON, writeJSON} from '../services/storage';
import {useTVPlayerStore} from './tvPlayerStore';

export type OverlayKey = 'speed' | 'sleep' | 'ambient' | 'queue' | null;

const SPEED_KEY = 'bayaan_tv_speed';
const MIN_SPEED = 0.5;
const MAX_SPEED = 2;
const DEFAULT_SPEED = 1;

/** Clamp a requested playback rate into the supported range, defaulting bad input to 1x. */
export function clampSpeed(rate: number): number {
  if (!Number.isFinite(rate)) return DEFAULT_SPEED;
  return Math.max(MIN_SPEED, Math.min(MAX_SPEED, rate));
}

/** Read the persisted playback-speed preference from MMKV (defaults to 1x). */
export function getPersistedSpeed(): number {
  const raw = readJSON<number>(SPEED_KEY);
  return typeof raw === 'number' ? clampSpeed(raw) : DEFAULT_SPEED;
}

type OverlayState = {
  /** Which transport overlay is currently shown, or null when none. */
  active: OverlayKey;
  /** The applied + persisted playback speed preference. */
  speed: number;
  open: (key: Exclude<OverlayKey, null>) => void;
  close: () => void;
  /** Persist a speed preference and apply it to the live audio engine, then close. */
  applySpeed: (rate: number) => void;
  /** Apply a sleep-timer selection to the player, then close. */
  applySleep: (minutes: number) => void;
  /** Re-apply the persisted speed to the engine (call once on player bootstrap). */
  applyPersistedSpeed: () => void;
  reset: () => void;
};

export const useOverlayStore = create<OverlayState>((set, get) => ({
  active: null,
  speed: getPersistedSpeed(),

  open: key => set({active: key}),

  close: () => set({active: null}),

  applySpeed: rate => {
    const speed = clampSpeed(rate);
    writeJSON(SPEED_KEY, speed);
    useTVPlayerStore.getState().setSpeed(speed);
    set({speed, active: null});
  },

  applySleep: minutes => {
    useTVPlayerStore.getState().setSleep(minutes);
    set({active: null});
  },

  applyPersistedSpeed: () => {
    useTVPlayerStore.getState().setSpeed(get().speed);
  },

  reset: () => set({active: null, speed: DEFAULT_SPEED}),
}));
