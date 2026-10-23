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
  /** Corner radius of the artwork for its measured height. */
  artworkRadius: (height: number) => number;
}

/**
 * Registers a mini player as the rect the morphing player surface grows out
 * of. Attach `anchorRef` to the view whose bounds match the mini player's
 * visible shape and `artworkRef` to its artwork (the start of the flying
 * artwork). `openGesture` is the swipe-up-to-open pan; it is disabled while
 * the gorhom sheet hosts the player.
 */
export function useMiniPlayerAnchor({
  radius,
  artworkRadius,
}: MiniPlayerAnchorOptions) {
  const anchorRef = useRef<View>(null);
  const artworkRef = useRef<View>(null);
  const optionsRef = useRef({radius, artworkRadius});
  optionsRef.current = {radius, artworkRadius};

  useEffect(() => {
    const measure = (done: (origin?: PlayerOrigin) => void) => {
      measureRect(anchorRef.current, optionsRef.current.radius, rect => {
        if (!rect) {
          done(undefined);
          return;
        }
        measureRect(
          artworkRef.current,
          optionsRef.current.artworkRadius,
          artwork => done({...rect, artwork}),
        );
      });
    };
    registerMiniPlayerAnchor(measure);
    return () => unregisterMiniPlayerAnchor(measure);
  }, []);

  const controller = useSyncExternalStore(
    subscribePlayerSheetController,
    getPlayerSheetController,
  );
  const openGesture = useMemo<PanGesture>(
    () => controller?.createOpenGesture?.() ?? Gesture.Pan().enabled(false),
    [controller],
  );

  return {anchorRef, artworkRef, openGesture};
}
