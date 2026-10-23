// @ai-generated
import {useCallback, useEffect, useRef} from 'react';
import type {View} from 'react-native';
import {useAnimatedStyle, useSharedValue} from 'react-native-reanimated';
import {usePlayerDismissApi} from './PlayerDismissContext';

/**
 * Marks a view as the full player's artwork: the flying artwork lands on it,
 * and it stays hidden while the copy is in flight. `enabled` false (e.g. an
 * upload without artwork) opts out, and nothing flies.
 */
export function usePlayerArtworkTarget(
  enabled: boolean,
  radius: (height: number) => number,
) {
  const {artworkFlight} = usePlayerDismissApi();
  const ref = useRef<View>(null);
  const idle = useSharedValue(1);
  const progress = artworkFlight?.progress ?? idle;
  const active = !!artworkFlight && enabled;
  const radiusRef = useRef(radius);
  radiusRef.current = radius;

  const onLayout = useCallback(() => {
    const view = ref.current;
    const content = artworkFlight?.contentRef.current;
    if (!active || !view || !content) return;
    // Layout-relative to the full-screen content view, which sits at the
    // window origin when open, so this is the artwork's open window rect
    // whatever transform the morph has on the content right now.
    view.measureLayout(content, (x, y, width, height) => {
      artworkFlight?.setTarget({
        x,
        y,
        width,
        height,
        radius: radiusRef.current(height),
      });
    });
  }, [active, artworkFlight]);

  useEffect(() => {
    if (!active) artworkFlight?.setTarget(null);
  }, [active, artworkFlight]);

  const style = useAnimatedStyle(() => ({
    opacity: active && progress.value < 0.999 ? 0 : 1,
  }));

  return {ref, onLayout, style};
}
