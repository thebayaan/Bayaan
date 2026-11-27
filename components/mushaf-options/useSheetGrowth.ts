// @ai-generated
import {useEffect, useRef} from 'react';
import {useNativeSheetLevel} from '@/components/native/nativeSheetContext';
import {setNativeSheetDetents} from '@/components/native/nativeSheets';

/** Long enough for the sheet to settle at medium before large comes back. */
export const SHRINK_SETTLE_MS = 450;

/**
 * Grows the sheet to its large height while `grow` holds (a card or a
 * sub-screen is open). When it stops holding and `canShrink` says the
 * content is scrolled near its top, the sheet goes back to where it
 * opened; scrolled further down, it stays large so the reader keeps their
 * place.
 *
 * A native sheet takes the large detent alone while growing. Shrinking, it
 * takes the medium detent alone for a moment (which moves it there), then
 * gets both back so it can be pulled up again. The React Native sheet
 * calls `onGrow` and `onShrink` (its snap points). The iPad popover has a
 * fixed height and passes neither.
 */
export function useSheetGrowth({
  grow,
  canShrink,
  onGrow,
  onShrink,
}: {
  grow: boolean;
  canShrink: () => boolean;
  onGrow?: () => void;
  onShrink?: () => void;
}): void {
  const level = useNativeSheetLevel();
  const key = level?.key;
  const callbacks = useRef({canShrink, onGrow, onShrink});
  callbacks.current = {canShrink, onGrow, onShrink};
  const grown = useRef(false);

  useEffect(() => {
    const wasGrown = grown.current;
    grown.current = grow;
    if (grow) {
      if (key !== undefined) setNativeSheetDetents(key, ['large']);
      else callbacks.current.onGrow?.();
      return;
    }
    if (!wasGrown) return;
    const shrink = callbacks.current.canShrink();
    if (key === undefined) {
      if (shrink) callbacks.current.onShrink?.();
      return;
    }
    if (!shrink) {
      setNativeSheetDetents(key, null);
      return;
    }
    setNativeSheetDetents(key, ['medium']);
    const settle = setTimeout(
      () => setNativeSheetDetents(key, null),
      SHRINK_SETTLE_MS,
    );
    return () => clearTimeout(settle);
  }, [key, grow]);
}
