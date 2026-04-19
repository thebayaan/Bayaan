// tv-app/store/overlayStore.ts
import {create} from 'zustand';

export type OverlayKey = 'speed' | 'sleep' | 'ambient' | null;

type State = {
  active: OverlayKey;
  open: (k: Exclude<OverlayKey, null>) => void;
  close: () => void;
};

export const useOverlayStore = create<State>(set => ({
  active: null,
  open: k => set({active: k}),
  close: () => set({active: null}),
}));
