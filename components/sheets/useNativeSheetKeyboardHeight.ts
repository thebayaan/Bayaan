// @ai-generated
import {useEffect} from 'react';
import {Keyboard} from 'react-native';
import {useNativeSheetLevel} from '@/components/native/nativeSheetContext';
import {setNativeSheetDetents} from '@/components/native/nativeSheets';

/**
 * A fitted native sheet with a text field: full height while the keyboard is
 * up, so the field and its buttons stay above it, and sized to its content
 * again when the keyboard goes. Returns whether the sheet is fitting its
 * content now, when a flex scroll view inside it has to size to its content.
 */
export function useNativeSheetKeyboardHeight(): boolean {
  const level = useNativeSheetLevel();
  const key = level?.key;
  const fitted = level?.fitted ?? false;

  useEffect(() => {
    if (key === undefined || !fitted) return;
    const grow = (): void => setNativeSheetDetents(key, ['large']);
    const fit = (): void => setNativeSheetDetents(key, null);
    if (Keyboard.isVisible()) grow();
    const show = Keyboard.addListener('keyboardWillShow', grow);
    const hide = Keyboard.addListener('keyboardWillHide', fit);
    return () => {
      show.remove();
      hide.remove();
    };
  }, [key, fitted]);

  return level?.fit ?? false;
}
