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
 */
export function usePhoneOrientation(mode: 'portrait' | 'free'): void {
  const {isTablet} = useResponsive();
  useEffect(() => {
    if (isTablet) return;
    if (mode === 'free') {
      ScreenOrientation.unlockAsync();
      return () => {
        ScreenOrientation.lockAsync(
          ScreenOrientation.OrientationLock.PORTRAIT_UP,
        );
      };
    }
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
  }, [isTablet, mode]);
}
