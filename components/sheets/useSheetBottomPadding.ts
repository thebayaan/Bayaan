// @ai-generated
import {useNativeSheetId} from '@/components/native/nativeSheetContext';

/**
 * Bottom padding at the end of a sheet's content. A native sheet's content
 * runs to the screen's bottom edge and its scroll views add the home
 * indicator's inset themselves, so it gets none; the
 * react-native-actions-sheet sheet keeps `fallback`.
 */
export function useSheetBottomPadding(fallback: number): number {
  return useNativeSheetId() === null ? fallback : 0;
}
