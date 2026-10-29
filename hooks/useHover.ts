// @ai-generated
import {useCallback, useMemo, useState} from 'react';
import type {PointerEvent} from 'react-native';

/**
 * Whether a trackpad or mouse pointer is over a view (ipad-standards §7.2).
 * Spread `hoverProps` on a `View` or `Pressable`. On iPad the native side turns
 * on pointer events at launch (modules/bayaan-keyboard); elsewhere they never
 * fire, so `hovered` stays false. A finger also enters and leaves a view,
 * but that's a press, not a hover, so touches are ignored.
 */
export function useHover(): {
  hovered: boolean;
  hoverProps: {
    onPointerEnter: (event: PointerEvent) => void;
    onPointerLeave: () => void;
  };
} {
  const [hovered, setHovered] = useState(false);
  const onPointerEnter = useCallback((event: PointerEvent) => {
    if (event.nativeEvent.pointerType !== 'touch') setHovered(true);
  }, []);
  const onPointerLeave = useCallback(() => setHovered(false), []);
  const hoverProps = useMemo(
    () => ({onPointerEnter, onPointerLeave}),
    [onPointerEnter, onPointerLeave],
  );
  return {hovered, hoverProps};
}
