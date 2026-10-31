// @ai-generated
import {useEffect, useRef} from 'react';
import {useNativeSheetLevel} from '@/components/native/nativeSheetContext';
import {setNativeSheetDetents} from '@/components/native/nativeSheets';

/**
 * Grows the sheet to its large height while `grow` holds (a card or a
 * sub-screen is open). A native sheet takes the large detent alone for the
 * while and gets its medium detent back after, so it can be pulled down
 * again. The React Native sheet calls `onGrow`, which snaps it to its top
 * point. The iPad popover has a fixed height and passes nothing.
 */
export function useSheetGrowth(grow: boolean, onGrow?: () => void): void {
  const level = useNativeSheetLevel();
  const key = level?.key;
  const onGrowRef = useRef(onGrow);
  onGrowRef.current = onGrow;

  useEffect(() => {
    if (key !== undefined) {
      setNativeSheetDetents(key, grow ? ['large'] : null);
      return;
    }
    if (grow) onGrowRef.current?.();
  }, [key, grow]);
}
