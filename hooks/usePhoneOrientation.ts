// @ai-generated
import {useEffect} from 'react';
import {Platform} from 'react-native';
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
    if (isTablet) {
      // The Android manifest pins the activity to portrait, so "never
      // locked" has to be said out loud there: without this an Android
      // tablet (and a foldable once unfolded, which a phone lock may still
      // hold) could not turn at all, not even in the Mushaf. iPad takes its
      // orientations from the app's settings and needs nothing.
      if (Platform.OS === 'android') ScreenOrientation.unlockAsync();
      return;
    }
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
