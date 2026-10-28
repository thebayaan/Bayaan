// @ai-generated
import {useEffect} from 'react';
import * as ScreenOrientation from 'expo-screen-orientation';
import {useResponsive} from '@/hooks/useResponsive';

/**
 * Phones are portrait except on screens that allow landscape (the Mushaf).
 * Tablets turn freely everywhere and are never locked (ipad-standards §11).
 *
 * - `'portrait'` (the app root): lock phones to portrait.
 * - `'free'` (a screen that allows landscape): unlock phones while the
 *   screen is mounted, and lock them to portrait again when it unmounts.
 *
 * The window can change class while the app runs: unfolding an iPhone Duo
 * makes it a tablet, folding it makes it a phone again. Each change re-runs
 * every caller, so the lock always matches the current window.
 */

// Free screens mounted right now. Child effects run before the root's, so on
// a fold the root must not lock portrait under an open Mushaf.
let freeScreens = 0;

function applyOrientation(isTablet: boolean): void {
  if (isTablet || freeScreens > 0) {
    ScreenOrientation.unlockAsync();
  } else {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
  }
}

export function usePhoneOrientation(mode: 'portrait' | 'free'): void {
  const {isTablet} = useResponsive();
  useEffect(() => {
    if (mode === 'free') freeScreens += 1;
    applyOrientation(isTablet);
    if (mode !== 'free') return;
    return () => {
      freeScreens -= 1;
      if (!isTablet) applyOrientation(false);
    };
  }, [isTablet, mode]);
}
