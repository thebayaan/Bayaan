// @ai-generated
import {useNativeSheetId} from '@/components/native/nativeSheetContext';

/**
 * Bottom padding for a sheet's content. A native sheet already keeps its
 * content above the home indicator, so it gets none; the
 * react-native-actions-sheet sheet keeps `fallback`.
 */
export function useSheetBottomPadding(fallback: number): number {
  return useNativeSheetId() === null ? fallback : 0;
}
