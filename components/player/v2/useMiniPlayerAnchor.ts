// @ai-generated
import {useEffect, useMemo, useRef, useSyncExternalStore} from 'react';
import type {View} from 'react-native';
import {Gesture, type PanGesture} from 'react-native-gesture-handler';
import {
  getPlayerSheetController,
  registerMiniPlayerAnchor,
  subscribePlayerSheetController,
  unregisterMiniPlayerAnchor,
  type PlayerOrigin,
  type PlayerRect,
} from '@/services/player/sheetRef';

function measureRect(
  view: View | null,
  radius: (height: number) => number,
  done: (rect?: PlayerRect) => void,
) {
  if (!view) {
    done(undefined);
    return;
  }
  view.measureInWindow((x, y, width, height) => {
    if (!width || !height) {
      done(undefined);
      return;
    }
    done({x, y, width, height, radius: radius(height)});
  });
}

interface MiniPlayerAnchorOptions {
  /** Corner radius of the mini player for its measured height. */
  radius: (height: number) => number;
}

/**
 * Registers a mini player as the rect the morphing player surface grows out
 * of. Attach `anchorRef` to the view whose bounds match the mini player's
 * visible shape. `openGesture` is the swipe-up-to-open pan; it is disabled
 * until the player has mounted.
 */
export function useMiniPlayerAnchor({radius}: MiniPlayerAnchorOptions) {
  const anchorRef = useRef<View>(null);
  const radiusRef = useRef(radius);
  radiusRef.current = radius;

  useEffect(() => {
    const measure = (done: (origin?: PlayerOrigin) => void) => {
      measureRect(anchorRef.current, radiusRef.current, done);
    };
    registerMiniPlayerAnchor(measure);
    return () => unregisterMiniPlayerAnchor(measure);
  }, []);

  const controller = useSyncExternalStore(
    subscribePlayerSheetController,
    getPlayerSheetController,
  );
  const openGesture = useMemo<PanGesture>(
    () => controller?.createOpenGesture() ?? Gesture.Pan().enabled(false),
    [controller],
  );

  return {anchorRef, openGesture};
}
