// @ai-generated
/**
 * Dark wash laid over our own glass, as rgba alpha per theme. Temporary:
 * persisted so the tint dial (components/GlassTintDial) can tune it on a
 * device; settle the numbers here and drop the dial.
 */

import {create} from 'zustand';
import {persist} from 'zustand/middleware';
import {persistStorage} from '@/utils/storage';

/** Dark themes take 0.30; light themes 0.10, since a stronger wash turns grey. */
export const DEFAULT_GLASS_TINT_ALPHA = {dark: 0.3, light: 0.1};

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
      name: 'glass-tint-store',
      storage: persistStorage(),
    },
  ),
);
