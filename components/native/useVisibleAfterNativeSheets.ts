// @ai-generated
import {useEffect, useState} from 'react';
import {
  getNativeSheetLevels,
  hideNativeSheet,
  nativeSheetsSettled,
} from './nativeSheets';

/**
 * `visible` for a React Native <Modal>, held back until no native sheet is
 * up. A modal presented over a native sheet leaves the app unresponsive, so
 * the native sheets close first.
 */
export function useVisibleAfterNativeSheets(visible: boolean): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!visible) {
      setReady(false);
      return;
    }
    let live = true;
    const bottom = getNativeSheetLevels().find(level => level.presented);
    (bottom ? hideNativeSheet(bottom.id) : Promise.resolve())
      .then(nativeSheetsSettled)
      .then(() => {
        if (live) setReady(true);
      });
    return () => {
      live = false;
    };
  }, [visible]);
  return visible && ready;
}
