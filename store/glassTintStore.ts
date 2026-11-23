// @ai-generated
/**
 * Dark wash laid over our own glass, as rgba alpha per theme. Temporary, for the demo build:
 * persisted so the tint dial (components/GlassTintDial) can tune it on a
 * device; settle the numbers here and drop the dial.
 */

import {create} from 'zustand';
import {persist} from 'zustand/middleware';
import {persistStorage} from '@/utils/storage';

/** The settled values: 0.20 in dark themes, plain glass in light ones. */
export const DEFAULT_GLASS_TINT_ALPHA = {dark: 0.2, light: 0};

interface GlassTintState {
  dark: number;
  light: number;
  setAlpha: (mode: 'dark' | 'light', alpha: number) => void;
  reset: () => void;
}

export const useGlassTintStore = create<GlassTintState>()(
  persist(
    set => ({
      ...DEFAULT_GLASS_TINT_ALPHA,
      setAlpha: (mode, alpha) => set({[mode]: alpha}),
      reset: () => set(DEFAULT_GLASS_TINT_ALPHA),
    }),
    {
      name: 'glass-tint-store-v2',
      storage: persistStorage(),
    },
  ),
);
