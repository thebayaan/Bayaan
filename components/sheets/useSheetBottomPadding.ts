// @ai-generated
import {useContext} from 'react';
import {SafeAreaInsetsContext} from 'react-native-safe-area-context';
import {useNativeSheetId} from '@/components/native/nativeSheetContext';

/**
 * Bottom padding at the end of a sheet's content. A native sheet's content
 * runs to the screen's bottom edge, so its end clears the home indicator by
 * the indicator's inset and nothing more; the react-native-actions-sheet
 * sheet keeps `fallback`.
 */
export function useSheetBottomPadding(fallback: number): number {
  const insets = useContext(SafeAreaInsetsContext);
  return useNativeSheetId() === null ? fallback : (insets?.bottom ?? 0);
}
