// @ai-generated
import {useContext} from 'react';
import {SafeAreaInsetsContext} from 'react-native-safe-area-context';
import {useNativeSheetId} from '@/components/native/nativeSheetContext';

/**
 * Bottom padding at the end of a sheet's content. A native sheet's content
 * runs to the screen's bottom edge, so its end clears the home indicator by
 * the indicator's inset and nothing more; the react-native-actions-sheet
 * sheet keeps `fallback`. `trailing` is space the content already ends with
 * (a last row's margin or padding), taken off in a native sheet so every
 * sheet ends the same distance above the indicator.
 */
export function useSheetBottomPadding(
  fallback: number,
  trailing: number = 0,
): number {
  const insets = useContext(SafeAreaInsetsContext);
  if (useNativeSheetId() === null) return fallback;
  return Math.max(0, (insets?.bottom ?? 0) - trailing);
}
