import {create} from 'zustand';

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

function clamp(n: number): number {
  return Math.max(0, Math.min(1, n));
}

export const useAmbientStore = create<AmbientState>(set => ({
  enabled: false,
  currentSound: 'rain',
  volume: 0.5,
  toggle: () => set(s => ({enabled: !s.enabled})),
  setSound: sound => set({currentSound: sound}),
  setVolume: v => set({volume: clamp(v)}),
  reset: () => set({enabled: false, currentSound: 'rain', volume: 0.5}),
}));
